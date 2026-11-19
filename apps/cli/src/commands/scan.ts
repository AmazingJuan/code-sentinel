import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  clearSession,
  getStoredSession,
  resolveEffectiveToken,
  saveSession,
  validateTokenWithBackend,
} from '../auth/credentials.js';
import { submitScanToBackend } from '../backend/scan-client.js';
import { printBanner, printRule } from '../cli/output.js';
import { errorMessage } from '../domain/errors.js';
import type { NormalizedFinding, Severity } from '../domain/finding.js';
import type { ToolAdapter } from '../domain/tool-adapter.js';
import type { ExecutionEngine } from '../infra/execution-engine.js';
import {
  createScanWorkspace,
  MAX_FILE_BYTES,
  OWN_REPORT_FILE,
  type ScanWorkspace,
} from '../infra/scan-workspace.js';
import { type PipelineResult, runAdapters, type ToolTiming } from '../pipeline/run-adapters.js';
import { type ProjectInfo, resolveOrCreateProject } from '../project/project-resolver.js';
import {
  detectGitMetadata,
  enrichFindingsWithLocalCode,
  projectDirectoryOf,
} from '../scan/local-context.js';
import { buildRegistry } from '../scan/registry.js';
import { isAdapterSelected } from '../scan/tool-selection.js';
import { authenticateInBrowser } from './login.js';

export interface ScanCommandOptions {
  target: string;
  apiUrl: string;
  project?: string;
  token?: string;
  dryRun: boolean;
  tools?: string[];
  refreshRules: boolean;
  engine: ExecutionEngine;
}

type ToolsSource = 'cli' | 'project' | 'default';

function formatTimings(timings: readonly ToolTiming[]): string {
  return timings
    .map(
      (timing: ToolTiming): string =>
        `${timing.sourceTool} ${(timing.durationMs / 1000).toFixed(1)}s${timing.ok ? '' : ' (failed)'}`,
    )
    .join(' | ');
}

function countBySeverity(findings: readonly NormalizedFinding[], severity: Severity): number {
  return findings.filter((finding: NormalizedFinding): boolean => finding.severity === severity)
    .length;
}

/** Uses the stored session, re-validating it, or falls back to an interactive browser login. */
async function resolveToken(options: ScanCommandOptions): Promise<string | null> {
  let token = resolveEffectiveToken(options.token, options.apiUrl);
  const usesStoredSession = !options.token && !process.env.CODE_SENTINEL_TOKEN;

  if (token && usesStoredSession) {
    const check = await validateTokenWithBackend(options.apiUrl, token);
    if (!check.valid) {
      console.log(' Stored session has expired or is invalid.');
      clearSession();
      token = null;
    } else if (check.user) {
      const stored = getStoredSession();
      if (stored) saveSession({ ...stored, user: check.user });
    }
  }

  if (token) return token;

  if (process.stdin.isTTY && !process.env.CI) {
    console.log(' No active session detected. Launching web login to authenticate...');
    try {
      const session = await authenticateInBrowser(options.apiUrl);
      console.log(` Authenticated as ${session.user?.email || 'user'}. Resuming scan...`);
      return session.token;
    } catch (error: unknown) {
      console.warn(` Authentication skipped (${errorMessage(error)}). Running in local mode.`);
      return null;
    }
  }

  console.log(
    ' Note: No session found. Run "code-sentinel login" or pass --token / CODE_SENTINEL_TOKEN to sync with backend.',
  );
  return null;
}

async function bindProject(
  options: ScanCommandOptions,
  token: string,
  projectDir: string,
): Promise<ProjectInfo | null> {
  try {
    console.log(' Identifying project for Code Sentinel...');
    const project = await resolveOrCreateProject(
      options.apiUrl,
      token,
      projectDir,
      options.project,
      getStoredSession()?.user?.email,
    );
    const verb = project.isNew ? 'Auto-registered project' : 'Bound to project';
    console.log(` ${verb}: "${project.name}" (ID: ${project.id})`);
    return project;
  } catch (error: unknown) {
    console.warn(
      ` Warning: Could not bind project (${errorMessage(error)}). Scan will continue locally.`,
    );
    return null;
  }
}

function selectTools(
  options: ScanCommandOptions,
  project: ProjectInfo | null,
): { patterns: string[]; source: ToolsSource } {
  if (options.tools && options.tools.length > 0) {
    return { patterns: options.tools, source: 'cli' };
  }
  if (project?.tools && project.tools.length > 0) {
    return { patterns: project.tools, source: 'project' };
  }
  return { patterns: ['all'], source: 'default' };
}

