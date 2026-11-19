import { spawn } from 'node:child_process';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  cwd?: string;
  /** Kills the process after this many milliseconds. */
  timeoutMs?: number;
  /** Mirrors output to the user's stderr (e.g. `docker pull` progress). */
  streamOutput?: boolean;
}

/** Runs an external program. Injected into adapters so they can be tested without Docker. */
export interface CommandRunner {
  run(command: string, args: readonly string[], options?: RunOptions): Promise<CommandResult>;
}

export class NodeCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[], options: RunOptions = {}): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject): void => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let timedOut = false;
      const timer =
        options.timeoutMs !== undefined
          ? setTimeout((): void => {
              timedOut = true;
              child.kill();
            }, options.timeoutMs)
          : undefined;

      child.stdout.on('data', (chunk: Buffer): void => {
        stdoutChunks.push(chunk);
        if (options.streamOutput) process.stderr.write(chunk);
      });
      child.stderr.on('data', (chunk: Buffer): void => {
        stderrChunks.push(chunk);
        if (options.streamOutput) process.stderr.write(chunk);
      });
      child.on('error', (error: Error): void => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (exitCode: number | null): void => {
        clearTimeout(timer);
        if (timedOut) {
          reject(new Error(`"${command}" timed out after ${options.timeoutMs}ms`));
          return;
        }
        resolve({
          exitCode: exitCode ?? -1,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
        });
      });
    });
  }
}
