# Agent instructions

## Project overview

Authentication service for the Passport project. This is a monorepo containing:

- **backend/** - Cloudflare Workers authentication microservice (Hono + Neon Postgres + Drizzle)

## Technical stack

- **Package manager**: pnpm (workspace)

### Backend

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript (strict mode, ESNext target)
- **Framework**: Hono (lightweight web framework)
- **Database**: Neon PostgreSQL 18
- **ORM**: Drizzle ORM (beta version with relational queries)
- **Auth**: Role-based access control (user/admin roles) and third-party OAuth client support

## Workflow

1. Before performing any task or even any small action, always check for relevant skills.
2. After any code changes, always run `pnpm test:unit:ci` to verify all unit tests pass.
3. After any code changes, always run `pnpm test:typecheck` to verify there are no type errors in any package
4. After any code changes, always run `pnpm lint` to check code quality. Do not pass any arguments to the lint command and do not specify any files or directories.
5. After completing changes, update relevant README files (`README.md`, `backend/README.md`, `frontend/README.md`) and AGENTS.md files if any relevant information was added or modified. Keep them minimal and concise, without unnecessary details or explanations.
6. If changes affect project-specific skills (api, database, testing), review and update skill configurations to keep them aligned with the current implementation.
