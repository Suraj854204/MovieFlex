import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import * as schema from './schema';
import { logger } from '../lib/logger';

// Neon / Supabase / most hosted Postgres require TLS. Local Postgres does not.
const connString = config.databaseUrl;
const needsSSL =
  config.databaseSsl === 'true' ||
  (config.databaseSsl === 'auto' &&
    /sslmode=require|\.neon\.tech|\.supabase\.|\.render\.com/.test(connString));

export const pool = new Pool({
  connectionString: connString,
  ssl: needsSSL ? { rejectUnauthorized: !config.databaseSslInsecure } : undefined,
  max: config.dbPoolMax,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Without a handler an idle-client error (e.g. Neon scaling to zero) would crash the process.
pool.on('error', (err) => logger.error('db:pool_error', { message: err.message }));

export const db = drizzle(pool, { schema });
export type DB = typeof db;
