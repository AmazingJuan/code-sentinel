import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { getConfigDirectory } from '../auth/credentials.js';
import type { CommandRunner } from './command-runner.js';

export type ManagedToolId = 'gitleaks' | 'opengrep';

interface ManagedAsset {
  file: string;
  sha256: string;
  /** Formato del asset; `raw` es el ejecutable directamente. */
  archive: 'raw' | 'tar.gz' | 'zip';
}

interface ManagedToolManifest {
  version: string;
  /** Nombre del ejecutable una vez instalado (sin extensión). */
  binary: string;
  baseUrl: string;
  /** Clave: `${platform}-${arch}` o `${platform}-${arch}-musl`. */
  assets: Record<string, ManagedAsset>;
}

/**
 * Versiones fijas y SHA-256 publicados por cada proyecto. Nunca se ejecuta un binario
 * descargado cuyo hash no coincida. Para actualizar: cambiar versión, URLs y hashes juntos.
 */
export const MANAGED_TOOLS: Record<ManagedToolId, ManagedToolManifest> = {
  gitleaks: {
    version: '8.18.2',
    binary: 'gitleaks',
    baseUrl: 'https://github.com/gitleaks/gitleaks/releases/download/v8.18.2',
    assets: {
      'win32-x64': {
        file: 'gitleaks_8.18.2_windows_x64.zip',
        sha256: 'aa19543417c668b15e89b3357413099d81a75029a8ebbaec5034b7c8cc33c7e5',
        archive: 'zip',
      },
      'win32-ia32': {
        file: 'gitleaks_8.18.2_windows_x32.zip',
        sha256: '7265ec54bc812628bf0559f938a80879be3312c7556fa96eb123d8197b5a506f',
        archive: 'zip',
      },
      'linux-x64': {
        file: 'gitleaks_8.18.2_linux_x64.tar.gz',
        sha256: '6298c9235dfc9278c14b28afd9b7fa4e6f4a289cb1974bd27949fc1e9122bdee',
        archive: 'tar.gz',
      },
      'linux-arm64': {
        file: 'gitleaks_8.18.2_linux_arm64.tar.gz',
        sha256: '4df25683f95b9e1dbb8cc71dac74d10067b8aba221e7f991e01cafa05bcbd030',
        archive: 'tar.gz',
      },
      'darwin-x64': {
        file: 'gitleaks_8.18.2_darwin_x64.tar.gz',
        sha256: 'b2dc4f853128062856273d422e2f29791a036641c1655feb83192078970fbfc0',
        archive: 'tar.gz',
      },
      'darwin-arm64': {
        file: 'gitleaks_8.18.2_darwin_arm64.tar.gz',
        sha256: '7be53fa77d7ec10cb8a7085d6ebcf375d55dd4c71f2cf6e7e6bf11554847a095',
        archive: 'tar.gz',
      },
    },
  },
  opengrep: {
    version: '1.33.1',
    binary: 'opengrep',
    baseUrl: 'https://github.com/opengrep/opengrep/releases/download/v1.33.1',
    assets: {
      'win32-x64': {
        file: 'opengrep_windows_x86.exe',
        sha256: '132e606e071bdd3928286fddc893198a6106a90820d46e21197e0ace1a23e0c1',
        archive: 'raw',
      },
      'linux-x64': {
        file: 'opengrep_manylinux_x86',
        sha256: '46e8133cc490f9f50518061590ce2f6be5a08afaeda034471c0ceda4b3899808',
        archive: 'raw',
      },
      'linux-x64-musl': {
        file: 'opengrep_musllinux_x86',
        sha256: 'aa03c3bfff105dc122cbbe6e239dc39a5cae486f1837bba3af7a16bca173f8d6',
        archive: 'raw',
      },
      'linux-arm64': {
        file: 'opengrep_manylinux_aarch64',
        sha256: 'd1433f63a90b8bc0b6ad4b498a13b372b856ce9a754a43484ba4920fe2d76dcf',
        archive: 'raw',
      },
      'linux-arm64-musl': {
        file: 'opengrep_musllinux_aarch64',
        sha256: '17c6917b53d8f8af794d8effb13c1a068018c602435d33fefc105aaa23d96f4b',
        archive: 'raw',
      },
      'darwin-x64': {
        file: 'opengrep_osx_x86',
        sha256: 'c3bd18e0d898d44e28419d95dad57c8928bb46ab32889a0ee1f72a87ad9627af',
        archive: 'raw',
      },
      'darwin-arm64': {
        file: 'opengrep_osx_arm64',
        sha256: 'a17c1881bb40e3214266a7a291cf4f2ae3bc56c1715628b5712d2ec816bc3e2d',
        archive: 'raw',
      },
    },
  },
};

