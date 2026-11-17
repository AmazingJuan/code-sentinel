# @amazingwalin/code-sentinel-cli

Official Command Line Interface for **Code Sentinel**, an AppSec and vulnerability management platform.

Centralizes and executes multi-tool security analysis runs (SAST, Secret Scanning, Port Scanning) and synchronizes normalized findings with the Code Sentinel backend.

## Requirements

- Node.js 22.18+ or 24.12+
- Docker (for executing Semgrep and scanner containers)

## Quick Start

You can run the CLI directly via `npx`:

```bash
# 1. Authenticate via web browser
npx @amazingwalin/code-sentinel-cli login

# 2. Scan your project (auto-detects and binds to your project)
npx @amazingwalin/code-sentinel-cli scan
```

Or install it globally:

```bash
npm install -g @amazingwalin/code-sentinel-cli

# Authenticate once
code-sentinel login

# Scan current directory or any project path
code-sentinel scan ./path/to/project
```

## Commands

- `code-sentinel login`: Opens an interactive web login interface to authorize the CLI session.
- `code-sentinel scan [options]`: Analyzes target directory and synchronizes findings to Code Sentinel.
- `code-sentinel whoami`: Displays the active authenticated user and session details.
- `code-sentinel logout`: Clears saved session credentials from `~/.code-sentinel/credentials.json`.

## Scan Options

| Option | Description | Default |
| --- | --- | --- |
| `-d, --target <path>` | Target project directory or file to analyze | `.` |
| `-p, --project <id>` | Project ID or name override (auto-detected if omitted) | Auto-detected |
| `-u, --api-url <url>` | Code Sentinel backend API URL | Saved session or embedded endpoint |
| `-t, --token <jwt>` | Authentication token override | Saved session or `CODE_SENTINEL_TOKEN` |
| `--tools <list>` | Comma-separated tools: `semgrep,port-scanner` | All tools |
| `--dry-run` | Run scan locally without syncing results to backend | `false` |
| `-v, --version` | Display CLI version | |
| `-h, --help` | Display usage instructions | |

## Key Capabilities

- **Zero-Touch Project Registration (RF-038):** Automatically identifies local projects via Git origin, package definition, or folder name. Projects are automatically created and assigned in Code Sentinel if they do not exist.
- **Web-Based Authentication (RF-037):** Seamless browser-based login flow with visual feedback, eliminating manual copy-pasting of API tokens.
- **Multi-Tool Pipeline:** Executes SAST, secrets, and port scanners, normalizing outputs into unified Code Sentinel findings.
- **Resilient Offline Fallback:** Automatically syncs results to backend. If the backend is unreachable or offline, findings are saved locally to `code-sentinel-findings.json`.

## License

MIT
