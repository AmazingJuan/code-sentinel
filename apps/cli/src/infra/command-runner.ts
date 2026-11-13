import { spawn } from 'node:child_process';

export interface CommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Ejecuta un programa externo. Se inyecta en los adaptadores para poder probarlos sin Docker. */
export interface CommandRunner {
  run(command: string, args: readonly string[]): Promise<CommandResult>;
}

export class NodeCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[]): Promise<CommandResult> {
    return new Promise<CommandResult>((resolve, reject): void => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      child.stdout.on('data', (chunk: Buffer): void => {
        stdoutChunks.push(chunk);
      });
      child.stderr.on('data', (chunk: Buffer): void => {
        stderrChunks.push(chunk);
      });
      child.on('error', (error: Error): void => {
        reject(error);
      });
      child.on('close', (exitCode: number | null): void => {
        resolve({
          exitCode: exitCode ?? -1,
          stdout: Buffer.concat(stdoutChunks).toString('utf8'),
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
        });
      });
    });
  }
}
