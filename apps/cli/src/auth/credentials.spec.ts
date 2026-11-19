import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearSession,
  getStoredSession,
  resolveEffectiveToken,
  saveSession,
  validateTokenWithBackend,
} from './credentials.js';

describe('Credentials Manager', () => {
  let tempDir: string;

  beforeEach(() => {
    delete process.env.CODE_SENTINEL_TOKEN;
    tempDir = mkdtempSync(join(tmpdir(), 'cs-creds-test-'));
    process.env.CODE_SENTINEL_CONFIG_DIR = tempDir;
  });

  afterEach(() => {
    delete process.env.CODE_SENTINEL_TOKEN;
    delete process.env.CODE_SENTINEL_CONFIG_DIR;
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('returns null when no session is saved', () => {
    expect(getStoredSession()).toBeNull();
  });

  it('saves and reads session successfully', () => {
    saveSession({
      token: 'jwt-test-token',
      apiUrl: 'http://localhost:8000',
      user: { email: 'demo@code-sentinel.local', name: 'Demo User', role: 'analyst' },
    });

    const session = getStoredSession();
    expect(session).not.toBeNull();
    expect(session?.token).toBe('jwt-test-token');
    expect(session?.user?.email).toBe('demo@code-sentinel.local');
    expect(session?.savedAt).toBeDefined();
  });

  it('clears session successfully', () => {
    saveSession({ token: 'jwt-test-token' });
    expect(clearSession()).toBe(true);
    expect(getStoredSession()).toBeNull();
  });

  it('prioritizes explicit flag over env and stored session', () => {
    saveSession({ token: 'stored-token' });
    process.env.CODE_SENTINEL_TOKEN = 'env-token';

    expect(resolveEffectiveToken('flag-token')).toBe('flag-token');
    expect(resolveEffectiveToken()).toBe('env-token');

    delete process.env.CODE_SENTINEL_TOKEN;
    expect(resolveEffectiveToken()).toBe('stored-token');
  });

  it('never reuses a saved token for a different backend', () => {
    saveSession({ token: 'stored-token', apiUrl: 'https://a.example.com' });

    expect(resolveEffectiveToken(undefined, 'https://a.example.com')).toBe('stored-token');
    expect(resolveEffectiveToken(undefined, 'https://b.example.com')).toBeNull();
  });

  it('validateTokenWithBackend returns valid and user on 200', async () => {
    const mockUser = { id: 'u1', email: 'demo@code-sentinel.local', role: 'analyst' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      }),
    );

    const result = await validateTokenWithBackend('http://localhost:8000', 'valid-token');
    expect(result.valid).toBe(true);
    expect(result.user).toEqual(mockUser);
    vi.unstubAllGlobals();
  });

  it('validateTokenWithBackend returns invalid on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
      }),
    );

    const result = await validateTokenWithBackend('http://localhost:8000', 'expired-token');
    expect(result.valid).toBe(false);
    vi.unstubAllGlobals();
  });

  it('validateTokenWithBackend marks unreachable on network error without invalidating', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Connection refused')));

    const result = await validateTokenWithBackend('http://localhost:8000', 'any-token');
    expect(result.valid).toBe(true);
    expect(result.unreachable).toBe(true);
    vi.unstubAllGlobals();
  });
});
