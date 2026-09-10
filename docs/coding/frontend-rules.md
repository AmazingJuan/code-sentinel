# Frontend Development Rules

## Essential Rules

These rules are mandatory and apply across the entire frontend codebase.

### Typed Functions

All methods and functions must define parameter types and return types.

- No implicit `any`.
- Every parameter must have an explicit type.
- Every function must have an explicit return type.

### Route–View Mapping

Every route must be associated with a view component.

- No orphan routes.
- Routes must always point to a dedicated view.

### Single File Components

Every view must be implemented as a Vue Single File Component (SFC).

- Views must use the `.vue` extension.

### Environment Variables

Every environment variable must be defined in an `.env` file.

- Provide an `.env.example` file for documentation.
- Variables exposed to the client must use the `VITE_` prefix.

### Imports

Imports must be grouped and ordered consistently.

Within each group, imports must be in alphabetical order:

1. External packages.
2. Internal application imports using the `@/` alias.

The `@/` path alias must be used for imports from `src/`.

### Formatting and Linting

Before committing changes, run:

```bash
npm run format
npm run lint
