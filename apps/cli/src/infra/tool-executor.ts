import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import type { CommandResult, CommandRunner } from './command-runner.js';

/** Rutas tal como las ve la herramienta (host en nativo, contenedor en Docker). */
export interface ResolvedToolPaths {
  /** Entradas adicionales de solo lectura (reglas, configuración) por nombre lógico. */
  inputs: Record<string, string>;
  /** Archivo donde la herramienta debe escribir su reporte. */
  reportPath: string;
}

export interface ToolRunRequest {
  /** Directorio del host con los archivos a escanear; la herramienta corre con cwd ahí. */
  workspace: string;
  /** Archivos o carpetas del host que la herramienta necesita, por nombre lógico. */
  inputs?: Record<string, string>;
  /** Construye los argumentos de la herramienta (sin el binario) a partir de las rutas. */
  buildArgs(paths: ResolvedToolPaths): string[];
}

/** Ejecuta una herramienta de análisis. `stdout` del resultado contiene el reporte. */
export interface ToolExecutor {
  readonly kind: 'native' | 'container';
  /** Descripción corta para logs, p. ej. "native: /usr/bin/gitleaks". */
  readonly description: string;
  /** Nombre del binario que corre realmente (semgrep vs opengrep cambian los flags). */
  readonly binaryName: string;
  execute(request: ToolRunRequest): Promise<CommandResult>;
}

/** Corre el binario instalado en la máquina, sin VM ni montajes: lo más rápido en Windows. */
export class NativeToolExecutor implements ToolExecutor {
  readonly kind = 'native';
  readonly description: string;

  constructor(
    private readonly binaryPath: string,
    readonly binaryName: string,
    private readonly runner: CommandRunner,
  ) {
    this.description = `native: ${binaryPath}`;
  }

  async execute(request: ToolRunRequest): Promise<CommandResult> {
    // El reporte va a un directorio aparte para no quedar dentro del workspace escaneado.
    const reportDir = mkdtempSync(join(tmpdir(), 'code-sentinel-report-'));
    const reportPath = join(reportDir, 'report.json');
    try {
      const args = request.buildArgs({ inputs: { ...request.inputs }, reportPath });
      const result = await this.runner.run(this.binaryPath, args, { cwd: request.workspace });
      const report = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '';
      return { ...result, stdout: report || result.stdout };
    } finally {
      rmSync(reportDir, { recursive: true, force: true });
    }
  }
}

export type MountStrategy = 'bind' | 'copy';

const CONTAINER_WORKSPACE = '/workspace';

/**
 * Corre la herramienta en un contenedor sin red. Con `copy` los archivos se envían con
 * `docker cp` (un único stream tar) en lugar de un bind mount: en Docker Desktop
 * (Windows/macOS) cada lectura sobre un bind mount cruza la frontera de la VM y es
 * órdenes de magnitud más lenta.
 */
export class ContainerToolExecutor implements ToolExecutor {
  readonly kind = 'container';
  readonly description: string;

  constructor(
    private readonly runtime: string,
    private readonly image: string,
    /** Comando dentro de la imagen; vacío si el ENTRYPOINT ya es la herramienta. */
    private readonly containerCommand: readonly string[],
    readonly binaryName: string,
    private readonly mountStrategy: MountStrategy,
    private readonly runner: CommandRunner,
  ) {
    this.description = `${runtime}: ${image} (${mountStrategy})`;
  }

  /** Rutas fijas dentro del contenedor para cada entrada lógica. */
  static containerInputPath(name: string): string {
    return `/cs-input-${name}`;
  }

  buildPaths(inputs: Record<string, string>): ResolvedToolPaths {
    const containerInputs: Record<string, string> = {};
    for (const name of Object.keys(inputs)) {
      containerInputs[name] = ContainerToolExecutor.containerInputPath(name);
    }
    return { inputs: containerInputs, reportPath: '/dev/stdout' };
  }

  buildRunArgs(request: ToolRunRequest): string[] {
    const inputs = request.inputs ?? {};
    const volumeArgs = [
      '-v',
      `${request.workspace}:${CONTAINER_WORKSPACE}:ro`,
      ...Object.entries(inputs).flatMap(([name, hostPath]: [string, string]): string[] => [
        '-v',
        `${hostPath}:${ContainerToolExecutor.containerInputPath(name)}:ro`,
      ]),
    ];
    return [
      'run',
      '--rm',
      '--network',
      'none',
      ...volumeArgs,
      '-w',
      CONTAINER_WORKSPACE,
      this.image,
      ...this.containerCommand,
      ...request.buildArgs(this.buildPaths(inputs)),
    ];
  }

  buildCreateArgs(request: ToolRunRequest): string[] {
    return [
      'create',
      '--network',
      'none',
      '-w',
      CONTAINER_WORKSPACE,
      this.image,
      ...this.containerCommand,
      ...request.buildArgs(this.buildPaths(request.inputs ?? {})),
    ];
  }

  async execute(request: ToolRunRequest): Promise<CommandResult> {
    if (this.mountStrategy === 'bind') {
      return this.runner.run(this.runtime, this.buildRunArgs(request));
    }

    const created = await this.runner.run(this.runtime, this.buildCreateArgs(request));
    const containerId = created.stdout.trim().split('\n').at(-1) ?? '';
    if (created.exitCode !== 0 || !containerId) {
      return created;
    }
    try {
      // `dir<sep>.` copia el contenido de la carpeta; el destino se crea si no existe.
      const copies: Array<[string, string]> = [
        [`${request.workspace}${sep}.`, CONTAINER_WORKSPACE],
        ...Object.entries(request.inputs ?? {}).map(
          ([name, hostPath]: [string, string]): [string, string] => [
            hostPath,
            ContainerToolExecutor.containerInputPath(name),
          ],
        ),
      ];
      for (const [hostPath, containerPath] of copies) {
        const copied = await this.runner.run(this.runtime, [
          'cp',
          hostPath,
          `${containerId}:${containerPath}`,
        ]);
        if (copied.exitCode !== 0) return copied;
      }
      // `start -a` devuelve el exit code del contenedor y separa stdout de stderr.
      return await this.runner.run(this.runtime, ['start', '-a', containerId]);
    } finally {
      await this.runner.run(this.runtime, ['rm', '-f', containerId]).catch((): void => undefined);
    }
  }
}
