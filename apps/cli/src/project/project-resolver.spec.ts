import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectLocalProjectIdentity,
  extractCanonicalSlug,
  resolveOrCreateProject,
} from './project-resolver.js';

describe('Project Resolver (RF-038)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('extractCanonicalSlug', () => {
    it('extracts owner/repo from HTTPS git URLs', () => {
      expect(extractCanonicalSlug('https://github.com/EAFIT-Works/juice-shop.git')).toBe('EAFIT-Works/juice-shop');
      expect(extractCanonicalSlug('https://github.com/bkimminich/juice-shop')).toBe('bkimminich/juice-shop');
    });

    it('extracts owner/repo from SSH/SCP git URLs', () => {
      expect(extractCanonicalSlug('git@github.com:juice-shop/juice-shop.git')).toBe('juice-shop/juice-shop');
      expect(extractCanonicalSlug('git@gitlab.com:org/suborg/repo.git')).toBe('suborg/repo');
    });

    it('handles single-segment or empty URLs gracefully', () => {
      expect(extractCanonicalSlug('')).toBeNull();
      expect(extractCanonicalSlug('local-repo')).toBeNull();
    });
  });

  it('detects current repository name and git origin', () => {
    const detected = detectLocalProjectIdentity('.');
    expect(detected.name).toBeDefined();
    expect(detected.repo).toBeDefined();
    expect(typeof detected.name).toBe('string');
  });

  it('resolves existing project by name match', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/projects')) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'proj-123', name: 'payments-service', repo: 'git@github.com:org/payments.git' },
            ]),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const result = await resolveOrCreateProject('http://localhost:8000', 'jwt-token', '.', 'payments-service');

    expect(result.id).toBe('proj-123');
    expect(result.name).toBe('payments-service');
    expect(result.isNew).toBe(false);
  });

  it('automatically registers project when not found', async () => {
    let postBody: unknown = null;

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/projects')) {
        if (!init || init.method === 'GET' || !init.method) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (init.method === 'POST') {
          postBody = JSON.parse(init.body as string);
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                id: 'auto-proj-999',
                name: (postBody as { name: string }).name,
                repo: (postBody as { repo: string }).repo,
              }),
          });
        }
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const result = await resolveOrCreateProject('http://localhost:8000', 'jwt-token', '.');

    expect(result.id).toBe('auto-proj-999');
    expect(result.isNew).toBe(true);
    expect(postBody).toEqual({
      name: expect.any(String),
      repo: expect.any(String),
    });
  });

  it('handles 409 Conflict by creating a user-isolated project variant', async () => {
    const postAttempts: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.endsWith('/projects')) {
        if (!init || init.method === 'GET' || !init.method) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([]),
          });
        }
        if (init.method === 'POST') {
          const body = JSON.parse(init.body as string) as { name: string; repo: string };
          postAttempts.push(body.name);

          // First attempt collides because another user registered the canonical name
          if (postAttempts.length === 1) {
            return Promise.resolve({
              ok: false,
              status: 409,
              text: () => Promise.resolve('{"message":"A project with this name is already registered"}'),
            });
          }

          // Second attempt with user-qualified name succeeds
          return Promise.resolve({
            ok: true,
            status: 201,
            json: () =>
              Promise.resolve({
                id: 'proj-user-scoped',
                name: body.name,
                repo: body.repo,
              }),
          });
        }
      }

      if (url.endsWith('/auth/me')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ email: 'analyst@code-sentinel.local', name: 'Analyst' }),
        });
      }

      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    const result = await resolveOrCreateProject('http://localhost:8000', 'jwt-token', '.', undefined, 'analyst@code-sentinel.local');

    expect(result.id).toBe('proj-user-scoped');
    expect(result.isNew).toBe(true);
    expect(postAttempts.length).toBe(2);
    expect(postAttempts[1]).toContain('(analyst)');
  });
});

