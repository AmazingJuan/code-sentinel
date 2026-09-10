# Code Sentinel - Agent Instructions

## Purpose and Scope

This file defines the shared instructions for working in the Code Sentinel repository. It applies to the entire repository unless a closer `AGENTS.md` exists for a modified file. There are currently no known nested instructions.

Code Sentinel is an AppSec and vulnerability management platform. It centralizes projects, scan runs, and normalized findings from security tools. The repository contains:

- A NestJS backend with TypeScript, PostgreSQL, and TypeORM.
- The main frontend application built with Vue 3, Vite, and TypeScript.
- A separate frontend subproject at `apps/frontend/code-sentinel-2/`, built with Next.js, React, and Tailwind. Treat it as an independent surface until the team decides to integrate or remove it.
- Docker Compose configuration for PostgreSQL, the backend, and the Vue frontend.
- Functional, technical, and engineering documentation in `docs/`.

The dominant language of the code is English. Project documentation mixes Spanish and English; preserve the language and style of the file being edited.

## Working Rules

1. Read the target file, its imports, the owning module or component, and nearby tests first.
2. Form a local hypothesis about the cause and validate the change with the smallest useful test or command.
3. Make small, focused changes. Do not reformat unrelated files or replace changes made by other contributors.
4. Respect the domain-oriented architecture and established patterns in the area being modified.
5. Do not add dependencies, layers, or abstractions when a clear local solution is sufficient.
6. Do not change public contracts, route names, data schemas, or environment variables without reviewing their consumers and documentation.
7. Do not commit, reset, rebase, or create branches unless the user explicitly requests it.
8. Do not delete untracked changes. Before modifying a file with prior changes, inspect its current state and work with it.
9. Do not use real secrets in code, fixtures, logs, documentation, or shared commands.
10. Do not expose stack traces, SQL, tokens, passwords, or internal details in HTTP responses or production logs.

## Repository Structure

```text
/
├── docker-compose.yml          # db, back y front
├── README.md                   # uso local y Docker
├── .env.example                # currently empty; update when adding variables
├── apps/
│   ├── backend/                # NestJS + PostgreSQL + TypeORM
│   │   ├── src/auth/
│   │   ├── src/users/
│   │   ├── src/projects/
│   │   ├── src/scans/
│   │   ├── src/findings/
│   │   └── test/               # e2e tests
│   └── frontend/               # Vue/Vite, the Compose frontend
│       ├── src/components/
│       ├── src/layouts/
│       ├── src/services/
│       ├── src/stores/
│       ├── src/views/
│       ├── src/interfaces/
│       ├── src/__tests__/
│       ├── cypress/
│       └── code-sentinel-2/     # independent Next/React subproject
└── docs/
    ├── coding/                 # backend and frontend rules
    ├── definition/             # problem, scope, SOW, and requirements
    ├── diagrams/               # architecture and data model
    └── ai-usage/prompts/       # verification prompts
```

There is no `package.json` at the repository root. Install dependencies and run scripts from the relevant application directory.

## Requirements and Dependencies

- Docker y Docker Compose.
- Node.js 24 or newer for the root-documented workflow. The Vue frontend declares `^22.18.0 || >=24.12.0`; prefer Node 24.
- pnpm y Corepack habilitado.
- PostgreSQL 16 when running outside Docker.
- For the Vue frontend, VS Code with Vue (Official)/Volar; do not use Vetur.

Use each application's lockfile and the pnpm package manager. Do not mix `npm install` or `yarn` with these projects.

## Docker Execution

Run these commands from the repository root:

```bash
docker compose up --build
docker compose up --build -d
docker compose logs -f
docker compose config
docker compose down
docker compose down -v
```

Published services and ports:

| Servicio | Contenedor | Host |
| --- | --- | --- |
| `db` | PostgreSQL 16 | `5432` |
| `back` | NestJS on `3000` | `8000` |
| `front` | Nginx serving Vue | `3000` |

The backend and frontend publish host ports `8000` and `3000`, respectively. PostgreSQL uses the `postgres_data` volume.

Compose-recognized variables:

```env
POSTGRES_DB=code_sentinel
POSTGRES_USER=code_sentinel
POSTGRES_PASSWORD=code_sentinel
JWT_SECRET=development-only-secret
JWT_EXPIRES_IN=1h
```

Compose passes `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_NAME` to the backend based on these values. `JWT_SECRET` must be strong and environment-specific outside development. Never rely on the default secret in production.

Note that `.env.example` exists but is currently empty. When adding or depending on a variable, document it there and in the README without including real secret values.

## Backend: NestJS

### Commands

Run from `apps/backend`:

```bash
pnpm install
pnpm run start:dev
pnpm run build
pnpm run format
pnpm run lint
pnpm run test
pnpm run test:watch
pnpm run test:cov
pnpm run test:e2e
pnpm run seed
```

`start:dev` runs in watch mode. `start:prod` runs `node dist/main` after compilation. The Dockerfile installs from the frozen lockfile, builds, and runs as a non-root user.

### Architecture

