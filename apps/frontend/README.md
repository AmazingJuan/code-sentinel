# Code Sentinel Dashboard

Vue 3 + Vite + TypeScript dashboard of Code Sentinel: overview, projects, scan history, findings with filters, finding detail with code viewer, protected report export and user administration.

## Quick start

```bash
cd apps/frontend
pnpm install
CODE_SENTINEL_API_URL=http://localhost:8000 pnpm dev
```

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Development server with hot reload |
| `pnpm build` | Type-check and production build |
| `pnpm type-check` | `vue-tsc` type check |
| `pnpm lint` / `pnpm format` | oxlint + ESLint with autofix / Prettier |
| `pnpm test:unit` | Vitest unit tests |
| `pnpm test:e2e` | Cypress tests against the production preview |

`code-sentinel-2/` is an independent Next.js subproject and is not part of this app's build or checks.

See the [root README](../../README.md#frontend) for configuration and the dashboard workflows.
