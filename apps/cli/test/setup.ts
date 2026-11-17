import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, vi } from 'vitest';

const testConfigDir = mkdtempSync(join(tmpdir(), 'cs-cli-test-config-'));
process.env.CODE_SENTINEL_CONFIG_DIR = testConfigDir;

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  delete process.env.CODE_SENTINEL_CONFIG_DIR;
  if (existsSync(testConfigDir)) {
    rmSync(testConfigDir, { recursive: true, force: true });
  }
});
