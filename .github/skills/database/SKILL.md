---
name: database
description: |
  Database operations for passport project.
  Use when: working with database, schemas, tables, migrations, queries in this project.
---

# Database

This skill contains project-specific database configuration and patterns for passport.

## Stack

- **Database**: SQLite
- **ORM**: Drizzle ORM

## Project Structure

- `src/db/schema.ts` - Database schema definitions
- `src/db/client.ts` - Database client initialization
- `drizzle/` - Migration files
- `drizzle.config.ts` - Drizzle Kit configuration

## Commands

```bash
pnpm db              # Drizzle Kit CLI (runs drizzle-kit)
pnpm db:generate     # Generate migration from schema changes
pnpm db:push:local   # Push schema to local D1 (fast, no migration files)
pnpm db:migrate:local # Apply migrations to local D1
pnpm db:migrate      # Apply migrations to production D1
pnpm db:studio       # Open Drizzle Studio
```

## Custom Migrations

To create a custom migration (e.g., for seed data):

```bash
pnpm db:generate --custom --name my_custom_migration
```

This creates an empty `migration.sql` file where you can write custom SQL. Use `INSERT OR IGNORE` for idempotency.

**Example seed migration:** `migrations/20260201145801_seed_initial_data/migration.sql`

## Initial Data

The project includes a seed migration that automatically populates:

- Auth providers (`anonymous`, `twitch`)

This runs when you first apply migrations with `pnpm db:migrate:local` or `pnpm db:migrate`.

## References

- [references/schema.md](references/schema.md) - Project schema documentation
- [references/queries.md](references/queries.md) - Common query patterns
