#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { PortScannerAdapter } from './adapters/port-scanner/port-scanner-adapter.js';
import { SemgrepAdapter } from './adapters/semgrep/semgrep-adapter.js';
import { clearSession, getStoredSession, resolveEffectiveToken } from './auth/credentials.js';
import { openBrowser, startLoginServer } from './auth/login-server.js';
import { DEFAULT_API_URL } from './config/endpoint.js';
import type { NormalizedFinding } from './domain/finding.js';
import type { ToolAdapter } from './domain/tool-adapter.js';
import { AdapterRegistry } from './pipeline/adapter-registry.js';
import { runAdapters } from './pipeline/run-adapters.js';
import { type ProjectInfo, resolveOrCreateProject } from './project/project-resolver.js';

export { DEFAULT_API_URL };

export const DEFAULT_TIMEOUT_MS = 25_000;

export interface CliOptions {
  project?: string;
  target?: string;
  apiUrl?: string;
  token?: string;
  dryRun?: boolean;
  tools?: string;
  help?: boolean;
  version?: boolean;
}

export function getPackageVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
      return pkg.version || '0.1.0';
    }
  } catch {
    // fallback if package.json cannot be read
  }
  return '0.1.0';
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  try {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new Error(
          `Request to "${url}" timed out after ${timeoutMs / 1000}s. The backend may be offline, suspended, or unreachable.`,
        );
      }
      if ('code' in error) {
        const code = (error as { code?: string }).code;
        if (code === 'ENOTFOUND') {
          throw new Error(
            `Backend host not found at "${url}". Check network connection or verify the backend address.`,
          );
        }
        if (code === 'ECONNREFUSED') {
          throw new Error(
            `Connection refused at "${url}". Verify that the backend service is running and accessible.`,
          );
        }
      }
    }
    throw error;
  }
}

export function printHelp(): void {
  console.log(`
Code Sentinel CLI - Security Analysis & Vulnerability Scanner Engine

Usage:
  code-sentinel [command] [options]

Commands:
  scan                  Run security analysis on target directory (default)
  login                 Authenticate via web browser interface
  logout                Clear saved session credentials
  whoami                Show information about the active session

Options:
  -p, --project <id>    Project ID or name (auto-detected if omitted)
  -d, --target <path>   Target directory or file to scan (default: current directory)
  -u, --api-url <url>   Backend API URL (default: ${DEFAULT_API_URL})
  -t, --token <jwt>     Authentication token (default: saved session or env)
      --tools <list>    Comma-separated tools to run: semgrep, port-scanner (default: all)
      --dry-run         Run scan locally without syncing results to backend
  -h, --help            Show this help message
  -v, --version         Show CLI version

Examples:
  code-sentinel login
  code-sentinel scan
  code-sentinel scan --target ./src
  code-sentinel scan --dry-run
  code-sentinel whoami
  code-sentinel logout
`);
}

export function buildRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.register(new SemgrepAdapter());
  registry.register(new PortScannerAdapter());
  return registry;
}

export async function submitScanToBackend(
  apiUrl: string,
  token: string,
  projectId: string,
  tools: string[],
  findings: NormalizedFinding[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ scanId: string; totalCount: number }> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // Step 1: Create scan in pending state with timeout protection
  const createRes = await fetchWithTimeout(
    `${apiUrl}/scans`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId, tools }),
    },
    timeoutMs,
  );

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create scan (HTTP ${createRes.status}): ${errText}`);
  }

  const scan = (await createRes.json()) as { id: string };

  // Step 2: Transition to running with timeout protection
  const statusRes = await fetchWithTimeout(
    `${apiUrl}/scans/${scan.id}/status`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'running' }),
    },
    timeoutMs,
  );

  if (!statusRes.ok) {
    const errText = await statusRes.text();
    throw new Error(`Failed to update scan status (HTTP ${statusRes.status}): ${errText}`);
  }

  // Step 3: Ingest findings and complete scan with timeout protection
  const resultsRes = await fetchWithTimeout(
    `${apiUrl}/scans/${scan.id}/results`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'completed',
        findings,
      }),
    },
    timeoutMs,
  );

  if (!resultsRes.ok) {
    const errText = await resultsRes.text();
    throw new Error(`Failed to submit scan findings (HTTP ${resultsRes.status}): ${errText}`);
  }

  const resultData = (await resultsRes.json()) as { totalCount?: number };
  return {
    scanId: scan.id,
    totalCount: resultData.totalCount ?? findings.length,
  };
}

export async function handleLoginCommand(apiUrl: string): Promise<number> {
  console.log('----------------------------------------------------');
  console.log(' Code Sentinel - Web Authentication');
  console.log('----------------------------------------------------');
  console.log(` Target API : ${apiUrl}`);
  console.log(' Starting local authentication server...');

  try {
    const { port, sessionPromise } = await startLoginServer(apiUrl);
    const loginUrl = `http://127.0.0.1:${port}`;
    console.log(` Opening authentication portal in browser: ${loginUrl}`);
    console.log(' (If your browser does not open automatically, please open the link above)');
    openBrowser(loginUrl);
    console.log(' Waiting for authorization in browser...');

    const session = await sessionPromise;
    console.log('----------------------------------------------------');
    console.log(' Authentication successful!');
    console.log(` User   : ${session.user?.name || session.user?.email || 'Authenticated User'}`);
    console.log(` Email  : ${session.user?.email || 'N/A'}`);
    if (session.user?.role) {
      console.log(` Role   : ${session.user.role}`);
    }
    console.log(' Saved session to ~/.code-sentinel/credentials.json');
    console.log(' You can now run "code-sentinel scan" without passing --token.');
    return 0;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(` Authentication failed: ${msg}`);
    return 1;
  }
}

