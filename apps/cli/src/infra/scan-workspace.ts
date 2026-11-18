import { execFileSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';

/**
 * Directorios generados o de dependencias que nunca se escanean. Se aplican tanto a la
 * lista de Git como al recorrido manual, para que una carpeta versionada por error
 * (p. ej. `dist/`) no dispare el tiempo de análisis.
 */
export const EXCLUDED_DIRS: ReadonlySet<string> = new Set([
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

/** Reporte local que genera el propio CLI: contiene snippets y no debe re-escanearse. */
export const OWN_REPORT_FILE = 'code-sentinel-findings.json';

/** Archivos más grandes que esto suelen ser binarios, bundles o datos; Semgrep los salta igual. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const COPY_CONCURRENCY = 32;

export interface CollectedFiles {
  /** Directorio desde el que se resuelven las rutas relativas. */
  sourceRoot: string;
  /** Rutas relativas a `sourceRoot`, con `/` como separador. */
  files: string[];
  /** `git` si se usó `git ls-files` (respeta .gitignore), `walk` si se recorrió el disco. */
  strategy: 'git' | 'walk' | 'single-file';
  skippedLargeFiles: number;
}

export interface ScanWorkspace extends CollectedFiles {
  /** Directorio temporal con solo los archivos a escanear. */
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

/** Decide qué archivos de `targetPath` se analizan, sin copiarlos todavía. */
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
      // lstat: los symlinks no se siguen para no escanear fuera del proyecto.
      const stats = lstatSync(join(targetPath, relativePath));
      if (!stats.isFile()) continue;
      if (stats.size > MAX_FILE_BYTES) {
        skippedLargeFiles++;
        continue;
      }
      files.push(relativePath);
    } catch {
      // Archivo versionado pero borrado del disco: no hay nada que escanear.
    }
  }

  return { sourceRoot: targetPath, files, strategy: gitFiles ? 'git' : 'walk', skippedLargeFiles };
}

async function copyAll(
  sourceRoot: string,
  destinationRoot: string,
  files: readonly string[],
): Promise<void> {
  // Se guarda la promesa (no un flag): otro worker puede necesitar la misma carpeta
  // mientras el mkdir todavía está en curso.
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
 * Copia los archivos a escanear a un directorio temporal privado. Las herramientas
 * leen ahí (montado o copiado al contenedor, o directo en modo nativo), así el costo
 * del sistema de archivos de Docker Desktop solo se paga por los archivos relevantes.
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
