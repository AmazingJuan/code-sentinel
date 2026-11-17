import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { ReportParseError, ToolExecutionError } from '../../domain/errors.js';
import type { ParsedFinding, ToolCategory } from '../../domain/finding.js';
import type { ScanTarget, ToolAdapter } from '../../domain/tool-adapter.js';
import {
  type CommandResult,
  type CommandRunner,
  NodeCommandRunner,
} from '../../infra/command-runner.js';
import { isSemgrepReport, type SemgrepResult } from './semgrep-report.js';
import { mapSemgrepSeverity } from './semgrep-severity.js';

/** Versión fija de la imagen: el mismo código siempre da el mismo resultado. */
export const SEMGREP_IMAGE = 'semgrep/semgrep:1.181.1';

/** Resuelve la ruta al directorio de reglas tanto en desarrollo como en distribución npm. */
export function resolveRulesDir(): string {
  // 1. En dist/rules (copiado durante build dentro del paquete)
  const distRules = fileURLToPath(new URL('../../rules', import.meta.url));
  if (existsSync(distRules)) return distRules;

  // 2. En la raíz del paquete (tanto en src/adapters/semgrep como en dist/adapters/semgrep)
  const pkgRules = fileURLToPath(new URL('../../../rules', import.meta.url));
  if (existsSync(pkgRules)) return pkgRules;

  // 3. Fallback directo a nivel relativo
  const directRules = fileURLToPath(new URL('../rules', import.meta.url));
  if (existsSync(directRules)) return directRules;

  return pkgRules;
}

const CONTAINER_SOURCE_DIR = '/src';
const CONTAINER_RULES_DIR = '/rules';
const EXCLUDED_DIRS = ['node_modules', 'dist', 'coverage'] as const;

export interface SemgrepAdapterOptions {
  runner?: CommandRunner;
  rulesDir?: string;
}

/** RF-011: análisis estático con Semgrep CE, corriendo en Docker sin red (NFR-007). */
export class SemgrepAdapter implements ToolAdapter {
  readonly sourceTool = 'Semgrep';
  readonly toolCategory: ToolCategory = 'SAST';

  private readonly runner: CommandRunner;
  private readonly rulesDir: string;

  constructor(options: SemgrepAdapterOptions = {}) {
    this.runner = options.runner ?? new NodeCommandRunner();
    this.rulesDir = options.rulesDir ?? resolveRulesDir();
  }

  buildDockerArgs(target: ScanTarget): string[] {
    const excludeArgs = EXCLUDED_DIRS.flatMap((dir: string): string[] => ['--exclude', dir]);
    return [
      'run',
      '--rm',
      '-v',
      `${target.rootPath}:${CONTAINER_SOURCE_DIR}:ro`,
      '-v',
      `${this.rulesDir}:${CONTAINER_RULES_DIR}:ro`,
      '-w',
      CONTAINER_SOURCE_DIR,
      SEMGREP_IMAGE,
      'semgrep',
      'scan',
      '--quiet',
      '--config',
      'p/default',
      '--config',
      CONTAINER_RULES_DIR,
      '--json',
      '--metrics=off',
      '--disable-version-check',
      '--no-git-ignore',
      ...excludeArgs,
      '.',
    ];
  }

  async run(target: ScanTarget): Promise<string> {
    const result = await this.execute(this.buildDockerArgs(target));

    // Semgrep exits with 0 regardless of findings; any non-zero exit is a real failure.
    if (result.exitCode !== 0) {
      const detail = result.stderr.trim().split('\n').at(-1) || 'no detail provided';
      throw new ToolExecutionError(
        this.sourceTool,
        `exit code ${result.exitCode}: ${detail}`,
      );
    }
    return result.stdout;
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
      throw new ReportParseError(
        this.sourceTool,
        'missing "results" array or invalid items',
      );
    }
    return report.results.map((semgrepResult: SemgrepResult): ParsedFinding =>
      this.toParsedFinding(semgrepResult),
    );
  }

  private async execute(args: string[]): Promise<CommandResult> {
    try {
      return await this.runner.run('docker', args);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new ToolExecutionError(this.sourceTool, `could not start Docker (${detail})`);
    }
  }

  private toParsedFinding(semgrepResult: SemgrepResult): ParsedFinding {
    const recommendation = semgrepResult.extra.metadata?.recommendation;

    // Extract or infer CWE
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
      // check_id llega como "rules.no-eval": el prefijo es la carpeta de reglas, no aporta.
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

/** Quita "./" o "/src/" del inicio: el backend espera rutas relativas a la raíz del proyecto. */
function toProjectRelativePath(semgrepPath: string): string {
  return semgrepPath.replace(/^\.\//, '').replace(new RegExp(`^${CONTAINER_SOURCE_DIR}/`), '');
}
