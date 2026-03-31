# @copilot/db

This package contains the Prisma schema, migrations directory, generated client wrapper, and database access scaffolding for the Postgres-backed path.

The first slice still defaults to the file-backed repository in `apps/web`, but `COPILOT_FIRST_SLICE_BACKEND=prisma` now opts the web app into the Prisma-backed repository for the first-slice workflows.

## Local Prisma Workflow

If you are using the bundled `docker-compose.yml` defaults, `DATABASE_URL` can stay unset and Prisma will use `postgresql://copilot:copilot@localhost:5432/conference_copilot`.

Typical local setup:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm --filter @copilot/db prisma db push
```

The package exports:

- `DEFAULT_DATABASE_URL`
- `resolveDatabaseUrl()`
- `createPrismaClient()`
- `getPrismaClient()`
- `disconnectPrismaClient()`

Business logic still belongs outside this package. Repository behavior stays in `apps/web`.
