import { defineConfig } from 'drizzle-kit';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

// Find the local wrangler D1 database file
const dbDir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
let dbPath = '';

try {
  const files = readdirSync(dbDir);
  const dbFile = files.find(file => file.endsWith('.sqlite'));

  if (dbFile === undefined) {
    throw new Error('No .sqlite file found');
  }

  dbPath = join(dbDir, dbFile);
} catch (error) {
  throw new Error(
    'Local D1 database not found. Please run "pnpm dev" first to create the local database.', { cause: error }
  );
}

export default defineConfig({
  dialect: 'sqlite',
  out: './migrations',
  schema: './src/db/schema.ts',

  dbCredentials: {
    url: `file:${dbPath}`,
  },
});
