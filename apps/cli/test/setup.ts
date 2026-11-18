import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, vi } from 'vitest';

const testConfigDir = mkdtempSync(join(tmpdir(), 'cs-cli-test-config-'));
process.env.CODE_SENTINEL_CONFIG_DIR = testConfigDir;
// Deterministic engine in tests: never download binaries or rules, never depend on local PATH tools.
process.env.CODE_SENTINEL_ENGINE = 'docker';
process.env.CODE_SENTINEL_DOCKER_MOUNT = 'bind';
process.env.CODE_SENTINEL_SEMGREP_REGISTRY = 'off';

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  delete process.env.CODE_SENTINEL_CONFIG_DIR;
  if (existsSync(testConfigDir)) {
    rmSync(testConfigDir, { recursive: true, force: true });
  }
});
