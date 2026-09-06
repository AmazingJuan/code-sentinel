# Code Sentinel

Application composed of a Vue/Vite frontend, a NestJS backend, and PostgreSQL.

## Requirements

- Docker
- Docker Compose
- Node.js 24 or higher for local development
- pnpm

## Run with Docker

From the project root:

```bash
docker compose up --build
```

Available services:

- Frontend: http://localhost:3000
- Backend: http://localhost:8000
- PostgreSQL: available inside the Docker network at `db:5432`

To run the services in the background:

```bash
docker compose up --build -d
```

View the logs:

```bash
docker compose logs -f
```

Stop the services:

```bash
docker compose down
```

To also remove PostgreSQL's persisted data:

```bash
docker compose down -v
```

## Environment variables

Create a `.env` file in the project root to customize PostgreSQL:

```env
POSTGRES_DB=code_sentinel
POSTGRES_USER=code_sentinel
POSTGRES_PASSWORD=code_sentinel
```

If these variables are not defined, Compose uses the default values shown above.

## Local development

### Backend

```bash
cd apps/backend
pnpm install
pnpm run start:dev
```

The backend will be available at http://localhost:3000.

### Frontend

In another terminal:

```bash
cd apps/frontend
pnpm install
pnpm run dev
```

Vite will display the local URL in the terminal.

## Useful commands

Build the images without starting the services:

```bash
docker compose build
```

Check the Compose configuration:

```bash
docker compose config
```

Run backend tests:

```bash
cd apps/backend
pnpm test
pnpm test:e2e
```

Run frontend tests:

```bash
cd apps/frontend
pnpm test:unit
pnpm test:e2e
```
