import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { detectLocalProjectIdentity, resolveOrCreateProject } from './project-resolver.js';

describe('Project Resolver (RF-038)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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
    expect(postBody).not.toBeNull();
  });
});