async function runInWorkspace(
  workspace: ScanWorkspace,
  adapters: readonly ToolAdapter[],
): Promise<PipelineResult> {
  // Interrupting the scan must not leave a copy of the project in the temp directory.
  const onSignal = (signal: NodeJS.Signals): void => {
    workspace.cleanup();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  try {
    if (workspace.files.length === 0) {
      return { findings: [], errors: [], timings: [] };
    }
    return await runAdapters(adapters, { rootPath: workspace.workspaceDir });
  } finally {
    process.off('SIGINT', onSignal);
    process.off('SIGTERM', onSignal);
    workspace.cleanup();
  }
}

function saveFallbackReport(projectDir: string, findings: NormalizedFinding[]): void {
  const reportPath = join(projectDir, OWN_REPORT_FILE);
  try {
    writeFileSync(reportPath, JSON.stringify(findings, null, 2), 'utf8');
    console.log(` Saved ${findings.length} findings locally to: ${reportPath}`);
    console.log(
      ' Tip: You can retry synchronization later or override the endpoint with --api-url or CODE_SENTINEL_API_URL.',
    );
  } catch (error: unknown) {
    console.error(` Could not save the local findings report (${errorMessage(error)}).`);
  }
}

/**
 * Exit codes: 0 when the scan finished without critical/high findings; 1 for
 * critical/high findings (CI gate), when every tool failed, or when a requested
 * backend sync could not be completed.
 */
export async function handleScanCommand(options: ScanCommandOptions): Promise<number> {
  const targetPath = resolve(options.target);
  if (!existsSync(targetPath)) {
    console.error(`Error: Target path does not exist: "${targetPath}"`);
    return 1;
  }
  const projectDir = projectDirectoryOf(targetPath);

  printBanner('Security Analysis Engine');
  console.log(` Target path : ${targetPath}`);

  const token = options.dryRun ? null : await resolveToken(options);
  const syncRequested = token !== null;
  const project = token ? await bindProject(options, token, projectDir) : null;

  const allAdapters = buildRegistry({
    engine: options.engine,
    refreshRules: options.refreshRules,
  }).list();
  const { patterns, source } = selectTools(options, project);
  const activeAdapters = allAdapters.filter((adapter: ToolAdapter): boolean =>
    isAdapterSelected(adapter, patterns),
  );
  if (activeAdapters.length === 0) {
    const available = allAdapters
      .map((adapter: ToolAdapter): string => `${adapter.sourceTool} (${adapter.toolCategory})`)
      .join(', ');
    const origin = source === 'project' ? 'the project configuration' : '--tools';
    console.error(
      `Error: No supported tools match ${origin} ("${patterns.join(', ')}"). Available: ${available}.`,
    );
    return 1;
  }

  const originLabel = source === 'project' ? ' (from project config)' : '';
  const toolLabels = activeAdapters
    .map((adapter: ToolAdapter): string => `${adapter.sourceTool} (${adapter.toolCategory})`)
    .join(', ');
  console.log(` Active tools${originLabel}: ${toolLabels}`);
  console.log(` Engine      : ${options.engine.settings.mode}`);

  // Only relevant files are copied to a private temp workspace (respecting .gitignore and
  // skipping dependencies/builds); scanning whole trees is what made Docker Desktop slow.
  let workspace: ScanWorkspace;
  try {
    workspace = await createScanWorkspace(targetPath);
  } catch (error: unknown) {
    console.error(` Error preparing files to scan: ${errorMessage(error)}`);
    return 1;
  }
  const strategyLabel = workspace.strategy === 'git' ? ' (respecting .gitignore)' : '';
  const skippedLabel =
    workspace.skippedLargeFiles > 0
      ? `, ${workspace.skippedLargeFiles} files over ${MAX_FILE_BYTES / (1024 * 1024)} MB skipped`
      : '';
  console.log(` Files       : ${workspace.files.length}${strategyLabel}${skippedLabel}`);
  console.log(' Running security analysis...');

  const sourceRoot = workspace.sourceRoot;
  const { findings, errors, timings } = await runInWorkspace(workspace, activeAdapters);
  if (timings.length > 0) {
    console.log(` Tool timings: ${formatTimings(timings)}`);
  }
  if (errors.length > 0) {
    console.warn(` Warnings encountered (${errors.length}):`);
    for (const error of errors) {
      console.warn(`   - ${error}`);
    }
  }
  const failedTools = timings.filter((timing: ToolTiming): boolean => !timing.ok).length;
  const allToolsFailed = timings.length > 0 && failedTools === timings.length;

  printRule();
  console.log(` Analysis finished. Normalized findings: ${findings.length}`);
  const criticals = countBySeverity(findings, 'critical');
  const highs = countBySeverity(findings, 'high');
  console.log(
    ` Severity breakdown: Critical: ${criticals} | High: ${highs} | Medium: ${countBySeverity(findings, 'medium')} | Low: ${countBySeverity(findings, 'low')}`,
  );
  if (allToolsFailed) {
    console.error(' Error: every selected tool failed; the result is not a clean scan.');
  }
  const gateExitCode = criticals > 0 || highs > 0 || allToolsFailed ? 1 : 0;

  if (!syncRequested) {
    console.log(
      options.dryRun
        ? ' Dry run mode active: findings kept locally.'
        : ' Note: Skipping backend sync (run "code-sentinel login" or specify --project/--token).',
    );
    return gateExitCode;
  }

  const gitMeta = detectGitMetadata(projectDir);
  const enrichedFindings = enrichFindingsWithLocalCode(findings, sourceRoot, gitMeta.commitSha);

  if (!project) {
    saveFallbackReport(projectDir, enrichedFindings);
    return 1;
  }

  try {
    console.log(' Syncing scan results to Code Sentinel...');
    const { scanId } = await submitScanToBackend({
      apiUrl: options.apiUrl,
      token: token as string,
      projectId: project.id,
      tools: Array.from(
        new Set(activeAdapters.map((adapter: ToolAdapter): string => adapter.toolCategory)),
      ),
      findings: enrichedFindings,
      commitSha: gitMeta.commitSha,
      branch: gitMeta.branch,
      failureMessage: allToolsFailed ? errors.join('; ').slice(0, 1000) : undefined,
    });
    console.log(
      allToolsFailed
        ? ` Recorded failed scan #${scanId} in Code Sentinel.`
        : ` Successfully synchronized scan #${scanId}!`,
    );
    console.log(' You can review the findings and metrics in the Code Sentinel web console.');
    return gateExitCode;
  } catch (error: unknown) {
    console.error(` Error during backend synchronization: ${errorMessage(error)}`);
    saveFallbackReport(projectDir, enrichedFindings);
    return 1;
  }
}
