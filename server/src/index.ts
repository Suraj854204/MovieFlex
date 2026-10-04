import { config } from './config';
import { pool } from './db';
import { runMigrations } from './db/migrate';
import { buildServer, startMaintenance } from './server';
import { registry } from './realtime/registry';
import { persistNow } from './services/roomService';
import { logger } from './lib/logger';

async function main() {
  if (config.autoMigrate) await runMigrations();
  const { server, io } = buildServer();
  const stopMaintenance = startMaintenance();

  server.listen(config.port, () => {
    logger.info('server:listening', { port: config.port, env: config.nodeEnv, serveClient: config.serveClient, origins: config.frontendUrls });
  });

  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return; closing = true;
    logger.info('server:shutdown', { signal });
    stopMaintenance();
    // Persist every live room's playback position before the process exits.
    await Promise.allSettled(registry.all().map((r) => persistNow(r)));
    io.close(() => server.close(async () => { await pool.end().catch(() => {}); process.exit(0); }));
    setTimeout(() => process.exit(0), 8000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error('process:unhandled_rejection', { reason: String(reason) }));
}

main().catch((err) => { console.error('Fatal startup error:', err); process.exit(1); });