export function handleLogoutCommand(): number {
  const cleared = clearSession();
  if (cleared) {
    console.log(' Session cleared successfully. You are now logged out.');
  } else {
    console.log(' No active session found to clear.');
  }
  return 0;
}

export function handleWhoamiCommand(): number {
  const session = getStoredSession();
  if (!session || !session.token) {
    console.log(' Not logged in. Run "code-sentinel login" to authenticate.');
    return 1;
  }
  console.log('----------------------------------------------------');
  console.log(' Code Sentinel - Current Session');
  console.log('----------------------------------------------------');
  console.log(` User     : ${session.user?.name || 'N/A'}`);
  console.log(` Email    : ${session.user?.email || 'N/A'}`);
  console.log(` Role     : ${session.user?.role || 'N/A'}`);
  console.log(` API URL  : ${session.apiUrl || DEFAULT_API_URL}`);
  console.log(` Saved At : ${session.savedAt}`);
  return 0;
}

export async function runCli(argv: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args: argv,
    options: {
      project: { type: 'string', short: 'p' },
      target: { type: 'string', short: 'd', default: '.' },
      'api-url': { type: 'string', short: 'u', default: DEFAULT_API_URL },
      token: { type: 'string', short: 't' },
      'dry-run': { type: 'boolean', default: false },
      tools: { type: 'string', default: 'semgrep,port-scanner' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
  });

  if (values.version) {
    console.log(`code-sentinel-cli v${getPackageVersion()}`);
    return 0;
  }

  if (values.help || positionals.includes('help')) {
    printHelp();
    return 0;
  }

  const session = getStoredSession();
  const effectiveApiUrl =
    values['api-url'] && values['api-url'] !== DEFAULT_API_URL
      ? (values['api-url'] as string)
      : session?.apiUrl || (values['api-url'] as string) || DEFAULT_API_URL;

  const command = positionals[0] || 'scan';

  if (command === 'login') {
    return await handleLoginCommand(effectiveApiUrl);
  }

  if (command === 'logout') {
    return handleLogoutCommand();
  }

  if (command === 'whoami') {
    return handleWhoamiCommand();
  }

  if (command !== 'scan') {
    console.error(`Unknown command: "${command}". Use "code-sentinel --help" for available commands.`);
    return 1;
  }

  const targetPath = resolve(values.target || '.');
  if (!existsSync(targetPath)) {
    console.error(`Error: Target path does not exist: "${targetPath}"`);
    return 1;
  }

  console.log('----------------------------------------------------');
  console.log(' Code Sentinel - Security Analysis Engine');
  console.log('----------------------------------------------------');
  console.log(` Target path : ${targetPath}`);
  console.log(` Backend API : ${effectiveApiUrl}`);

  let token = resolveEffectiveToken(values.token);
  const isDryRun = Boolean(values['dry-run']);

  // If no token is provided and dry-run is not active, attempt interactive web login if TTY
  if (!token && !isDryRun) {
    if (process.stdin.isTTY && !process.env.CI) {
      console.log(' No active session detected. Launching web login to authenticate...');
      try {
        const { port, sessionPromise } = await startLoginServer(effectiveApiUrl);
        const loginUrl = `http://127.0.0.1:${port}`;
        console.log(` Opening authentication portal: ${loginUrl}`);
        openBrowser(loginUrl);
        console.log(' Waiting for authorization in browser...');
        const newSession = await sessionPromise;
        token = newSession.token;
        console.log(` Authenticated as ${newSession.user?.email || 'user'}. Resuming scan...`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(` Authentication skipped (${msg}). Running in local mode.`);
      }
    } else {
      console.log(' Note: No session found. Run "code-sentinel login" or pass --token / CODE_SENTINEL_TOKEN to sync with backend.');
    }
  }

  // Resolve or auto-register project (RF-038)
  let resolvedProject: ProjectInfo | null = null;
  if (token && !isDryRun) {
    try {
      console.log(' Identifying project for Code Sentinel...');
      resolvedProject = await resolveOrCreateProject(
        effectiveApiUrl,
        token,
        targetPath,
        values.project,
      );
      if (resolvedProject.isNew) {
        console.log(` Auto-registered project: "${resolvedProject.name}" (ID: ${resolvedProject.id})`);
      } else {
        console.log(` Bound to project: "${resolvedProject.name}" (ID: ${resolvedProject.id})`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(` Warning: Could not bind project (${msg}). Scan will continue locally.`);
    }
  }

  const registry = buildRegistry();
  const allAdapters = registry.list();
  const requestedTools = (values.tools || '').split(',').map((t: string) => t.trim().toLowerCase());

  const activeAdapters: ToolAdapter[] = allAdapters.filter((adapter: ToolAdapter) => {
    if (requestedTools.includes('all')) return true;
    const name = adapter.sourceTool.toLowerCase();
    const category = adapter.toolCategory.toLowerCase();
    return requestedTools.some((t: string) => name.includes(t) || category.includes(t));
  });

  if (activeAdapters.length === 0) {
    console.warn('Warning: No matching security adapters found for the specified tools.');
  }

  console.log(` Active tools: ${activeAdapters.map((a: ToolAdapter) => `${a.sourceTool} (${a.toolCategory})`).join(', ') || 'None'}`);
  console.log(' Running security analysis...');

  const { findings, errors } = await runAdapters(activeAdapters, { rootPath: targetPath });

  if (errors.length > 0) {
    console.warn(` Warnings encountered (${errors.length}):`);
    for (const err of errors) {
      console.warn(`   - ${err}`);
    }
  }

  console.log('----------------------------------------------------');
  console.log(` Analysis finished. Normalized findings: ${findings.length}`);

  const criticals = findings.filter((f) => f.severity === 'critical').length;
  const highs = findings.filter((f) => f.severity === 'high').length;
  const mediums = findings.filter((f) => f.severity === 'medium').length;
  const lows = findings.filter((f) => f.severity === 'low').length;

  console.log(` Severity breakdown: Critical: ${criticals} | High: ${highs} | Medium: ${mediums} | Low: ${lows}`);

  // Backend Sync
  const canSync = Boolean(token && resolvedProject && !isDryRun);

  if (!canSync) {
    if (isDryRun) {
      console.log(' Dry run mode active: findings kept locally.');
    } else {
      console.log(' Note: Skipping backend sync (run "code-sentinel login" or specify --project/--token).');
    }
    return criticals > 0 || highs > 0 ? 1 : 0;
  }

  try {
    console.log(` Syncing scan results to Code Sentinel API (${effectiveApiUrl})...`);
    const { scanId } = await submitScanToBackend(
      effectiveApiUrl,
      token as string,
      (resolvedProject as ProjectInfo).id,
      activeAdapters.map((a) => a.sourceTool),
      findings,
    );

    console.log(` Successfully synchronized scan #${scanId}!`);
    console.log(' You can review the findings and metrics in the Code Sentinel web console.');
    return criticals > 0 || highs > 0 ? 1 : 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(` Error during backend synchronization: ${message}`);

    // Graceful Degradation: persist findings locally so scan effort is never lost
    try {
      const fallbackReportPath = resolve(targetPath, 'code-sentinel-findings.json');
      writeFileSync(fallbackReportPath, JSON.stringify(findings, null, 2), 'utf8');
      console.log(` Saved ${findings.length} findings locally to: ${fallbackReportPath}`);
      console.log(' Tip: You can retry synchronization later or override the endpoint with --api-url or CODE_SENTINEL_API_URL.');
    } catch {
      // Ignore fallback write errors
    }

    return 1;
  }
}

// Self-invocation check when executed directly from CLI binary or symlink (e.g. npx)
function isRunningAsCli(): boolean {
  if (!process.argv[1]) return false;
  const currentPath = fileURLToPath(import.meta.url);
  if (currentPath === process.argv[1]) return true;
  try {
    return existsSync(process.argv[1]) && currentPath === realpathSync(process.argv[1]);
  } catch {
    return false;
  }
}

if (isRunningAsCli()) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exit(code);
  });
}
