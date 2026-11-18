import { existsSync, statSync } from 'node:fs';
import { basename, delimiter, join } from 'node:path';

import { type CommandRunner, NodeCommandRunner } from './command-runner.js';
import {
  findManagedAsset,
  installManagedTool,
  isManagedToolInstalled,
  type ManagedToolId,
  managedBinaryPath,
} from './managed-tools.js';
import {
  ContainerToolExecutor,
  type MountStrategy,
  NativeToolExecutor,
  type ToolExecutor,
} from './tool-executor.js';

export type EngineMode = 'auto' | 'native' | 'docker';

export const ENGINE_MODES: readonly EngineMode[] = ['auto', 'native', 'docker'];

/** Cómo encontrar y ejecutar una herramienta en cada motor. */
export interface ToolDefinition {
  sourceTool: string;
  /** Variable de entorno con la ruta explícita del binario. */
  binaryEnvVar: string;
  /** Binarios aceptados en el PATH, en orden de preferencia. */
  pathCandidates: readonly string[];
  managedTool: ManagedToolId;
  image: string;
  /** Comando dentro de la imagen; vacío si el ENTRYPOINT ya es la herramienta. */
  containerCommand: readonly string[];
  /** Binario que corre dentro de la imagen (define los flags soportados). */
  containerBinaryName: string;
}

export interface EngineSettings {
  mode: EngineMode;
  containerRuntime: string;
  mountStrategy: MountStrategy;
  runner: CommandRunner;
  log: (message: string) => void;
}

const CONTAINER_CHECK_TIMEOUT_MS = 15_000;

export function isEngineMode(value: string): value is EngineMode {
  return (ENGINE_MODES as readonly string[]).includes(value);
}

/** Bind mount es nativo en Linux; en Docker Desktop (Windows/macOS) copiar es más rápido. */
export function defaultMountStrategy(platform: NodeJS.Platform = process.platform): MountStrategy {
  return platform === 'linux' ? 'bind' : 'copy';
}

export function engineSettingsFromEnv(
  overrides: Partial<EngineSettings> = {},
  env: NodeJS.ProcessEnv = process.env,
): EngineSettings {
  const envMode = env.CODE_SENTINEL_ENGINE?.trim().toLowerCase() ?? '';
  const envMount = env.CODE_SENTINEL_DOCKER_MOUNT?.trim().toLowerCase();
  return {
    mode: isEngineMode(envMode) ? envMode : 'auto',
    containerRuntime: env.CODE_SENTINEL_CONTAINER_RUNTIME?.trim() || 'docker',
    mountStrategy: envMount === 'bind' || envMount === 'copy' ? envMount : defaultMountStrategy(),
    runner: new NodeCommandRunner(),
    log: (message: string): void => console.log(` ${message}`),
    ...overrides,
  };
}

/** Busca un ejecutable en el PATH sin lanzar procesos (en Windows solo `.exe`). */
export function findOnPath(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const pathValue = env.PATH ?? env.Path ?? '';
  const fileName = process.platform === 'win32' ? `${name}.exe` : name;
  for (const dir of pathValue.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, fileName);
    try {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    } catch {
      // directorio inaccesible del PATH: se ignora
    }
  }
  return null;
}

function binaryNameOf(binaryPath: string): string {
  return basename(binaryPath).toLowerCase().includes('opengrep')
    ? 'opengrep'
    : basename(binaryPath).replace(/\.exe$/i, '');
}

/**
 * Resuelve el ejecutor de cada herramienta según el modo:
 * - `native`: binario explícito → PATH → instalado por el CLI → descarga verificada.
 * - `docker`: solo contenedor.
 * - `auto`: binario local si existe; si no, contenedor; si no hay runtime, descarga verificada.
 */
export class ExecutionEngine {
  private containerCheck: Promise<boolean> | null = null;
  private nativeTipShown = false;
  private readonly imageChecks = new Map<string, Promise<void>>();

  constructor(readonly settings: EngineSettings) {}

  async executorFor(tool: ToolDefinition): Promise<ToolExecutor> {
    const { mode } = this.settings;

    if (mode !== 'docker') {
      const localBinary = this.findLocalBinary(tool);
      if (localBinary) {
        return new NativeToolExecutor(localBinary, binaryNameOf(localBinary), this.settings.runner);
      }
    }

    if (mode !== 'native' && (await this.isContainerRuntimeAvailable())) {
      await this.ensureImage(tool.image);
      if (mode === 'auto' && process.platform !== 'linux' && !this.nativeTipShown) {
        this.nativeTipShown = true;
        this.settings.log(
          `Tip: run "code-sentinel setup" to install native scanners and skip ${this.settings.containerRuntime} for faster scans.`,
        );
      }
      return new ContainerToolExecutor(
        this.settings.containerRuntime,
        tool.image,
        tool.containerCommand,
        tool.containerBinaryName,
        this.settings.mountStrategy,
        this.settings.runner,
      );
    }

    if (mode === 'docker') {
      throw new Error(
        `${this.settings.containerRuntime} is not available. Start it, or use "--engine native" to run without containers.`,
      );
    }

    if (findManagedAsset(tool.managedTool)) {
      const binaryPath = await installManagedTool(
        tool.managedTool,
        this.settings.runner,
        this.settings.log,
      );
      return new NativeToolExecutor(binaryPath, tool.managedTool, this.settings.runner);
    }

    throw new Error(
      `no local binary (${tool.pathCandidates.join(' or ')}), no container runtime, and no prebuilt binary for this platform. Install ${tool.pathCandidates[0]} or Docker.`,
    );
  }

  findLocalBinary(tool: ToolDefinition): string | null {
    const explicit = process.env[tool.binaryEnvVar]?.trim();
    if (explicit) {
      if (!existsSync(explicit)) {
        throw new Error(`${tool.binaryEnvVar} points to a missing file: ${explicit}`);
      }
      return explicit;
    }
    for (const candidate of tool.pathCandidates) {
      const found = findOnPath(candidate);
      if (found) return found;
    }
    return isManagedToolInstalled(tool.managedTool) ? managedBinaryPath(tool.managedTool) : null;
  }

  isContainerRuntimeAvailable(): Promise<boolean> {
    this.containerCheck ??= this.settings.runner
      .run(this.settings.containerRuntime, ['version', '--format', '{{.Server.Version}}'], {
        timeoutMs: CONTAINER_CHECK_TIMEOUT_MS,
      })
      .then((result): boolean => result.exitCode === 0)
      .catch((): boolean => false);
    return this.containerCheck;
  }

  /** Descarga la imagen una sola vez, mostrando el progreso en lugar de parecer colgado. */
  ensureImage(image: string): Promise<void> {
    let check = this.imageChecks.get(image);
    if (!check) {
      check = this.pullIfMissing(image);
      this.imageChecks.set(image, check);
    }
    return check;
  }

  private async pullIfMissing(image: string): Promise<void> {
    const { runner, containerRuntime, log } = this.settings;
    const inspect = await runner.run(containerRuntime, [
      'image',
      'inspect',
      '--format',
      '{{.Id}}',
      image,
    ]);
    if (inspect.exitCode === 0) return;
    log(`Pulling ${image} (first run only)...`);
    const pull = await runner.run(containerRuntime, ['pull', image], { streamOutput: true });
    if (pull.exitCode !== 0) {
      const detail = pull.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new Error(`could not pull ${image}: ${detail}`);
    }
  }
}
