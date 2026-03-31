# @copilot/db

This package contains the production-target database schema.

The current first slice in `apps/web` intentionally uses a file-backed store so the end-to-end demo can run immediately.

Next step after the demo slice is accepted:
- generate Prisma client
- implement a repository layer
- replace the file store with Postgres-backed repositories
