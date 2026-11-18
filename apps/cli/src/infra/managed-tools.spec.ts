import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CommandResult, CommandRunner } from './command-runner.js';
import {
  findManagedAsset,
  installManagedTool,
  MANAGED_TOOLS,
  managedBinaryPath,
  platformKey,
  sha256Hex,
} from './managed-tools.js';

const unusedRunner: CommandRunner = {
  run: (): Promise<CommandResult> => Promise.reject(new Error('tar should not run for raw assets')),
};

const originalAssets = { ...MANAGED_TOOLS.opengrep.assets };

afterEach((): void => {
  MANAGED_TOOLS.opengrep.assets = { ...originalAssets };
  rmSync(join(managedBinaryPath('opengrep'), '..'), { recursive: true, force: true });
});

describe('managed tool manifest', (): void => {
  it('covers Windows, macOS and Linux for both scanners', (): void => {
    for (const key of ['win32-x64', 'darwin-arm64', 'darwin-x64', 'linux-x64', 'linux-arm64']) {
      expect(findManagedAsset('gitleaks', key)).not.toBeNull();
      expect(findManagedAsset('opengrep', key)).not.toBeNull();
    }
    expect(findManagedAsset('opengrep', 'linux-x64-musl')?.file).toBe('opengrep_musllinux_x86');
    expect(findManagedAsset('gitleaks', 'aix-ppc64')).toBeNull();
  });

  it('pins a sha256 for every asset', (): void => {
    for (const manifest of Object.values(MANAGED_TOOLS)) {
      for (const asset of Object.values(manifest.assets)) {
        expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it('builds platform keys including musl', (): void => {
    expect(platformKey('linux', 'x64', true)).toBe('linux-x64-musl');
    expect(platformKey('win32', 'x64', false)).toBe('win32-x64');
  });
});

describe('installManagedTool', (): void => {
  it('refuses to install a binary whose checksum does not match', async (): Promise<void> => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));

    await expect(installManagedTool('opengrep', unusedRunner)).rejects.toThrow('checksum mismatch');
    expect(existsSync(managedBinaryPath('opengrep'))).toBe(false);
  });

  it('installs a verified raw binary as executable and reuses it afterwards', async (): Promise<void> => {
    const payload = new TextEncoder().encode('fake-binary');
    MANAGED_TOOLS.opengrep.assets = {
      [platformKey()]: { file: 'opengrep_test', sha256: sha256Hex(payload), archive: 'raw' },
    };
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(payload));

    const installed = await installManagedTool('opengrep', unusedRunner);
    await installManagedTool('opengrep', unusedRunner);

    expect(installed).toBe(managedBinaryPath('opengrep'));
    expect(readFileSync(installed, 'utf8')).toBe('fake-binary');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      `${MANAGED_TOOLS.opengrep.baseUrl}/opengrep_test`,
    );
  });

  it('fails clearly on unsupported platforms', async (): Promise<void> => {
    MANAGED_TOOLS.opengrep.assets = {};

    await expect(installManagedTool('opengrep', unusedRunner)).rejects.toThrow(
      'no prebuilt opengrep binary',
    );
  });
});
