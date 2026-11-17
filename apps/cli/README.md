# @amazingwalin/code-sentinel-cli

Official Command Line Interface for **Code Sentinel**, an AppSec and vulnerability management platform.

Centralizes and executes multi-tool security analysis runs (SAST, Secret Scanning, Port Scanning) and synchronizes normalized findings with the Code Sentinel backend.

## Requirements

- Node.js 22.18+ or 24.12+
- Docker (for executing Semgrep and scanner containers)

## Quick Start

You can run the CLI directly via `npx`:

```bash
npx @amazingwalin/code-sentinel-cli scan ./path/to/project
```

Or install it globally:

```bash
npm install -g @amazingwalin/code-sentinel-cli
code-sentinel scan ./path/to/project
```

## Options

| Flag | Description | Default |
| --- | --- | --- |
| `scan <path>` | Target project directory to analyze | `./` |
| `--api-url <url>` | Code Sentinel backend API URL | Embedded production endpoint |
| `--project-id <id>` | Target project UUID in Code Sentinel | Optional |
| `-v, --version` | Display CLI version | |
| `-h, --help` | Display usage instructions | |

## Features

- **Automated Scanning:** Executes SAST and scanner rules within isolated Docker containers.
- **Finding Normalization:** Normalizes tool outputs into unified Code Sentinel findings format.
- **Backend Sync & Fallback:** Automatically syncs results to the backend with timeout protection. If offline, saves findings locally to `code-sentinel-findings.json`.

## License

MIT
