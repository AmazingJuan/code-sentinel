# Code Sentinel API

NestJS 11 + TypeORM + PostgreSQL backend of Code Sentinel. It stores projects, scans and normalized findings, enforces roles and per-project assignments, and generates password-protected reports.

## Quick start

```bash
docker compose up -d db   # from the repository root
cd apps/backend
pnpm install
pnpm start:dev            # http://localhost:3000
```

Create `apps/backend/.env` first; the variables are listed in [`.env.example`](../../.env.example).

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm start:dev` | Runs the API with hot reload |
| `pnpm build` / `pnpm start:prod` | Compiles to `dist/` and runs the compiled build |
| `pnpm seed` / `pnpm db:reset` | Seeds the default users / drops the schema and seeds again |
| `pnpm test` / `pnpm test:cov` | Unit tests / with coverage |
| `pnpm test:integration` | Controller and service integration tests |
| `pnpm test:e2e` | Builds the API and runs end-to-end HTTP tests (needs PostgreSQL) |
| `pnpm lint` / `pnpm format` | ESLint with autofix / Prettier |

See the [root README](../../README.md#backend) for configuration, the API reference and the security model.
