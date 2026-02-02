import { defineConfig } from 'drizzle-kit';

if (process.env.CLOUDFLARE_ACCOUNT_ID === undefined) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID is not defined in environment variables');
}

if (process.env.CLOUDFLARE_DATABASE_ID === undefined) {
  throw new Error('CLOUDFLARE_DATABASE_ID is not defined in environment variables');
}

if (process.env.CLOUDFLARE_D1_TOKEN === undefined) {
  throw new Error('CLOUDFLARE_D1_TOKEN is not defined in environment variables');
}

export default defineConfig({
  dialect: 'sqlite',
  driver: 'd1-http',
  out: './migrations',
  schema: './src/db/schema.ts',

  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID,
    token: process.env.CLOUDFLARE_D1_TOKEN,
  },
});
