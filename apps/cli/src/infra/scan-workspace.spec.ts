import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  collectScanFiles,
  createScanWorkspace,
  isExcludedPath,
  MAX_FILE_BYTES,
} from './scan-workspace.js';

function write(root: string, relativePath: string, content: string | Buffer = 'x'): void {
  const fullPath = join(root, relativePath);
  mkdirSync(join(fullPath, '..'), { recursive: true });
  writeFileSync(fullPath, content);
}

describe('isExcludedPath', (): void => {
  it('excludes dependency/build directories and the CLI own report', (): void => {
    expect(isExcludedPath('node_modules/lib/index.js')).toBe(true);
    expect(isExcludedPath('packages/web/.next/server.js')).toBe(true);
    expect(isExcludedPath('code-sentinel-findings.json')).toBe(true);
    expect(isExcludedPath('src/build.ts')).toBe(false);
    expect(isExcludedPath('src/dist-utils/index.ts')).toBe(false);
  });
});

describe('collectScanFiles', (): void => {
  let root: string;

  beforeEach((): void => {
    root = mkdtempSync(join(tmpdir(), 'cs-workspace-spec-'));
  });

  afterEach((): void => {
    rmSync(root, { recursive: true, force: true });
  });

  it('uses git to respect .gitignore and includes untracked files', (): void => {
    execSync('git init -q', { cwd: root });
    write(root, '.gitignore', 'ignored.log\n');
    write(root, 'src/app.ts');
    write(root, 'ignored.log');
    write(root, 'dist/bundle.js');
    write(root, 'node_modules/pkg/index.js');
    write(root, 'code-sentinel-findings.json', '[]');
    execSync('git add -A', { cwd: root });
    write(root, 'src/untracked.ts');

    const collected = collectScanFiles(root);

    expect(collected.strategy).toBe('git');
    expect(collected.files.sort()).toEqual(['.gitignore', 'src/app.ts', 'src/untracked.ts']);
  });

  it('walks the directory skipping excluded folders when it is not a git repository', (): void => {
    write(root, 'src/app.ts');
    write(root, 'node_modules/pkg/index.js');
    write(root, 'coverage/lcov.info');

    const collected = collectScanFiles(root);

    // tmpdir could live inside a git checkout in some environments; both strategies must filter.
    expect(collected.files).toEqual(['src/app.ts']);
  });

  it('skips files larger than the size limit', (): void => {
    write(root, 'small.ts');
    write(root, 'huge.json', Buffer.alloc(MAX_FILE_BYTES + 1));

    const collected = collectScanFiles(root);

    expect(collected.files).toEqual(['small.ts']);
    expect(collected.skippedLargeFiles).toBe(1);
  });

  it('supports a single file target', (): void => {
    write(root, 'src/app.ts');

    const collected = collectScanFiles(join(root, 'src/app.ts'));

    expect(collected).toMatchObject({
      strategy: 'single-file',
      files: ['app.ts'],
      sourceRoot: join(root, 'src'),
    });
  });
});

describe('createScanWorkspace', (): void => {
  it('copies only the selected files into a temporary directory and cleans it up', async (): Promise<void> => {
    const root = mkdtempSync(join(tmpdir(), 'cs-workspace-spec-'));
    try {
      write(root, 'src/deep/app.ts', 'const a = 1;');
      write(root, 'node_modules/pkg/index.js');

      const workspace = await createScanWorkspace(root);

      expect(readFileSync(join(workspace.workspaceDir, 'src/deep/app.ts'), 'utf8')).toBe(
        'const a = 1;',
      );
      expect(existsSync(join(workspace.workspaceDir, 'node_modules'))).toBe(false);

      workspace.cleanup();
      expect(existsSync(workspace.workspaceDir)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
