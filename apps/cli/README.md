# @amazingwalin/code-sentinel-cli

Official Command Line Interface for **Code Sentinel**, an AppSec and vulnerability management platform.

Centralizes and executes multi-tool security analysis runs (SAST, Secret Scanning) and synchronizes normalized findings with the Code Sentinel backend.

## Requirements

- Node.js 22.18+ or 24.12+
- One of the following to run the scanners (see [Scanner engines](#scanner-engines)):
  - Nothing extra: `code-sentinel setup` downloads verified native binaries (recommended on Windows).
  - `semgrep`/`opengrep` and `gitleaks` already on your `PATH`.
  - Docker (or Podman) as a fallback.

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

# Optional, once per machine: install native scanners so scans don't need Docker
code-sentinel setup

# Authenticate once
code-sentinel login

# Scan current directory or any project path
code-sentinel scan ./path/to/project
```

## Commands

- `code-sentinel setup`: Installs native scanners (pinned, SHA-256 verified) into `~/.code-sentinel/tools` and caches the Semgrep `p/default` ruleset. After this, scans run without Docker.
- `code-sentinel login`: Opens a local web login page (on `127.0.0.1`, valid for 5 minutes) to authorize the CLI session.
- `code-sentinel scan [path] [options]`: Analyzes the target directory or file (`path` is a shorthand for `--target`) and synchronizes findings to Code Sentinel. This is the default command.
- `code-sentinel whoami`: Displays the active authenticated user and session details.
- `code-sentinel logout`: Clears saved session credentials from `~/.code-sentinel/credentials.json` (stored with owner-only permissions).

## Scan Options

| Option | Description | Default |
| --- | --- | --- |
| `-d, --target <path>` | Target project directory or file to analyze | `.` |
| `-p, --project <id>` | Project ID or name override (auto-detected if omitted) | Auto-detected |
| `-u, --api-url <url>` | Code Sentinel backend API URL (`http`/`https` only) | `CODE_SENTINEL_API_URL`, saved session, or embedded endpoint |
| `-t, --token <jwt>` | Authentication token override | `CODE_SENTINEL_TOKEN` or saved session |
| `--tools <list>` | Comma-separated tools or categories: `semgrep`, `gitleaks`, `sast`, `secrets`. Fails if nothing matches | Project tools, else all |
| `--engine <mode>` | Scanner engine: `auto`, `native`, `docker` | `auto` or `CODE_SENTINEL_ENGINE` |
| `--refresh-rules` | Re-download the cached Semgrep `p/default` ruleset before scanning | `false` |
| `--dry-run` | Run scan locally without syncing results to backend | `false` |
| `-v, --version` | Display CLI version | |
| `-h, --help` | Display usage instructions | |

## Scanner Engines

Each tool is resolved independently:

| Mode | Behavior |
| --- | --- |
| `auto` (default) | Uses a local binary (explicit path, `PATH`, or installed by `setup`). Otherwise uses Docker/Podman. If no container runtime is available, downloads the verified native binary. |
| `native` | Never uses containers. Downloads the verified native binary if none is found. |
| `docker` | Always runs the pinned images (`semgrep/semgrep:1.181.1`, `ghcr.io/gitleaks/gitleaks:v8.18.2`). |

Native binaries installed by the CLI are pinned versions whose SHA-256 is embedded in the CLI: Gitleaks `8.18.2` and [Opengrep](https://github.com/opengrep/opengrep) `1.33.1`, the LGPL fork of Semgrep CE, which ships standalone binaries for Windows, macOS and Linux. A `semgrep` binary already on the `PATH` takes precedence over Opengrep. Findings are reported with `sourceTool: Semgrep` in both cases.

### Performance notes

- Only relevant files are scanned: Git-tracked and untracked-but-not-ignored files (`.gitignore` is respected), excluding dependency and build folders (`node_modules`, `dist`, `build`, `.next`, `.venv`, ...) and files larger than 5 MB. Outside a Git repository the directory is walked with the same exclusions.
- These files are copied to a private temporary directory that is removed after the scan.
- With Docker on Windows/macOS, files are sent with `docker cp` instead of a bind mount, avoiding the slow file sharing of Docker Desktop. Linux keeps bind mounts.
- The Semgrep `p/default` ruleset is cached for 7 days in `~/.code-sentinel/cache`, so scanners always run without network access (`--network none`).
- Tools run in parallel; the CLI prints the duration of each one.

### Environment variables

| Variable | Description | Default |
| --- | --- | --- |
| `CODE_SENTINEL_API_URL` | Backend API URL (overridden by `--api-url`) | Embedded at build time |
| `CODE_SENTINEL_TOKEN` | Authentication token for non-interactive use, e.g. CI (overridden by `--token`) | |
| `CODE_SENTINEL_ENGINE` | `auto`, `native` or `docker` (overridden by `--engine`) | `auto` |
| `CODE_SENTINEL_CONTAINER_RUNTIME` | Container CLI to use, e.g. `podman` | `docker` |
| `CODE_SENTINEL_DOCKER_MOUNT` | `copy` (`docker cp`) or `bind` (volume mount) | `bind` on Linux, `copy` elsewhere |
| `CODE_SENTINEL_SEMGREP_PATH` | Explicit path to a `semgrep`/`opengrep` binary | |
| `CODE_SENTINEL_GITLEAKS_PATH` | Explicit path to a `gitleaks` binary | |
| `CODE_SENTINEL_SEMGREP_REGISTRY` | `off` to scan only with the rules bundled in the CLI | enabled |
| `CODE_SENTINEL_CONFIG_DIR` | Directory for session, tools and caches | `~/.code-sentinel` |

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Scan finished without critical or high findings. |
| `1` | Critical/high findings (CI gate), every selected tool failed, a requested backend sync failed, or invalid usage. |
| `130` / `143` | Interrupted (`SIGINT` / `SIGTERM`); the temporary workspace is removed. |

## Security Notes

- A saved session token is only sent to the backend it was issued for; scanning against another `--api-url` requires `--token`, `CODE_SENTINEL_TOKEN` or a new login.
- Backend error bodies are truncated and tokens are masked before they are printed.
- Code snippets are attached to SAST findings only; secret findings never include the surrounding source lines.
- If every selected tool fails, the scan is reported to the backend as `failed` instead of as a clean scan.

## Key Capabilities

- **Zero-Touch Project Registration (RF-038):** Automatically identifies local projects via Git origin, package definition, or folder name. Projects are automatically created and assigned in Code Sentinel if they do not exist.
- **Web-Based Authentication (RF-037):** Seamless browser-based login flow with visual feedback, eliminating manual copy-pasting of API tokens.
- **Multi-Tool Pipeline:** Executes SAST and secret scanners, normalizing outputs into unified Code Sentinel findings.
- **Resilient Offline Fallback:** Automatically syncs results to backend. If the project cannot be bound or the sync fails, findings are saved to `code-sentinel-findings.json` in the project directory (the parent directory for a single-file target) and the CLI exits with `1`. A scan left half-uploaded is marked `failed` on a best-effort basis.

## License

MIT
