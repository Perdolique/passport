# Agent instructions

## Project overview

Authentication service for the Passport project. This is a monorepo containing:

- **backend/** - Cloudflare Workers authentication microservice (Hono + D1 + Drizzle)
- **frontend/** - Nuxt 4 web application

## Language requirements

All generated code, comments, documentation, commit messages, and any other content must be written in English.

## Technical stack

### Backend

- **Runtime**: Cloudflare Workers
- **Language**: TypeScript (strict mode, ESNext target)
- **Framework**: Hono (lightweight web framework)
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM (beta version with relational queries)
- **Auth**: Role-based access control (user/admin roles)

### Frontend

- **Framework**: Nuxt 4 (Vue 3)
- **Language**: TypeScript
- **Styling**: Modern CSS (native features)

### Shared

- **Package manager**: pnpm (workspace)

## Development commands

All commands should be run from the monorepo root:

```bash
# Backend
pnpm dev              # Start backend dev server
pnpm deploy           # Deploy backend to Cloudflare
pnpm test:unit        # Run backend unit tests in watch mode
pnpm test:unit:ci     # Run backend unit tests in CI mode (non-interactive)

# Frontend
pnpm dev:frontend     # Start frontend dev server

# Workspace
pnpm test:typecheck   # Run TypeScript type checking for all packages

# Database (backend)
pnpm db:generate      # Generate migrations
pnpm db:push          # Push schema changes
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio
```

## Workflow

1. Before performing any task or even any small action, always check for relevant skills.
2. After any code changes, always run `pnpm test:typecheck` to verify there are no type errors in any package.
3. After backend code changes, always run `pnpm test:unit:ci` to verify all unit tests pass.
4. After changes to database schema (`backend/src/db/schema.ts`), run `pnpm db:generate` to generate migrations.
5. After completing changes, update relevant README files (`README.md`, `backend/README.md`, `frontend/README.md`) and AGENTS files if any relevant information was added or modified.
6. If changes affect project-specific skills (api, database, testing), review and update skill configurations to keep them aligned with the current implementation.
