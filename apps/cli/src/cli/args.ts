import { parseArgs, type ParseArgsOptionsConfig } from 'node:util';

import { type EngineMode, ENGINE_MODES, isEngineMode } from '../infra/execution-engine.js';

export interface CliOptions {
  command: string;
  project?: string;
  target: string;
  apiUrl?: string;
  token?: string;
  dryRun: boolean;
  tools?: string[];
  engine?: EngineMode;
  refreshRules: boolean;
  help: boolean;
  version: boolean;
}

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliUsageError';
  }
}

/** Accepts only absolute http(s) URLs and drops trailing slashes so paths can be appended. */
export function normalizeApiUrl(value: string, source: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new CliUsageError(`Invalid ${source}: expected an http(s) URL.`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new CliUsageError(`Invalid ${source}: only http and https URLs are supported.`);
  }
  if (parsed.search || parsed.hash) {
    throw new CliUsageError(`Invalid ${source}: query strings and fragments are not allowed.`);
  }
  return `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, '');
}

export function parseToolList(value: string): string[] {
  const tools = value
    .split(',')
    .map((tool: string): string => tool.trim())
    .filter((tool: string): boolean => tool.length > 0);
  if (tools.length === 0) {
    throw new CliUsageError(
      'Invalid --tools: provide a comma-separated list such as "semgrep,gitleaks".',
    );
  }
  return tools;
}

const OPTIONS = {
  project: { type: 'string', short: 'p' },
  target: { type: 'string', short: 'd' },
  'api-url': { type: 'string', short: 'u' },
  token: { type: 'string', short: 't' },
  'dry-run': { type: 'boolean' },
  tools: { type: 'string' },
  engine: { type: 'string' },
  'refresh-rules': { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
} as const satisfies ParseArgsOptionsConfig;

type ParsedArgs = ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>;

export function parseCliArgs(argv: string[]): CliOptions {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  } catch (error: unknown) {
    throw new CliUsageError(error instanceof Error ? error.message : String(error));
  }
  const { values, positionals } = parsed;

  const engineValue = values.engine?.trim().toLowerCase();
  if (engineValue !== undefined && !isEngineMode(engineValue)) {
    throw new CliUsageError(
      `Invalid --engine "${values.engine}". Use one of: ${ENGINE_MODES.join(', ')}.`,
    );
  }

  const command = positionals[0] ?? 'scan';
  // `code-sentinel scan <path>` is accepted as a shorthand for `--target <path>`.
  const positionalTarget = command === 'scan' ? positionals[1] : undefined;
  if (values.target !== undefined && positionalTarget !== undefined) {
    throw new CliUsageError(
      'Specify the scan target either as a path argument or with --target, not both.',
    );
  }

  return {
    command,
    project: values.project,
    target: values.target ?? positionalTarget ?? '.',
    apiUrl:
      values['api-url'] === undefined ? undefined : normalizeApiUrl(values['api-url'], '--api-url'),
    token: values.token,
    dryRun: values['dry-run'] ?? false,
    tools: values.tools === undefined ? undefined : parseToolList(values.tools),
    engine: engineValue,
    refreshRules: values['refresh-rules'] ?? false,
    help: (values.help ?? false) || command === 'help',
    version: values.version ?? false,
  };
}
