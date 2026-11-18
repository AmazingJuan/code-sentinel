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
| `--tools <list>` | Comma-separated tools: `semgrep,gitleaks` | All tools |
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
| `CODE_SENTINEL_ENGINE` | `auto`, `native` or `docker` (overridden by `--engine`) | `auto` |
| `CODE_SENTINEL_CONTAINER_RUNTIME` | Container CLI to use, e.g. `podman` | `docker` |
| `CODE_SENTINEL_DOCKER_MOUNT` | `copy` (`docker cp`) or `bind` (volume mount) | `bind` on Linux, `copy` elsewhere |
| `CODE_SENTINEL_SEMGREP_PATH` | Explicit path to a `semgrep`/`opengrep` binary | |
| `CODE_SENTINEL_GITLEAKS_PATH` | Explicit path to a `gitleaks` binary | |
| `CODE_SENTINEL_SEMGREP_REGISTRY` | `off` to scan only with the rules bundled in the CLI | enabled |
| `CODE_SENTINEL_CONFIG_DIR` | Directory for session, tools and caches | `~/.code-sentinel` |

## Key Capabilities

- **Zero-Touch Project Registration (RF-038):** Automatically identifies local projects via Git origin, package definition, or folder name. Projects are automatically created and assigned in Code Sentinel if they do not exist.
- **Web-Based Authentication (RF-037):** Seamless browser-based login flow with visual feedback, eliminating manual copy-pasting of API tokens.
- **Multi-Tool Pipeline:** Executes SAST and secret scanners, normalizing outputs into unified Code Sentinel findings.
- **Resilient Offline Fallback:** Automatically syncs results to backend. If the backend is unreachable or offline, findings are saved locally to `code-sentinel-findings.json`.

## License

MIT
