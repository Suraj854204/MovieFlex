import path from 'path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';
import { logger } from '../lib/logger';

/** Applies SQL migrations from server/drizzle. Safe to run on every boot. */
export async function runMigrations(): Promise<void> {
  const folder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder: folder });
  logger.info('db:migrated');
}

// `npm run db:migrate`
if (require.main === module) {
  runMigrations()
    .then(() => pool.end())
    .catch((err) => { console.error(err); process.exit(1); });
}
