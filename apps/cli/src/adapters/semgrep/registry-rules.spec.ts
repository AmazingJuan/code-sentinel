import { existsSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  detectRulesFormat,
  isRegistryRulesDisabled,
  REGISTRY_CACHE_TTL_MS,
  REGISTRY_RULES_URL,
  registryRulesCachePath,
  resolveRegistryRules,
} from './registry-rules.js';

const RULES = 'rules:\n- id: test\n  pattern: eval(...)\n';
const JSON_RULES = JSON.stringify({ rules: [{ id: 'test', pattern: 'eval(...)' }] });

function fakeFetch(response: Response | Error): ReturnType<typeof vi.fn> {
  return vi.fn((): Promise<Response> =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

function writeCache(content: string, ageMs: number): void {
  mkdirSync(join(registryRulesCachePath('yml'), '..'), { recursive: true });
  writeFileSync(registryRulesCachePath('yml'), content);
  const mtime = new Date(Date.now() - ageMs);
  utimesSync(registryRulesCachePath('yml'), mtime, mtime);
}

afterEach((): void => {
  rmSync(registryRulesCachePath('yml'), { force: true });
  rmSync(registryRulesCachePath('json'), { force: true });
});

describe('detectRulesFormat', (): void => {
  it('accepts YAML and JSON rulesets and rejects anything else', (): void => {
    expect(detectRulesFormat(RULES)).toBe('yml');
    expect(detectRulesFormat(JSON_RULES)).toBe('json');
    expect(detectRulesFormat('{"error":"not found"}')).toBeNull();
    expect(detectRulesFormat('<html></html>')).toBeNull();
  });
});

describe('resolveRegistryRules', (): void => {
  it('downloads and caches the ruleset when there is no cache, keeping its format', async (): Promise<void> => {
    const fetchImpl = fakeFetch(new Response(JSON_RULES));

    const path = await resolveRegistryRules({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(path).toBe(registryRulesCachePath('json'));
    expect(readFileSync(registryRulesCachePath('json'), 'utf8')).toBe(JSON_RULES);
    expect(fetchImpl).toHaveBeenCalledWith(REGISTRY_RULES_URL, expect.anything());
  });

  it('reuses a fresh cache without network access', async (): Promise<void> => {
    writeCache(RULES, 1000);
    const fetchImpl = fakeFetch(new Error('offline'));

    const path = await resolveRegistryRules({ fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(path).toBe(registryRulesCachePath('yml'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refreshes an expired cache, keeping the stale copy if the download fails', async (): Promise<void> => {
    writeCache(RULES, REGISTRY_CACHE_TTL_MS + 1000);
    const logs: string[] = [];

    const path = await resolveRegistryRules({
      fetchImpl: fakeFetch(new Error('offline')) as unknown as typeof fetch,
      log: (message: string): void => {
        logs.push(message);
      },
    });

    expect(path).toBe(registryRulesCachePath('yml'));
    expect(logs.at(-1)).toContain('using cached copy');
  });

  it('forces a download with refresh and replaces a cache stored in the other format', async (): Promise<void> => {
    writeCache(RULES, 1000);
    const fetchImpl = fakeFetch(new Response(JSON_RULES));

    const path = await resolveRegistryRules({
      refresh: true,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(path).toBe(registryRulesCachePath('json'));
    expect(existsSync(registryRulesCachePath('yml'))).toBe(false);
  });

  it('returns null without cache when the download fails or is not a ruleset', async (): Promise<void> => {
    expect(
      await resolveRegistryRules({
        fetchImpl: fakeFetch(new Response('', { status: 503 })) as unknown as typeof fetch,
      }),
    ).toBeNull();
    expect(
      await resolveRegistryRules({
        fetchImpl: fakeFetch(new Response('<html>login</html>')) as unknown as typeof fetch,
      }),
    ).toBeNull();
    expect(existsSync(registryRulesCachePath('json'))).toBe(false);
    expect(existsSync(registryRulesCachePath('yml'))).toBe(false);
  });
});

describe('isRegistryRulesDisabled', (): void => {
  it('is controlled by CODE_SENTINEL_SEMGREP_REGISTRY=off', (): void => {
    expect(isRegistryRulesDisabled({ CODE_SENTINEL_SEMGREP_REGISTRY: 'OFF' })).toBe(true);
    expect(isRegistryRulesDisabled({})).toBe(false);
  });
});
