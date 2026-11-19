import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
import { isRegistryRulesDisabled, resolveRegistryRules } from './registry-rules.js';
import { isSemgrepReport, type SemgrepResult } from './semgrep-report.js';
import { mapSemgrepSeverity } from './semgrep-severity.js';

/** Pinned image version: the same code always yields the same result. */
const SEMGREP_IMAGE = 'semgrep/semgrep:1.181.1';

/** How Semgrep runs with each engine. Opengrep (LGPL fork) is the managed native binary. */
export const SEMGREP_TOOL: ToolDefinition = {
  sourceTool: 'Semgrep',
  binaryEnvVar: 'CODE_SENTINEL_SEMGREP_PATH',
  pathCandidates: ['semgrep', 'opengrep'],
  managedTool: 'opengrep',
  image: SEMGREP_IMAGE,
  containerCommand: ['semgrep'],
  containerBinaryName: 'semgrep',
};

/** Locates the bundled rules both in development and in the published npm package. */
function resolveRulesDir(): string {
  const distRules = fileURLToPath(new URL('../../rules', import.meta.url));
  if (existsSync(distRules)) return distRules;

  const pkgRules = fileURLToPath(new URL('../../../rules', import.meta.url));
  if (existsSync(pkgRules)) return pkgRules;

  return pkgRules;
}

export interface SemgrepAdapterOptions {
  /** Provides the executor (native or container); defaults to the engine configured from the environment. */
  executor?: () => Promise<ToolExecutor>;
  engine?: ExecutionEngine;
  rulesDir?: string;
  /** Local path of the registry ruleset, or null to use only the bundled rules. */
  registryRules?: () => Promise<string | null>;
}

/** RF-011: static analysis with Semgrep CE or Opengrep, always offline (NFR-007). */
export class SemgrepAdapter implements ToolAdapter {
  readonly sourceTool = 'Semgrep';
  readonly toolCategory: ToolCategory = 'SAST';

  private readonly executorProvider: () => Promise<ToolExecutor>;
  private readonly registryRules: () => Promise<string | null>;
  private readonly rulesDir: string;

  constructor(options: SemgrepAdapterOptions = {}) {
    this.executorProvider =
      options.executor ??
      ((): Promise<ToolExecutor> =>
        (options.engine ?? new ExecutionEngine(engineSettingsFromEnv())).executorFor(SEMGREP_TOOL));
    this.registryRules =
      options.registryRules ??
      ((): Promise<string | null> =>
        isRegistryRulesDisabled()
          ? Promise.resolve(null)
          : resolveRegistryRules({ log: (message: string): void => console.log(` ${message}`) }));
    this.rulesDir = options.rulesDir ?? resolveRulesDir();
  }

  buildArgs(binaryName: string, paths: ResolvedToolPaths): string[] {
    const configArgs = ['registry', 'rules']
      .filter((name: string): boolean => name in paths.inputs)
      .flatMap((name: string): string[] => ['--config', paths.inputs[name]]);
    return [
      'scan',
      '--quiet',
      '--json',
      // Opengrep has no telemetry and rejects this flag.
      ...(binaryName === 'opengrep' ? [] : ['--metrics=off']),
      '--disable-version-check',
      ...configArgs,
      '.',
    ];
  }

  async run(target: ScanTarget): Promise<string> {
    const executor = await this.prepareExecutor();
    const registryRulesPath = await this.registryRules();
    const inputs: Record<string, string> = { rules: this.rulesDir };
    if (registryRulesPath) inputs.registry = registryRulesPath;

    let result: CommandResult;
    try {
      result = await executor.execute({
        workspace: target.rootPath,
        inputs,
        buildArgs: (paths: ResolvedToolPaths): string[] =>
          this.buildArgs(executor.binaryName, paths),
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(
        this.sourceTool,
        `could not start ${executor.description} (${detail})`,
      );
    }

    // Semgrep exits with 0 regardless of findings; any non-zero exit is a real failure.
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new ToolExecutionError(this.sourceTool, `exit code ${result.exitCode}: ${detail}`);
    }
    return result.stdout;
  }

  private async prepareExecutor(): Promise<ToolExecutor> {
    try {
      return await this.executorProvider();
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(this.sourceTool, detail);
    }
  }

  parse(rawReport: string): ParsedFinding[] {
    let report: unknown;
    try {
      const trimmed = rawReport.trim();
      const firstBrace = trimmed.indexOf('{');
      const lastBrace = trimmed.lastIndexOf('}');
      const jsonStr =
        firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
          ? trimmed.slice(firstBrace, lastBrace + 1)
          : trimmed;
      report = JSON.parse(jsonStr);
    } catch {
      throw new ReportParseError(this.sourceTool, 'output is not valid JSON');
    }
    if (!isSemgrepReport(report)) {
      throw new ReportParseError(this.sourceTool, 'missing "results" array or invalid items');
    }
    return report.results.map((semgrepResult: SemgrepResult): ParsedFinding =>
      this.toParsedFinding(semgrepResult),
    );
  }

  private toParsedFinding(semgrepResult: SemgrepResult): ParsedFinding {
    const recommendation = semgrepResult.extra.metadata?.recommendation;

    const cweRaw = semgrepResult.extra.metadata?.cwe;
    let cwe: string | null = null;
    if (typeof cweRaw === 'string') {
      const match = cweRaw.match(/CWE-\d+/i);
      if (match) cwe = match[0].toUpperCase();
    } else if (Array.isArray(cweRaw) && typeof cweRaw[0] === 'string') {
      const match = cweRaw[0].match(/CWE-\d+/i);
      if (match) cwe = match[0].toUpperCase();
    }
    if (!cwe) {
      const check = (semgrepResult.check_id || '').toLowerCase();
      if (check.includes('eval')) cwe = 'CWE-95';
      else if (check.includes('html') || check.includes('xss')) cwe = 'CWE-79';
      else if (check.includes('sql')) cwe = 'CWE-89';
      else if (check.includes('secret') || check.includes('key')) cwe = 'CWE-798';
    }

    return {
      // check_id arrives as "rules.no-eval"; the prefix is just the rules folder.
      type: semgrepResult.check_id.split('.').at(-1) ?? semgrepResult.check_id,
      severity: mapSemgrepSeverity(semgrepResult.extra.severity),
      filePath: toProjectRelativePath(semgrepResult.path),
      line: semgrepResult.start.line,
      cwe,
      description: semgrepResult.extra.message ?? null,
      recommendation: typeof recommendation === 'string' ? recommendation : null,
    };
  }
}

/** Uses "/" and strips "./" or the container directory: the backend expects project-relative paths. */
function toProjectRelativePath(semgrepPath: string): string {
  return semgrepPath
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\/(?:workspace|src)\//, '');
}
