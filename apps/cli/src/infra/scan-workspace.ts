import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';

/**
 * Generated or dependency directories that are never scanned. Applied to both the Git
 * listing and the manual walk, so a folder committed by mistake (e.g. `dist/`) does not
 * blow up scan time.
 */
const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
  '.git',
  'node_modules',
  'bower_components',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.output',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.venv',
  'venv',
  '__pycache__',
  '.gradle',
  '.terraform',
]);

/** Local fallback report written by the CLI: it contains snippets and must not be re-scanned. */
export const OWN_REPORT_FILE = 'code-sentinel-findings.json';

/** Larger files are usually binaries, bundles or data; Semgrep skips them anyway. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const COPY_CONCURRENCY = 32;

export interface CollectedFiles {
  /** Directory the relative paths are resolved from. */
  sourceRoot: string;
  /** Paths relative to `sourceRoot`, using `/` as separator. */
  files: string[];
  /** `git` when `git ls-files` was used (respects .gitignore), `walk` for a disk walk. */
  strategy: 'git' | 'walk' | 'single-file';
  skippedLargeFiles: number;
}

export interface ScanWorkspace extends CollectedFiles {
  /** Temporary directory holding only the files to scan. */
  workspaceDir: string;
  cleanup(): void;
}

export function isExcludedPath(relativePath: string): boolean {
  const segments = relativePath.split('/');
  if (segments.at(-1) === OWN_REPORT_FILE) return true;
  return segments.slice(0, -1).some((segment: string): boolean => EXCLUDED_DIRS.has(segment));
}

function listGitFiles(root: string): string[] | null {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        maxBuffer: 256 * 1024 * 1024,
      },
    );
    return output.split('\0').filter((entry: string): boolean => entry.length > 0);
  } catch {
    return null;
  }
}

function walkFiles(root: string): string[] {
  const files: string[] = [];
  const pending: string[] = [''];
  while (pending.length > 0) {
    const current = pending.pop() as string;
    const entries = readdirSync(join(root, current), { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = current ? `${current}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry.name)) pending.push(relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
  return files;
}

/** Decides which files under `targetPath` are scanned, without copying them yet. */
export function collectScanFiles(targetPath: string): CollectedFiles {
  if (statSync(targetPath).isFile()) {
    return {
      sourceRoot: dirname(targetPath),
      files: [basename(targetPath)],
      strategy: 'single-file',
      skippedLargeFiles: 0,
    };
  }

  const gitFiles = listGitFiles(targetPath);
  const candidates = gitFiles ?? walkFiles(targetPath);
  const files: string[] = [];
  let skippedLargeFiles = 0;

  for (const candidate of candidates) {
    const relativePath = candidate.split(sep).join('/');
    if (isExcludedPath(relativePath)) continue;
    try {
      // lstat: symlinks are not followed so nothing outside the project is scanned.
      const stats = lstatSync(join(targetPath, relativePath));
      if (!stats.isFile()) continue;
      if (stats.size > MAX_FILE_BYTES) {
        skippedLargeFiles++;
        continue;
      }
      files.push(relativePath);
    } catch {
      // Tracked by Git but deleted from disk: nothing to scan.
    }
  }

  return { sourceRoot: targetPath, files, strategy: gitFiles ? 'git' : 'walk', skippedLargeFiles };
}

async function copyAll(
  sourceRoot: string,
  destinationRoot: string,
  files: readonly string[],
): Promise<void> {
  // Store the promise, not a flag: another worker may need the same folder while the
  // mkdir is still in flight.
  const createdDirs = new Map<string, Promise<unknown>>();
  let index = 0;
  const worker = async (): Promise<void> => {
    while (index < files.length) {
      const relativePath = files[index++];
      const destination = join(destinationRoot, relativePath);
      const parent = dirname(destination);
      let pendingMkdir = createdDirs.get(parent);
      if (!pendingMkdir) {
        pendingMkdir = mkdir(parent, { recursive: true });
        createdDirs.set(parent, pendingMkdir);
      }
      await pendingMkdir;
      await copyFile(join(sourceRoot, relativePath), destination);
    }
  };
  await Promise.all(Array.from({ length: Math.min(COPY_CONCURRENCY, files.length) }, worker));
}

/**
 * Copies the files to scan into a private temporary directory. Tools read from there
 * (mounted or copied into the container, or directly in native mode), so the Docker
 * Desktop file sharing cost is only paid for relevant files.
 */
export async function createScanWorkspace(targetPath: string): Promise<ScanWorkspace> {
  const collected = collectScanFiles(targetPath);
  const workspaceDir = mkdtempSync(join(tmpdir(), 'code-sentinel-ws-'));
  const cleanup = (): void => {
    rmSync(workspaceDir, { recursive: true, force: true });
  };
  try {
    await copyAll(collected.sourceRoot, workspaceDir, collected.files);
  } catch (error: unknown) {
    cleanup();
    throw error;
  }
  return { ...collected, workspaceDir, cleanup };
}
