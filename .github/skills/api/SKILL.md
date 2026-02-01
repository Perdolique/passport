---
name: api
description: API endpoints reference for the "passport" service. Use when working with routes, adding new endpoints, understanding request/response formats, or debugging API behavior.
---

# API Endpoints

## Health Check

- **GET** `/` - Returns service status

## Authentication

### Anonymous Authentication

- **POST** `/auth/anonymous` - Create anonymous user and session
  - Response: `{ userId, isAnonymous, expiresAt }`

### Twitch OAuth

- **GET** `/auth/twitch` - Initiate Twitch OAuth flow (PKCE)
  - Query params: `redirect_uri` (optional), `link` (optional, set to "true" for linking mode)
  - Redirects to Twitch authorization page

- **GET** `/auth/twitch/callback` - Handle OAuth callback
  - Query params: `code`, `state`
  - Response: `{ userId, sessionToken }`

### Session Management

- **GET** `/auth/session` - Get current user session
  - Auth: Required (session cookie or Bearer token)
  - Response: `{ id, role, twitchUser? }`

- **POST** `/auth/logout` - Logout and invalidate session
  - Auth: Required
  - Response: `{ success: true }`

## Admin

All admin endpoints require authentication and admin role.

- **GET** `/admin/auth-providers` - Get list of authentication providers
  - Auth: Required (admin only)
  - Response: `{ providers: [{ id, name, type, isActive }] }`

- **PATCH** `/admin/auth-providers/:id` - Update auth provider status
  - Auth: Required (admin only)
  - Body: `{ isActive: boolean }`
  - Response: `{ provider: { id, name, type, isActive } }`
