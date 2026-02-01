# Passport Backend

Authentication microservice for the Passport project. Handles anonymous user creation and OAuth authentication.

## Features

- 🔐 Anonymous authentication for quick onboarding
- 🎮 Twitch OAuth with PKCE support
- 🔗 Account linking (attach OAuth providers to existing users)
- 🍪 Secure session management with HTTP-only cookies
- 📦 OAuth2 Authorization Server (for "Login with Passport")

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- Cloudflare account (for deployment)

### Installation

From the monorepo root:

```bash
pnpm install
```

### Environment Variables

The project uses two configuration sources:

**1. `.env` file** (in monorepo root) — for secrets (gitignored):

```env
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
SESSION_SECRET=generate_a_random_32_char_string_here
```

**2. `wrangler.jsonc`** — for non-secret variables:

```jsonc
"vars": {
  "TWITCH_REDIRECT_URI": "http://localhost:8787/auth/twitch/callback"
}
```

### Development

From the monorepo root:

```bash
pnpm dev
```

Or from the backend directory:

```bash
cd backend
pnpm dev
```

Server starts at `http://localhost:8787`

### Database

From the monorepo root:

```bash
pnpm db:generate      # Generate migrations from schema changes
pnpm db:push:local    # Push schema to local D1 (development, fast)
pnpm db:migrate:local # Apply migrations to local D1
pnpm db:migrate       # Apply migrations (production)
pnpm db:studio        # Open Drizzle Studio GUI
```

Or from the backend directory:

```bash
cd backend
pnpm db:generate
pnpm db:push:local
pnpm db:migrate:local
pnpm db:migrate
pnpm db:studio
```

#### Initial Data (Seed Migration)

The project includes a custom seed migration that populates initial auth providers:

- **Anonymous provider** (active by default)
- **Twitch provider** (inactive, requires configuration via admin UI)

This migration runs automatically when you first apply migrations:

```bash
pnpm db:migrate:local  # For local development
pnpm db:migrate        # For production
```

The migration is **idempotent** and safe to re-run multiple times.

**Note:** Twitch provider requires valid credentials to be configured. Update the provider in the admin UI (`/admin/auth-providers`) or directly in the database using Drizzle Studio.

## API Endpoints

### Health Check

```
GET /
```

Returns service status.

---

### Anonymous Authentication

```
POST /auth/anonymous
```

Creates an anonymous user and session. Sets `session_token` cookie.

**Response:**

```json
{
  "userId": "uuid",
  "isAnonymous": true,
  "expiresAt": "2026-03-01T00:00:00.000Z"
}
```

---

### Twitch OAuth

#### Initiate Flow

```
GET /auth/twitch
```

Redirects to Twitch authorization page with PKCE.

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `link` | string | Set to `"true"` to link Twitch to existing authenticated user |

#### Callback

```
GET /auth/twitch/callback
```

Handles OAuth callback from Twitch. Creates user/session or links account.

**Response:**

```json
{
  "userId": "uuid",
  "isAnonymous": false,
  "linked": false,
  "twitchUser": {
    "id": "12345",
    "login": "username",
    "displayName": "Username",
    "profileImageUrl": "https://..."
  }
}
```

---

### Session Management

#### Validate Session

```
GET /auth/session
```

Returns current user info from session cookie or `Authorization: Bearer <token>` header.

**Response:**

```json
{
  "userId": "uuid",
  "isAnonymous": false,
  "expiresAt": "2026-03-01T00:00:00.000Z"
}
```

#### Logout

```
POST /auth/logout
```

Invalidates current session and clears cookie.

**Response:**

```json
{
  "success": true
}
```

---

### OAuth2 Authorization Server

For external services using "Login with Passport".

#### Authorization Endpoint

```
GET /oauth/authorize
```

**Query Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `response_type` | string | Yes | Must be `"code"` |
| `client_id` | string | Yes | Registered client ID |
| `redirect_uri` | string | Yes | Must match registered URI |
| `state` | string | No | CSRF protection (recommended) |
| `scope` | string | No | Requested scopes |
| `code_challenge` | string | No | PKCE challenge |
| `code_challenge_method` | string | No | `"S256"` or `"plain"` |

#### Token Endpoint

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

**For Authorization Code:**

| Name | Type | Description |
|------|------|-------------|
| `grant_type` | string | `"authorization_code"` |
| `code` | string | Authorization code |
| `redirect_uri` | string | Must match authorize request |
| `client_id` | string | Client ID |
| `client_secret` | string | Client secret |
| `code_verifier` | string | PKCE verifier (if challenge was used) |

**For Refresh Token:**

| Name | Type | Description |
|------|------|-------------|
| `grant_type` | string | `"refresh_token"` |
| `refresh_token` | string | Refresh token |
| `client_id` | string | Client ID |
| `client_secret` | string | Client secret |

## OAuth Flow Example

### 1. Anonymous → Twitch Linking

```bash
# 1. Create anonymous user
curl -X POST http://localhost:8787/auth/anonymous

# 2. Link Twitch account (with session cookie from step 1)
# Redirect user to:
http://localhost:8787/auth/twitch?link=true
```

### 2. Direct Twitch Authentication

```bash
# Redirect user to start OAuth flow
http://localhost:8787/auth/twitch
```

## Deployment

From the monorepo root:

```bash
pnpm deploy
```

Or from the backend directory:

```bash
cd backend
pnpm deploy
```

Configure production secrets in Cloudflare dashboard or via:

```bash
wrangler secret put TWITCH_CLIENT_ID
wrangler secret put TWITCH_CLIENT_SECRET
wrangler secret put TWITCH_REDIRECT_URI
wrangler secret put SESSION_SECRET
```

## Testing

From the monorepo root:

```bash
pnpm test:typecheck  # Type checking
pnpm test:unit       # Unit tests (watch mode)
pnpm test:unit:ci    # Unit tests (CI mode)
```

Or from the backend directory:

```bash
cd backend
pnpm test:typecheck
pnpm test:unit
pnpm test:unit:ci
```

## License

Unlicense
