import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ParsedFinding, ToolCategory } from '../../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../../domain/tool-adapter.js';
import type { CommandResult } from '../../infra/command-runner.js';
import {
  engineSettingsFromEnv,
  ExecutionEngine,
  type ToolDefinition,
} from '../../infra/execution-engine.js';
import type { ResolvedToolPaths, ToolExecutor } from '../../infra/tool-executor.js';
import { type GitleaksResult, isGitleaksReport } from './gitleaks-report.js';
import { mapGitleaksSeverity } from './gitleaks-severity.js';

const GITLEAKS_IMAGE = 'ghcr.io/gitleaks/gitleaks:v8.18.2';

/** How Gitleaks runs with each engine. The image ENTRYPOINT already is `gitleaks`. */
export const GITLEAKS_TOOL: ToolDefinition = {
  sourceTool: 'Gitleaks',
  binaryEnvVar: 'CODE_SENTINEL_GITLEAKS_PATH',
  pathCandidates: ['gitleaks'],
  managedTool: 'gitleaks',
  image: GITLEAKS_IMAGE,
  containerCommand: [],
  containerBinaryName: 'gitleaks',
};

export interface GitleaksAdapterOptions {
  /** Provides the executor (native or container); defaults to the engine configured from the environment. */
  executor?: () => Promise<ToolExecutor>;
  engine?: ExecutionEngine;
}

/**
 * RF-012: secret scanning with Gitleaks, native or in an offline container (NFR-007).
 * `--redact` keeps secret values out of the report.
 */
export class GitleaksAdapter implements ToolAdapter {
  readonly sourceTool = 'Gitleaks';
  readonly toolCategory: ToolCategory = 'Secret Scanner';

  private readonly executorProvider: () => Promise<ToolExecutor>;

  constructor(options: GitleaksAdapterOptions = {}) {
    this.executorProvider =
      options.executor ??
      ((): Promise<ToolExecutor> =>
        (options.engine ?? new ExecutionEngine(engineSettingsFromEnv())).executorFor(
          GITLEAKS_TOOL,
        ));
  }

  buildArgs(paths: ResolvedToolPaths): string[] {
    return [
      'detect',
      '--source',
      '.',
      '--report-format',
      'json',
      '--report-path',
      paths.reportPath,
      '--redact',
      '--no-git',
      '--no-banner',
    ];
  }

  async run(target: ScanTarget): Promise<string> {
    const executor = await this.prepareExecutor();

    let result: CommandResult;
    try {
      result = await executor.execute({
        workspace: target.rootPath,
        buildArgs: (paths: ResolvedToolPaths): string[] => this.buildArgs(paths),
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(
        this.sourceTool,
        `could not start ${executor.description} (${detail})`,
      );
    }

    // Gitleaks exits with 1 both when leaks are found and on usage errors; only the former
    // produces a JSON array report.
    if (result.exitCode === 1 && !result.stdout.includes('[')) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new ToolExecutionError(this.sourceTool, `execution failed: ${detail}`);
    }

    if (result.exitCode !== 0 && result.exitCode !== 1) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new ToolExecutionError(this.sourceTool, `exit code ${result.exitCode}: ${detail}`);
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
      throw new ReportParseError(this.sourceTool, 'report is not a valid Gitleaks result list');
    }

    return report.map((item: GitleaksResult): ParsedFinding => this.toParsedFinding(item));
  }

  private async prepareExecutor(): Promise<ToolExecutor> {
    try {
      return await this.executorProvider();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(this.sourceTool, detail);
    }
  }

  private toParsedFinding(item: GitleaksResult): ParsedFinding {
    return {
      type: 'Hardcoded Secret',
      severity: mapGitleaksSeverity(item.RuleID),
      filePath: toProjectRelativePath(item.File),
      line: item.StartLine,
      cwe: 'CWE-798',
      description:
        item.Description || `Potential secret or sensitive credential exposed (${item.RuleID}).`,
      recommendation:
        'Revoke the exposed secret immediately, rotate credentials, and store secrets using environment variables or a dedicated secret management service.',
    };
  }
}

/**
 * Uses "/" and strips "./" or the container directory ("/workspace/" today, "/path/" in
 * older reports) to produce project-relative paths.
 */
function toProjectRelativePath(filePath: string): string {
  return filePath
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/(?:workspace|path)\//, '')
    .replace(/^\//, '');
}
