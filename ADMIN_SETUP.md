# Admin Setup Guide

## Initial Setup

### Auth Providers

Auth providers (`anonymous` and `twitch`) are **automatically created** when you run migrations for the first time. This is handled by a custom seed migration.

After migration, you'll have:

- **Anonymous provider** — active by default, requires no configuration
- **Twitch provider** — inactive until you configure it in the admin UI

No manual SQL setup is required.

---

## How to Create First Admin User

Since all users are created with `role = 'user'` by default, you need to manually promote a user to admin.

### Option 1: Using Drizzle Studio (Recommended for Local Development)

1. Start Drizzle Studio:

   ```bash
   pnpm db:studio --config=drizzle.local.config.ts
   ```

2. Open `http://localhost:4983` in your browser

3. Navigate to the `users` table

4. Find your user by `id` or look at the most recent entries

5. Edit the user record and change `role` from `'user'` to `'admin'`

6. Save changes

### Option 2: Using SQL (Production)

For production D1 database on Cloudflare:

```bash
# Via wrangler CLI
wrangler d1 execute DB --command="UPDATE users SET role = 'admin' WHERE id = 'YOUR-USER-ID'"
```

### Option 3: Custom Migration (Advanced)

You can create a custom migration to promote a specific user to admin:

```bash
pnpm db:generate --custom --name promote_admin
```

Then edit the generated `migration.sql`:

```sql
UPDATE users SET role = 'admin' WHERE id = 'YOUR-USER-ID';
```

Apply with `pnpm db:migrate:local` (local) or `pnpm db:migrate` (production).

## Finding Your User ID

1. Login via the frontend (anonymous or Twitch)
2. Open browser DevTools → Network tab
3. Check the response from `GET /api/auth/session`
4. Copy the `id` field value

## Verifying Admin Access

After promoting a user to admin:

1. Refresh the frontend application
2. Navigate to `/admin/auth-providers`
3. You should see the admin panel with provider toggles
4. If you get redirected to `/`, the role update didn't work

## Security Notes

- Never hardcode admin credentials in the codebase
- Consider adding audit logging for admin actions
- Implement admin user management UI in the future
- Use environment variables or secrets for initial admin setup in production
