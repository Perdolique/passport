# Passport authentication service

Authentication microservice for the Passport project. This is a monorepo containing backend, frontend, and a local OAuth consumer test app.

## Project Structure

```text
passport/
└── backend/         # Cloudflare Workers backend (Hono + Neon Postgres + Drizzle)
```

## Quick Start

### Prerequisites

- Node.js 24
- pnpm
- Cloudflare account
- Neon PostgreSQL database

### Installation

```bash
pnpm install
```

### Development

Start the backend service:

```bash
pnpm dev:backend
```

## License

Unlicense
