import { existsSync, writeFileSync } from 'node:fs';
import { dirname, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { CommandResult, CommandRunner, RunOptions } from './command-runner.js';
import { ContainerToolExecutor, NativeToolExecutor, type ToolRunRequest } from './tool-executor.js';

interface RecordedCall {
  command: string;
  args: readonly string[];
  options?: RunOptions;
}

class RecordingRunner implements CommandRunner {
  calls: RecordedCall[] = [];

  constructor(private readonly respond: (args: readonly string[]) => CommandResult) {}

  async run(
    command: string,
    args: readonly string[],
    options?: RunOptions,
  ): Promise<CommandResult> {
    this.calls.push({ command, args, options });
    return this.respond(args);
  }
}

const ok = (stdout = ''): CommandResult => ({ exitCode: 0, stdout, stderr: '' });

const request: ToolRunRequest = {
  workspace: '/tmp/ws',
  inputs: { rules: '/opt/rules' },
  buildArgs: (paths): string[] => [
    'scan',
    '--config',
    paths.inputs.rules,
    '--out',
    paths.reportPath,
    '.',
  ],
};

describe('ContainerToolExecutor (bind)', (): void => {
  it('runs without network, mounting workspace and inputs read-only', async (): Promise<void> => {
    const runner = new RecordingRunner((): CommandResult => ok('{}'));
    const executor = new ContainerToolExecutor(
      'docker',
      'img:1',
      ['semgrep'],
      'semgrep',
      'bind',
      runner,
    );

    const result = await executor.execute(request);

    expect(result.stdout).toBe('{}');
    expect(runner.calls).toHaveLength(1);
    expect(runner.calls[0].args).toEqual([
      'run',
      '--rm',
      '--network',
      'none',
      '-v',
      '/tmp/ws:/workspace:ro',
      '-v',
      '/opt/rules:/cs-input-rules:ro',
      '-w',
      '/workspace',
      'img:1',
      'semgrep',
      'scan',
      '--config',
      '/cs-input-rules',
      '--out',
      '/dev/stdout',
      '.',
    ]);
  });
});

describe('ContainerToolExecutor (copy)', (): void => {
  it('creates the container, copies files in, starts it attached and always removes it', async (): Promise<void> => {
    const runner = new RecordingRunner((args): CommandResult =>
      args[0] === 'create' ? ok('abc123\n') : args[0] === 'start' ? ok('[report]') : ok(),
    );
    const executor = new ContainerToolExecutor('podman', 'img:1', [], 'gitleaks', 'copy', runner);

    const result = await executor.execute(request);

    expect(result.stdout).toBe('[report]');
    expect(runner.calls.every((call) => call.command === 'podman')).toBe(true);
    expect(runner.calls.map((call) => call.args[0])).toEqual(['create', 'cp', 'cp', 'start', 'rm']);
    expect(runner.calls[0].args.slice(0, 5)).toEqual([
      'create',
      '--network',
      'none',
      '-w',
      '/workspace',
    ]);
    expect(runner.calls[1].args).toEqual(['cp', `/tmp/ws${sep}.`, 'abc123:/workspace']);
    expect(runner.calls[2].args).toEqual(['cp', '/opt/rules', 'abc123:/cs-input-rules']);
    expect(runner.calls[3].args).toEqual(['start', '-a', 'abc123']);
    expect(runner.calls[4].args).toEqual(['rm', '-f', 'abc123']);
  });

  it('removes the container and returns the failure when a copy fails', async (): Promise<void> => {
    const runner = new RecordingRunner((args): CommandResult =>
      args[0] === 'create'
        ? ok('abc123')
        : args[0] === 'cp'
          ? { exitCode: 1, stdout: '', stderr: 'no space left' }
          : ok(),
    );
    const executor = new ContainerToolExecutor('docker', 'img:1', [], 'gitleaks', 'copy', runner);

    const result = await executor.execute(request);

    expect(result).toMatchObject({ exitCode: 1, stderr: 'no space left' });
    expect(runner.calls.map((call) => call.args[0])).toEqual(['create', 'cp', 'rm']);
  });

  it('returns the create failure without trying to start anything', async (): Promise<void> => {
    const runner = new RecordingRunner((): CommandResult => ({
      exitCode: 125,
      stdout: '',
      stderr: 'bad image',
    }));
    const executor = new ContainerToolExecutor('docker', 'img:1', [], 'gitleaks', 'copy', runner);

    const result = await executor.execute(request);

    expect(result.exitCode).toBe(125);
    expect(runner.calls).toHaveLength(1);
  });
});

describe('NativeToolExecutor', (): void => {
  it('runs the binary in the workspace with host paths and returns the report file content', async (): Promise<void> => {
    let reportPath = '';
    const runner = new RecordingRunner((args): CommandResult => {
      reportPath = args[args.indexOf('--out') + 1];
      writeFileSync(reportPath, '[{"from":"file"}]');
      return { exitCode: 1, stdout: 'banner', stderr: '' };
    });
    const executor = new NativeToolExecutor('/usr/local/bin/gitleaks', 'gitleaks', runner);

    const result = await executor.execute(request);

    expect(runner.calls[0].command).toBe('/usr/local/bin/gitleaks');
    expect(runner.calls[0].options?.cwd).toBe('/tmp/ws');
    expect(runner.calls[0].args).toContain('/opt/rules');
    expect(result).toEqual({ exitCode: 1, stdout: '[{"from":"file"}]', stderr: '' });
    // The report directory is outside the workspace and removed afterwards.
    expect(reportPath.startsWith('/tmp/ws')).toBe(false);
    expect(existsSync(dirname(reportPath))).toBe(false);
  });

  it('falls back to stdout when the tool does not write a report file', async (): Promise<void> => {
    const runner = new RecordingRunner((): CommandResult => ok('{"results":[]}'));
    const executor = new NativeToolExecutor('semgrep', 'semgrep', runner);

    const result = await executor.execute(request);

    expect(result.stdout).toBe('{"results":[]}');
  });
});
