import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';

import type { CommandResult, CommandRunner } from './command-runner.js';

/** Paths as the tool sees them (host paths natively, container paths in Docker). */
export interface ResolvedToolPaths {
  /** Extra read-only inputs (rules, configuration) keyed by logical name. */
  inputs: Record<string, string>;
  /** File the tool must write its report to. */
  reportPath: string;
}

export interface ToolRunRequest {
  /** Host directory with the files to scan; the tool runs with it as cwd. */
  workspace: string;
  /** Host files or folders the tool needs, keyed by logical name. */
  inputs?: Record<string, string>;
  /** Builds the tool arguments (without the binary) from the resolved paths. */
  buildArgs(paths: ResolvedToolPaths): string[];
}

/** Runs an analysis tool. The result `stdout` holds the report. */
export interface ToolExecutor {
  readonly kind: 'native' | 'container';
  /** Short description for logs, e.g. "native: /usr/bin/gitleaks". */
  readonly description: string;
  /** Name of the binary actually run (semgrep and opengrep accept different flags). */
  readonly binaryName: string;
  execute(request: ToolRunRequest): Promise<CommandResult>;
}

/** Runs a binary installed on the host, with no VM or mounts: the fastest option on Windows. */
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
    // The report goes to a separate directory so it is never part of the scanned workspace.
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
 * Runs the tool in a container without network access (`--network none`). With `copy`
 * the files are sent with `docker cp` (a single tar stream) instead of a bind mount: on
 * Docker Desktop (Windows/macOS) every read through a bind mount crosses the VM boundary
 * and is orders of magnitude slower.
 */
export class ContainerToolExecutor implements ToolExecutor {
  readonly kind = 'container';
  readonly description: string;

  constructor(
    private readonly runtime: string,
    private readonly image: string,
    /** Command inside the image; empty when the ENTRYPOINT already is the tool. */
    private readonly containerCommand: readonly string[],
    readonly binaryName: string,
    private readonly mountStrategy: MountStrategy,
    private readonly runner: CommandRunner,
  ) {
    this.description = `${runtime}: ${image} (${mountStrategy})`;
  }

  /** Fixed in-container path for each logical input. */
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
      // `dir<sep>.` copies the folder contents; the destination is created if missing.
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
      // `start -a` returns the container exit code and keeps stdout and stderr apart.
      return await this.runner.run(this.runtime, ['start', '-a', containerId]);
    } finally {
      await this.runner.run(this.runtime, ['rm', '-f', containerId]).catch((): void => undefined);
    }
  }
}
