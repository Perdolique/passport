# Schema

Database schema for passport.

## Tables

### users

User accounts (both anonymous and linked via OAuth).

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID v4 |
| `is_anonymous` | INTEGER (boolean) | True for anonymous users, false after OAuth linking |
| `role` | TEXT | User role ('user' or 'admin'), defaults to 'user' |
| `created_at` | INTEGER (timestamp) | Account creation time |

### sessions

Active user sessions with hashed tokens.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID v4 |
| `token_hash` | TEXT (unique) | SHA-256 hash of session token |
| `user_id` | TEXT (FK → users) | Owner user, cascades on delete |
| `expires_at` | INTEGER (timestamp) | Session expiration (30 days from creation) |
| `created_at` | INTEGER (timestamp) | Session creation time |

### oauth_accounts

Links external OAuth providers to users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | TEXT (PK) | UUID v4 |
| `provider` | TEXT | Provider name ('twitch', etc.) |
| `provider_user_id` | TEXT | User ID from provider |
| `user_id` | TEXT (FK → users) | Linked user, cascades on delete |
| `access_token` | TEXT | OAuth access token |
| `refresh_token` | TEXT (nullable) | OAuth refresh token |
| `token_expires_at` | INTEGER (timestamp, nullable) | Token expiration |
| `created_at` | INTEGER (timestamp) | Record creation time |
| `updated_at` | INTEGER (timestamp) | Last update time |

## Relations

- `users` → `sessions`: one-to-many
- `users` → `oauth_accounts`: one-to-many

## Schema Location

Source: `src/db/schema.ts`
