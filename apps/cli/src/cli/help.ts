import { REGISTRY_RULESET } from '../adapters/semgrep/registry-rules.js';
import { DEFAULT_API_URL } from '../config/endpoint.js';

export function printHelp(): void {
  console.log(`
Code Sentinel CLI - Security Analysis & Vulnerability Scanner Engine

Usage:
  code-sentinel [command] [options]
  code-sentinel scan [path] [options]

Commands:
  scan                  Run security analysis on target directory (default)
  setup                 Install native scanners and cache rules (no Docker needed afterwards)
  login                 Authenticate via web browser interface
  logout                Clear saved session credentials
  whoami                Show information about the active session

Options:
  -p, --project <id>    Project ID or name (auto-detected if omitted)
  -d, --target <path>   Target directory or file to scan (default: current directory)
  -u, --api-url <url>   Backend API URL (default: CODE_SENTINEL_API_URL, saved session, or ${DEFAULT_API_URL})
  -t, --token <jwt>     Authentication token (default: CODE_SENTINEL_TOKEN or saved session)
      --tools <list>    Comma-separated tools to run: semgrep, gitleaks (default: project tools or all)
      --engine <mode>   Scanner engine: auto, native, docker (default: auto or CODE_SENTINEL_ENGINE)
      --refresh-rules   Re-download the cached Semgrep ${REGISTRY_RULESET} ruleset before scanning
      --dry-run         Run scan locally without syncing results to backend
  -h, --help            Show this help message
  -v, --version         Show CLI version

Engines:
  auto     Use native scanners if installed, otherwise Docker, otherwise download native ones
  native   Never use Docker (downloads verified gitleaks/opengrep binaries if missing)
  docker   Always run scanners in containers

Exit codes:
  0        Scan finished without critical/high findings
  1        Critical/high findings, scan or sync failure, or invalid usage

Examples:
  code-sentinel setup
  code-sentinel login
  code-sentinel scan
  code-sentinel scan ./src
  code-sentinel scan --dry-run
  code-sentinel scan --engine native
  code-sentinel whoami
  code-sentinel logout
`);
}
