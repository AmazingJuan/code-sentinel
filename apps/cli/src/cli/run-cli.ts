import { getStoredSession } from '../auth/credentials.js';
import { handleLoginCommand } from '../commands/login.js';
import { handleLogoutCommand } from '../commands/logout.js';
import { handleScanCommand } from '../commands/scan.js';
import { handleSetupCommand } from '../commands/setup.js';
import { handleWhoamiCommand } from '../commands/whoami.js';
import { DEFAULT_API_URL } from '../config/endpoint.js';
import { engineSettingsFromEnv, ExecutionEngine } from '../infra/execution-engine.js';
import { type CliOptions, CliUsageError, normalizeApiUrl, parseCliArgs } from './args.js';
import { printHelp } from './help.js';
import { getPackageVersion } from './version.js';

/** API URL precedence: --api-url, CODE_SENTINEL_API_URL, saved session, build-time default. */
function resolveApiUrl(flagValue: string | undefined): string {
  if (flagValue) return flagValue;
  const envValue = process.env.CODE_SENTINEL_API_URL?.trim();
  if (envValue) return normalizeApiUrl(envValue, 'CODE_SENTINEL_API_URL');
  const sessionUrl = getStoredSession()?.apiUrl;
  if (sessionUrl) return normalizeApiUrl(sessionUrl, 'saved session API URL');
  return normalizeApiUrl(DEFAULT_API_URL, 'built-in API URL');
}

function createEngine(options: CliOptions): ExecutionEngine {
  return new ExecutionEngine(engineSettingsFromEnv(options.engine ? { mode: options.engine } : {}));
}

async function dispatch(options: CliOptions): Promise<number> {
  if (options.version) {
    console.log(`code-sentinel-cli v${getPackageVersion()}`);
    return 0;
  }
  if (options.help) {
    printHelp();
    return 0;
  }

  switch (options.command) {
    case 'logout':
      return handleLogoutCommand();
    case 'setup':
      return handleSetupCommand(createEngine(options));
    case 'login':
      return handleLoginCommand(resolveApiUrl(options.apiUrl));
    case 'whoami':
      return handleWhoamiCommand(resolveApiUrl(options.apiUrl));
    case 'scan':
      return handleScanCommand({
        target: options.target,
        apiUrl: resolveApiUrl(options.apiUrl),
        project: options.project,
        token: options.token,
        dryRun: options.dryRun,
        tools: options.tools,
        refreshRules: options.refreshRules,
        engine: createEngine(options),
      });
    default:
      console.error(
        `Unknown command: "${options.command}". Use "code-sentinel --help" for available commands.`,
      );
      return 1;
  }
}

export async function runCli(argv: string[]): Promise<number> {
  try {
    return await dispatch(parseCliArgs(argv));
  } catch (error: unknown) {
    if (error instanceof CliUsageError) {
      console.error(`${error.message} Use "code-sentinel --help" for usage.`);
      return 1;
    }
    throw error;
  }
}
