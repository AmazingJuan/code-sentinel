import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ParsedFinding, ToolCategory } from '../../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../../domain/tool-adapter.js';
import {
  type CommandResult,
  type CommandRunner,
  NodeCommandRunner,
} from '../../infra/command-runner.js';
import { type GitleaksResult, isGitleaksReport } from './gitleaks-report.js';
import { mapGitleaksSeverity } from './gitleaks-severity.js';

export const GITLEAKS_IMAGE = 'ghcr.io/gitleaks/gitleaks:v8.18.2';
const CONTAINER_TARGET_DIR = '/path';

export interface GitleaksAdapterOptions {
  runner?: CommandRunner;
}

/**
 * RF-012: Escaneo de secretos expuestos mediante Gitleaks en Docker (NFR-007).
 * Identifica tokens, credenciales y secretos sin transmitir el código ni almacenar
 * secretos en texto plano.
 */
export class GitleaksAdapter implements ToolAdapter {
  readonly sourceTool = 'Gitleaks';
  readonly toolCategory: ToolCategory = 'Secret Scanner';

  private readonly runner: CommandRunner;

  constructor(options: GitleaksAdapterOptions = {}) {
    this.runner = options.runner ?? new NodeCommandRunner();
  }

  buildDockerArgs(target: ScanTarget): string[] {
    return [
      'run',
      '--rm',
      '--network',
      'none',
      '-v',
      `${target.rootPath}:${CONTAINER_TARGET_DIR}:ro`,
      GITLEAKS_IMAGE,
      'dir',
      CONTAINER_TARGET_DIR,
      '--report-format',
      'json',
      '--report-path',
      '/dev/stdout',
      '--redact',
      '--no-git',
    ];
  }

  async run(target: ScanTarget): Promise<string> {
    const result = await this.execute(this.buildDockerArgs(target));

    // Gitleaks: exit code 0 = no leaks found; exit code 1 = leaks found.
    // Both are successful analysis outcomes. Any other exit code is an error.
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new ToolExecutionError(
        this.sourceTool,
        `exit code ${result.exitCode}: ${detail}`,
      );
    }
    return result.stdout;
  }

  parse(rawReport: string): ParsedFinding[] {
    const trimmed = rawReport.trim();
    if (!trimmed) {
      return [];
    }

    let report: unknown;
    try {
      const firstBracket = trimmed.indexOf('[');
      const lastBracket = trimmed.lastIndexOf(']');
      const jsonStr =
        firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket
          ? trimmed.slice(firstBracket, lastBracket + 1)
          : trimmed;
      report = JSON.parse(jsonStr);
    } catch {
      throw new ReportParseError(this.sourceTool, 'output is not valid JSON');
    }

    if (!isGitleaksReport(report)) {
      throw new ReportParseError(
        this.sourceTool,
        'report is not a valid Gitleaks result list',
      );
    }

    return report.map((item: GitleaksResult): ParsedFinding => this.toParsedFinding(item));
  }

  private async execute(args: string[]): Promise<CommandResult> {
    try {
      return await this.runner.run('docker', args);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(this.sourceTool, `could not start Docker (${detail})`);
    }
  }

  private toParsedFinding(item: GitleaksResult): ParsedFinding {
    return {
      type: 'Hardcoded Secret',
      severity: mapGitleaksSeverity(item.RuleID),
      filePath: toProjectRelativePath(item.File),
      line: item.StartLine,
      cwe: 'CWE-798',
      description: item.Description || `Potential secret or sensitive credential exposed (${item.RuleID}).`,
      recommendation:
        'Revoke the exposed secret immediately, rotate credentials, and store secrets using environment variables or a dedicated secret management service.',
    };
  }
}

/** Quita "/path/" del inicio de las rutas de Gitleaks para hacerlas relativas al proyecto. */
function toProjectRelativePath(filePath: string): string {
  return filePath
    .replaceAll('\\', '/')
    .replace(new RegExp(`^${CONTAINER_TARGET_DIR}/`), '')
    .replace(/^\//, '');
}