const MAX_DOWNLOAD_BYTES = 200 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;

function isMuslLinux(): boolean {
  if (process.platform !== 'linux') return false;
  const report = process.report?.getReport() as
    { header?: { glibcVersionRuntime?: string } } | undefined;
  return !report?.header?.glibcVersionRuntime;
}

export function platformKey(
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
  musl: boolean = isMuslLinux(),
): string {
  return `${platform}-${arch}${musl ? '-musl' : ''}`;
}

export function findManagedAsset(
  tool: ManagedToolId,
  key: string = platformKey(),
): ManagedAsset | null {
  return MANAGED_TOOLS[tool].assets[key] ?? null;
}

function executableName(binary: string): string {
  return process.platform === 'win32' ? `${binary}.exe` : binary;
}

/** Ruta donde vive (o viviría) el binario gestionado de la versión fijada. */
export function managedBinaryPath(tool: ManagedToolId): string {
  const manifest = MANAGED_TOOLS[tool];
  return join(
    getConfigDirectory(),
    'tools',
    `${tool}-${manifest.version}`,
    executableName(manifest.binary),
  );
}

export function isManagedToolInstalled(tool: ManagedToolId): boolean {
  return existsSync(managedBinaryPath(tool));
}

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** En Windows se usa el bsdtar del sistema: el `tar` de Git Bash no abre .zip. */
function systemTar(): string {
  if (process.platform === 'win32') {
    return join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  }
  return 'tar';
}

async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`download failed with HTTP ${response.status}`);
  }
  const declaredLength = Number(response.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('download exceeds the maximum allowed size');
  }
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_DOWNLOAD_BYTES) {
    throw new Error('download exceeds the maximum allowed size');
  }
  return data;
}

/**
 * Descarga, verifica (SHA-256) e instala el binario fijado en ~/.code-sentinel/tools.
 * Devuelve la ruta del ejecutable. Idempotente.
 */
export async function installManagedTool(
  tool: ManagedToolId,
  runner: CommandRunner,
  log: (message: string) => void = (): void => undefined,
): Promise<string> {
  const destination = managedBinaryPath(tool);
  if (existsSync(destination)) return destination;

  const manifest = MANAGED_TOOLS[tool];
  const asset = findManagedAsset(tool);
  if (!asset) {
    throw new Error(`no prebuilt ${tool} binary for platform ${platformKey()}`);
  }

  const installDir = join(destination, '..');
  mkdirSync(installDir, { recursive: true });
  const stagingDir = mkdtempSync(join(installDir, '.download-'));

  try {
    log(`Downloading ${tool} v${manifest.version} (${asset.file})...`);
    const data = await download(`${manifest.baseUrl}/${asset.file}`);
    const actualHash = sha256Hex(data);
    if (actualHash !== asset.sha256) {
      throw new Error(
        `checksum mismatch for ${asset.file} (expected ${asset.sha256}, got ${actualHash})`,
      );
    }

    const extractedBinary = join(stagingDir, executableName(manifest.binary));
    if (asset.archive === 'raw') {
      writeFileSync(extractedBinary, data);
    } else {
      const archivePath = join(stagingDir, asset.file);
      writeFileSync(archivePath, data);
      const flags = asset.archive === 'zip' ? '-xf' : '-xzf';
      const result = await runner.run(systemTar(), [
        flags,
        archivePath,
        '-C',
        stagingDir,
        executableName(manifest.binary),
      ]);
      if (result.exitCode !== 0 || !existsSync(extractedBinary)) {
        throw new Error(
          `could not extract ${asset.file}: ${result.stderr.trim() || 'binary not found in archive'}`,
        );
      }
    }

    chmodSync(extractedBinary, 0o755);
    renameSync(extractedBinary, destination);
    log(`Installed ${tool} v${manifest.version} at ${destination}`);
    return destination;
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}
