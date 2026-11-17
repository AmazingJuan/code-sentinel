import { existsSync, rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearSession,
  getCredentialsFilePath,
  getStoredSession,
  resolveEffectiveToken,
  saveSession,
} from './credentials.js';

describe('Credentials Manager', () => {
  const filePath = getCredentialsFilePath();

  beforeEach(() => {
    delete process.env.CODE_SENTINEL_TOKEN;
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
  });

  afterEach(() => {
    delete process.env.CODE_SENTINEL_TOKEN;
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
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
});
