import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { fetchWithTimeout } from '../backend/http.js';

export interface SessionUser {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface StoredSession {
  token: string;
  apiUrl?: string;
  user?: SessionUser;
  savedAt: string;
}

export interface TokenValidation {
  valid: boolean;
  user?: SessionUser;
  unreachable?: boolean;
}

const TOKEN_VALIDATION_TIMEOUT_MS = 10_000;

export function getConfigDirectory(): string {
  return process.env.CODE_SENTINEL_CONFIG_DIR || join(homedir(), '.code-sentinel');
}

export function getCredentialsFilePath(): string {
  return join(getConfigDirectory(), 'credentials.json');
}

export function getStoredSession(): StoredSession | null {
  try {
    const filePath = getCredentialsFilePath();
    if (!existsSync(filePath)) return null;
    const data = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoredSession> | null;
    if (data && typeof data.token === 'string' && data.token.length > 0) {
      return data as StoredSession;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: Omit<StoredSession, 'savedAt'>): void {
  const dir = getConfigDirectory();
  // The file holds a bearer token: keep it readable by the current user only.
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const fullSession: StoredSession = {
    ...session,
    savedAt: new Date().toISOString(),
  };
  const filePath = getCredentialsFilePath();
  writeFileSync(filePath, JSON.stringify(fullSession, null, 2), { encoding: 'utf8', mode: 0o600 });
  // `mode` only applies on creation; tighten files written by older versions too.
  try {
    chmodSync(filePath, 0o600);
  } catch {
    // Not supported on every filesystem (e.g. Windows); the write itself succeeded.
  }
}

export function clearSession(): boolean {
  try {
    const filePath = getCredentialsFilePath();
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Token precedence: explicit flag, then CODE_SENTINEL_TOKEN, then the saved session.
 * When `apiUrl` is given, a saved token issued by a different backend is ignored so
 * it is never sent to a host it was not created for.
 */
export function resolveEffectiveToken(explicitTokenFlag?: string, apiUrl?: string): string | null {
  if (explicitTokenFlag && explicitTokenFlag.trim().length > 0) {
    return explicitTokenFlag.trim();
  }
  const envToken = process.env.CODE_SENTINEL_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }
  const stored = getStoredSession();
  if (!stored) return null;
  if (apiUrl && stored.apiUrl && stored.apiUrl !== apiUrl) return null;
  return stored.token;
}

export async function validateTokenWithBackend(
  apiUrl: string,
  token: string,
): Promise<TokenValidation> {
  try {
    const res = await fetchWithTimeout(
      `${apiUrl}/auth/me`,
      { method: 'GET', headers: { Authorization: `Bearer ${token}` } },
      TOKEN_VALIDATION_TIMEOUT_MS,
    );

    if (res.ok) {
      const user = (await res.json()) as SessionUser;
      return { valid: true, user };
    }
    if (res.status === 401) {
      return { valid: false };
    }
    return { valid: true };
  } catch {
    // An offline or restarting backend must not wipe a session that may still be valid.
    return { valid: true, unreachable: true };
  }
}
