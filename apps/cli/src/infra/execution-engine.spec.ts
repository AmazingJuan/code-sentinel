import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { CommandResult, CommandRunner, RunOptions } from './command-runner.js';
import {
  defaultMountStrategy,
  type EngineMode,
  engineSettingsFromEnv,
  ExecutionEngine,
  findOnPath,
  type ToolDefinition,
} from './execution-engine.js';
import { managedBinaryPath } from './managed-tools.js';

class ScriptedRunner implements CommandRunner {
  calls: Array<{ args: readonly string[]; options?: RunOptions }> = [];

  constructor(private readonly respond: (args: readonly string[]) => CommandResult | Error) {}

  async run(
    _command: string,
    args: readonly string[],
    options?: RunOptions,
  ): Promise<CommandResult> {
    this.calls.push({ args, options });
    const response = this.respond(args);
    if (response instanceof Error) throw response;
    return response;
  }
}

const ok: CommandResult = { exitCode: 0, stdout: '', stderr: '' };
const fail: CommandResult = {
  exitCode: 1,
  stdout: '',
  stderr: 'Cannot connect to the Docker daemon',
};

const tool: ToolDefinition = {
  sourceTool: 'Fake',
  binaryEnvVar: 'CODE_SENTINEL_FAKE_TOOL_PATH',
  pathCandidates: ['code-sentinel-fake-tool-not-on-path'],
  managedTool: 'gitleaks',
  image: 'fake/image:1',
  containerCommand: [],
  containerBinaryName: 'fake',
};

function engine(mode: EngineMode, runner: CommandRunner, logs: string[] = []): ExecutionEngine {
  return new ExecutionEngine({
    mode,
    containerRuntime: 'docker',
    mountStrategy: 'bind',
    runner,
    log: (message: string): void => {
      logs.push(message);
    },
  });
}

afterEach((): void => {
  delete process.env.CODE_SENTINEL_FAKE_TOOL_PATH;
  rmSync(join(managedBinaryPath('gitleaks'), '..'), { recursive: true, force: true });
});

describe('engine settings', (): void => {
  it('uses bind mounts only on Linux', (): void => {
    expect(defaultMountStrategy('linux')).toBe('bind');
    expect(defaultMountStrategy('win32')).toBe('copy');
    expect(defaultMountStrategy('darwin')).toBe('copy');
  });

  it('reads engine, runtime and mount strategy from the environment', (): void => {
    const settings = engineSettingsFromEnv(
      {},
      {
        CODE_SENTINEL_ENGINE: 'Native',
        CODE_SENTINEL_CONTAINER_RUNTIME: 'podman',
        CODE_SENTINEL_DOCKER_MOUNT: 'copy',
      },
    );
    expect(settings).toMatchObject({
      mode: 'native',
      containerRuntime: 'podman',
      mountStrategy: 'copy',
    });
    expect(engineSettingsFromEnv({}, { CODE_SENTINEL_ENGINE: 'bogus' }).mode).toBe('auto');
  });
});

describe('findOnPath', (): void => {
  it('finds an executable in one of the PATH directories', (): void => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-path-spec-'));
    try {
      const fileName = process.platform === 'win32' ? 'mytool.exe' : 'mytool';
      writeFileSync(join(dir, fileName), '');
      chmodSync(join(dir, fileName), 0o755);

      expect(findOnPath('mytool', { PATH: ['/nonexistent', dir].join(delimiter) })).toBe(
        join(dir, fileName),
      );
      expect(findOnPath('othertool', { PATH: dir })).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ExecutionEngine.executorFor', (): void => {
  it('auto: prefers an explicit local binary and never touches the container runtime', async (): Promise<void> => {
    const dir = mkdtempSync(join(tmpdir(), 'cs-engine-spec-'));
    try {
      const binary = join(dir, 'gitleaks');
      writeFileSync(binary, '');
      process.env.CODE_SENTINEL_FAKE_TOOL_PATH = binary;
      const runner = new ScriptedRunner((): CommandResult => ok);

      const executor = await engine('auto', runner).executorFor(tool);

      expect(executor.kind).toBe('native');
      expect(executor.description).toBe(`native: ${binary}`);
      expect(runner.calls).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('auto: uses a binary previously installed by the CLI', async (): Promise<void> => {
    mkdirSync(join(managedBinaryPath('gitleaks'), '..'), { recursive: true });
    writeFileSync(managedBinaryPath('gitleaks'), '');
    const runner = new ScriptedRunner((): CommandResult => ok);

    const executor = await engine('auto', runner).executorFor(tool);

    expect(executor.kind).toBe('native');
  });

  it('auto: falls back to the container runtime and pulls a missing image once', async (): Promise<void> => {
    const runner = new ScriptedRunner((args): CommandResult => (args[0] === 'image' ? fail : ok));
    const logs: string[] = [];
    const sharedEngine = engine('auto', runner, logs);

    const [first, second] = await Promise.all([
      sharedEngine.executorFor(tool),
      sharedEngine.executorFor(tool),
    ]);

    expect(first.kind).toBe('container');
    expect(second.kind).toBe('container');
    expect(runner.calls.map((call) => call.args[0])).toEqual(['version', 'image', 'pull']);
    expect(runner.calls[2].options?.streamOutput).toBe(true);
    expect(logs.some((message) => message.includes('Pulling fake/image:1'))).toBe(true);
  });

  it('docker: fails with guidance when the runtime is not available', async (): Promise<void> => {
    const runner = new ScriptedRunner((): Error => new Error('spawn docker ENOENT'));

    await expect(engine('docker', runner).executorFor(tool)).rejects.toThrow('--engine native');
  });

  it('docker: reports a failed image pull', async (): Promise<void> => {
    const runner = new ScriptedRunner((args): CommandResult => (args[0] === 'version' ? ok : fail));

    await expect(engine('docker', runner).executorFor(tool)).rejects.toThrow(
      'could not pull fake/image:1',
    );
  });

  it('native: never checks the container runtime', async (): Promise<void> => {
    mkdirSync(join(managedBinaryPath('gitleaks'), '..'), { recursive: true });
    writeFileSync(managedBinaryPath('gitleaks'), '');
    const runner = new ScriptedRunner((): CommandResult => ok);

    const executor = await engine('native', runner).executorFor(tool);

    expect(executor.kind).toBe('native');
    expect(runner.calls).toHaveLength(0);
  });

  it('rejects an explicit binary path that does not exist', async (): Promise<void> => {
    process.env.CODE_SENTINEL_FAKE_TOOL_PATH = '/nonexistent/gitleaks';
    const runner = new ScriptedRunner((): CommandResult => ok);

    await expect(engine('auto', runner).executorFor(tool)).rejects.toThrow(
      'points to a missing file',
    );
  });
});
