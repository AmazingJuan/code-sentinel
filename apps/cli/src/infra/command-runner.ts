import { spawn } from 'node:child_process';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  /** Directorio de trabajo del proceso hijo. */
  cwd?: string;
  /** Mata el proceso si supera este tiempo (ms). */
  timeoutMs?: number;
  /** Reenvía la salida al stderr del usuario (p. ej. progreso de `docker pull`). */
  streamOutput?: boolean;
}

/** Ejecuta un programa externo. Se inyecta en los adaptadores para poder probarlos sin Docker. */
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
