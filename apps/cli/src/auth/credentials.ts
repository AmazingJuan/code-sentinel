import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export interface StoredSession {
  token: string;
  apiUrl?: string;
  user?: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
  };
  savedAt: string;
}

export function getConfigDirectory(): string {
  return join(homedir(), '.code-sentinel');
}

export function getCredentialsFilePath(): string {
  return join(getConfigDirectory(), 'credentials.json');
}

export function getStoredSession(): StoredSession | null {
  try {
    const filePath = getCredentialsFilePath();
    if (!existsSync(filePath)) return null;
    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content) as StoredSession;
    if (data && typeof data.token === 'string' && data.token.length > 0) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: Omit<StoredSession, 'savedAt'>): void {
  const dir = getConfigDirectory();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const fullSession: StoredSession = {
    ...session,
    savedAt: new Date().toISOString(),
  };
  writeFileSync(getCredentialsFilePath(), JSON.stringify(fullSession, null, 2), 'utf8');
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

export function resolveEffectiveToken(explicitTokenFlag?: string): string | null {
  if (explicitTokenFlag && explicitTokenFlag.trim().length > 0) {
    return explicitTokenFlag.trim();
  }
  const envToken = process.env.CODE_SENTINEL_TOKEN;
  if (envToken && envToken.trim().length > 0) {
    return envToken.trim();
  }
  const stored = getStoredSession();
  if (stored && stored.token) {
    return stored.token;
  }
  return null;
}

export async function validateTokenWithBackend(
  apiUrl: string,
  token: string,
): Promise<{ valid: boolean; user?: StoredSession['user']; unreachable?: boolean }> {
  try {
    const res = await fetch(`${apiUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.ok) {
      const user = (await res.json()) as StoredSession['user'];
      return { valid: true, user };
    }

    if (res.status === 401) {
      return { valid: false };
    }

    return { valid: true };
  } catch {
    // Network error (backend might be offline or restarting)
    return { valid: true, unreachable: true };
  }
}

