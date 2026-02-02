# Passport

Authentication microservice for the Passport project. This is a monorepo containing the backend service and frontend application.

## Project Structure

```text
passport/
├── backend/         # Cloudflare Workers backend (Hono + D1 + Drizzle)
└── frontend/        # Nuxt 4 frontend application
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account (for backend deployment)

### Installation

```bash
pnpm install
```

### Development

Start the backend service:

```bash
pnpm dev
```

Start the frontend application:

```bash
pnpm dev:frontend
```

## Backend

Authentication microservice built with Cloudflare Workers.

**Features:**

- 🔐 Anonymous authentication
- 🎮 Twitch OAuth with PKCE support
- 🔗 Account linking
- 🍪 Secure session management
- 📦 OAuth2 Authorization Server
- 👑 Admin panel for authentication provider management

**Tech Stack:** Cloudflare Workers, Hono, D1 (SQLite), Drizzle ORM

👉 See [backend/README.md](backend/README.md) for detailed API documentation and setup instructions.

## Frontend Application

Modern web application built with Nuxt 4.

**Features:**

- ⚡️ Nuxt 4 (Vue 3)
- 🎨 Modern CSS (native features, no preprocessors)
- 🔐 Authentication integration
- 🎯 Type-safe composables

👉 See [frontend/README.md](frontend/README.md) for frontend-specific documentation.

## Available Commands

### Backend Commands

```bash
pnpm dev              # Start backend dev server (http://localhost:8787)
pnpm deploy           # Deploy backend to Cloudflare
pnpm test:unit        # Run backend unit tests (watch mode)
pnpm test:unit:ci     # Run backend unit tests (CI mode)
```

### Workspace

```bash
pnpm test:typecheck   # Run TypeScript type checking (all packages)
pnpm lint             # Run oxlint code quality checks
```

### Database Commands

```bash
pnpm db:generate      # Generate migrations from schema changes
pnpm db:push          # Push schema to local D1 (development)
pnpm db:migrate       # Apply migrations (production)
pnpm db:studio        # Open Drizzle Studio GUI
```

### Frontend Commands

```bash
pnpm dev:frontend     # Start frontend dev server
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Twitch OAuth
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# Session Secret
SESSION_SECRET=generate_a_random_32_char_string_here
```

See backend and frontend README files for additional configuration options.

## License

Unlicense