Organize the backend by feature/domain. Current areas are `auth`, `users`, `projects`, `scans`, and `findings`. `AppModule` composes infrastructure and feature modules; it must not accumulate business logic.

- **Controllers:** receive HTTP requests, validate through DTOs/pipes, apply guards, and delegate. Keep them thin.
- **Services:** contain business logic, orchestration, and repository access through injection.
- **DTOs:** represent HTTP input and use `class-validator`/`class-transformer`. Do not use entities as DTOs. Use `CreateXDto`, `UpdateXDto`, and `PartialType` where appropriate.
- **Entities:** represent TypeORM persistence and relationships; they must not contain HTTP or application logic.
- **Modules:** export only providers needed by other modules. Keep the controller, service, DTOs, and entities for a domain together.

Declare parameter and return types for every function and method. Avoid implicit `any`, deeply nested relative imports, and circular dependencies. Group imports consistently: internal aliases first when available, followed by external packages, matching the file's existing style.

Use conventional Nest naming:

- Classes: `PascalCase`.
- Variables and methods: `camelCase`.
- Constants: `UPPER_SNAKE_CASE`.
- DTOs: `CreateXDto`, `UpdateXDto`.
- Files: `kebab-case` with conventional suffixes (`.controller.ts`, `.service.ts`, `.module.ts`, `.entity.ts`, `.dto.ts`).

### Current API and Security

Currently implemented routes include:

- `POST /auth/login` with the local strategy.
- `GET /auth/me` with JWT.
- `GET /scans` and `GET /scans/:id` with project, date, status, and severity filters.
- `GET /findings` and `GET /findings/:id` with type, severity, scan, and tool filters.
- `GET /users`, `POST /users`, `PATCH /users/:id`, and `DELETE /users/:id`, protected for administrators.

`main.ts` enables CORS and a global `ValidationPipe` with `whitelist` and `forbidNonWhitelisted`. Preserve these protections when extending the API. Use `JwtAuthGuard` for authenticated resources and `RolesGuard`/`@Roles` for role authorization.

Services must throw appropriate Nest HTTP exceptions with useful messages that do not reveal internal information. Validate and transform route and query parameters to the expected types; do not accept unvalidated strings when the domain expects a UUID, number, date, status, or enum.

The `Scan` entity uses typed statuses and tools. `Finding` normalizes severity, source, location, description, and recommendation. When changing entities or relationships, review DTOs, services, seed data, tests, future migrations, and frontend views. `synchronize: true` is marked for development only; do not use it as a production migration strategy.

### Data and Configuration

- Inject configuration through `ConfigModule`/`ConfigService`.
- Do not hardcode credentials or secrets.
- Hash passwords with bcrypt; never store or return plaintext passwords.
- Keep entities and queries aligned with PostgreSQL and TypeORM.
- Consider project ownership/assignment for every route exposing scans or findings; authentication alone does not prove project-level authorization.
- Document every new variable in `.env.example`, and consume it through configuration.

## Main Frontend: Vue 3 + Vite

### Commands

Run from `apps/frontend`:

```bash
pnpm install
pnpm dev
pnpm build
pnpm run build-only
pnpm run type-check
pnpm run lint
pnpm run format
pnpm run test:unit
pnpm run test:e2e:dev
pnpm run test:e2e
```

`pnpm build` runs type-checking and the production build. `test:e2e` starts the preview at `http://localhost:4173` and Cypress uses that URL. Before delivery, test the production build, not only the development server.

### Architecture and Style

- Views are Vue SFCs in `src/views/`.
- Reusable components live in `src/components/`.
- Layouts live in `src/layouts/`.
- HTTP calls live in `src/services/`; use the existing Axios `httpClient`.
- Shared state lives in `src/stores/` with Pinia.
- Data contracts live in `src/interfaces/`.
- Routes are defined in `src/router/`; each route must point to a dedicated view.
- Use `<script setup lang="ts">` and explicit types for functions, parameters, and returns.
- Use the `@/` alias for imports from `src/`. Order imports with external packages before internal imports.
- Preserve the file's formatting style; current Vue code primarily uses single quotes and omits semicolons.

The HTTP client uses `VITE_API_URL`, falling back to `http://localhost:8000`, and attaches the Bearer token from `authStore`. Do not put tokens in URLs, logs, or visible text. Browser-exposed variables must use the `VITE_` prefix and must never contain server secrets.

Current route protection checks the token and administrator role for `/users`. When adding a protected view, define its metadata and update the router guard consistently. Do not rely only on frontend guards; the backend must enforce authorization as well.

### UI

Keep the interface focused on security operations: overview, scans, findings, detail views, and user administration. Reuse existing components and status/severity badges. Provide loading, empty, error, and permission-denied states. Do not hide API errors or display sensitive data. Preserve responsive behavior and avoid unnecessary global styles.

## `apps/frontend/code-sentinel-2` Subproject

This is a separate Next.js 16 + React 19 + TypeScript + Tailwind/shadcn application with its own `package.json` and lockfile. It is not the frontend served by `apps/frontend/Dockerfile` and is not automatically part of the Vue workflow.

Run from `apps/frontend/code-sentinel-2`:

```bash
pnpm install
pnpm run dev
pnpm run build
pnpm run start
pnpm run lint
```

Conventions for this subproject:

- App Router code lives under `app/`; parenthesized directories are route groups.
- React components live in `components/`; UI primitives live in `components/ui/`.
- Utilities and data live in `lib/`.
- Use existing components and utilities before introducing another library.
- Preserve strict TypeScript and the separation between Server Components and Client Components.
- Preserve metadata, typography, tokens, and theme from `app/layout.tsx` and `app/globals.css`.
- Use `lucide-react` icons when an appropriate icon already exists.
- Review accessibility and loading/error states together with responsive behavior.

Do not mix imports or scripts from the Next subproject with the Vue root application. If a feature must exist in both frontends, document the expected parity and validate each application with its own toolchain.

## Testing and Validation

Match validation effort to change risk:

| Change | Minimum validation |
| --- | --- |
| Backend service/controller/DTO | `pnpm run lint`, relevant unit tests, and `pnpm run test` |
| Backend auth, guards, or permissions | Authorization tests and `pnpm run test:e2e` |
| Entity, relationship, or query | Build, unit tests, and PostgreSQL/Compose testing when applicable |
| Vue component/view/store/service | `pnpm run type-check`, `pnpm run lint`, and a relevant unit test |
| Frontend flow or routing | `pnpm run build` and relevant Cypress e2e test |
| Docker, Nginx, or environment | `docker compose config` and the affected image's build/startup |
| Next subproject | `pnpm run lint` and `pnpm run build` from `code-sentinel-2` |

Run the smallest check that can falsify the change hypothesis first, then expand to lint, builds, and related tests. Report commands that could not run and why.

Do not change tests to hide a failure. If a test represents an obsolete contract, update the implementation and documentation first, then change the test only when the new behavior is intentional.

## Security and Privacy

Code Sentinel procesa informacion potencialmente sensible: codigo fuente, findings, credenciales detectadas y configuracion de proyectos.

- Do not send source code or findings to external services without an explicit product decision.
- Never store tokens or passwords in plaintext.
- Validate and authorize every backend access to projects, scans, and findings.
- Apply least privilege and do not return internal entity fields unnecessarily.
- Do not trust frontend data to decide roles, ownership, or permissions.
- Avoid logging Authorization headers, secrets, complete finding payloads, or sensitive paths.
- Keep CORS restricted and `JWT_SECRET` secure in production. The current `app.enableCors()` is suitable for development but must be reviewed before exposure.
- Do not download or execute scanning tools with user-controlled input without validating commands, paths, and permissions.
- Treat imported reports and files as untrusted data; validate their format, size, and location.

## Product Documentation and Requirements

Before changing functional behavior, consult the relevant documents:

- `docs/definition/business-problem.md` for the platform problem.
- `docs/definition/mvp-scope.md` for IN/OUT/LATER/UNKNOWN scope.
- `docs/definition/statement-of-work.md` for roles, requirements, security, authorization, reporting, and acceptance criteria.
- `docs/diagrams/architecture.md` and `docs/diagrams/modelosDeDatos.md` for architecture and data-model context.
- `docs/coding/backend-rules.md` and `docs/coding/frontend-rules.md` for normative rules.
- `docs/ai-usage/prompts/verify-rules.md` and `verify-acceptance-criteria.md` for review guidance.

The MVP includes authentication, projects, scans, statuses, history, SAST, secret scanning, normalization, findings, filters, and an overview. DAST, SCA, IaC, containers, automated remediation, mobile apps, and offline capture are out of scope unless explicitly approved. Port scanning, custom scanners, protected reports, multi-tenancy, SSO, and historical retention have different levels of definition; verify current scope before implementing them.

When changing a route, entity, variable, command, or user flow, update affected documentation. Do not invent acceptance criteria; mark open decisions as such.

## Delivery Checklist

Before finishing a change:

- [ ] Inspect nearby code, tests, and documentation.
- [ ] Confirm that the change stays within the correct application boundary.
- [ ] Cover types, DTOs, validation, authorization, and error handling as applicable.
- [ ] Ensure there are no secrets, sensitive data, or inappropriate logs.
- [ ] Update interfaces, routes, contracts, or documentation when required.
- [ ] Run the narrowest check first, followed by the necessary broader validation.
- [ ] Review `git diff` and `git status` to separate your changes from prior changes.
- [ ] Clearly report passed, skipped, and unavailable tests.

## Known Repository State

- Compose publishes the backend at `localhost:8000`, although the generated Nest README contains generic `localhost:3000` references; use the root README and Compose as the source of truth for integrated deployment.
- The engineering rules require `.env.example`, but the current file is empty; do not assume variables are documented there until it is updated.
- `TypeOrmModule` uses `synchronize: true` with a development-only note; production work must replace this with migrations or an approved strategy.
- The Vue frontend is the Compose `front` service. `code-sentinel-2` is a separate Next subproject and must not be confused with the artifact deployed by that Dockerfile.
- Always check `git status`: existing untracked files belong to the user's working state until confirmed otherwise.
