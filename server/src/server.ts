import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Server } from 'socket.io';
import { sql, lt } from 'drizzle-orm';

import { config } from './config';
import { db, pool } from './db';
import { userSessions } from './db/schema';
import { logger } from './lib/logger';
import { originGuard, apiLimiter } from './middleware/security';
import { errorHandler, notFoundApi } from './middleware/error';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import roomsRouter from './routes/rooms';
import { historyRouter, notificationsRouter } from './routes/misc';
import { setIO } from './realtime/io';
import { attachSocketServer } from './realtime/socket';
import { registry } from './realtime/registry';
import { presence } from './realtime/presence';
import { pruneNotifications } from './services/notificationService';
import { pruneStaleRooms } from './services/roomService';

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => cb(null, !origin || config.frontendUrls.includes(origin)),
  credentials: true,
};

export function buildServer() {
  const app = express();
  const server = http.createServer(app);

  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // The CSP only matters when this server also serves the SPA (single-service mode).
    contentSecurityPolicy: config.serveClient ? {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://www.youtube.com', 'https://s.ytimg.com'],
        'frame-src': ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
        'img-src': ["'self'", 'data:', 'https://i.ytimg.com', 'https://*.ytimg.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'connect-src': ["'self'", 'wss:', 'ws:', ...config.frontendUrls],
      },
    } : false,
  }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: '16kb' }));

  // ── Sessions (HTTP-only cookie, Postgres-backed so they survive restarts) ────
  const PgStore = connectPgSimple(session);
  app.use(session({
    name: 'mf.sid',
    store: new PgStore({ pool, tableName: 'user_sessions', createTableIfMissing: false, pruneSessionInterval: false }),
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,                       // active users stay signed in
    cookie: { httpOnly: true, secure: config.cookieSecure, sameSite: config.sameSite, maxAge: config.sessionMaxAgeMs },
  }));

  // ── Health ──────────────────────────────────────────────────────────────────
  const health: express.RequestHandler = async (_req, res) => {
    try {
      await pool.query('select 1');
      res.json({ status: 'ok', db: 'up', uptime: Math.round(process.uptime()), liveRooms: registry.size(), online: presence.onlineCount() });
    } catch {
      res.status(503).json({ status: 'degraded', db: 'down' });
    }
  };
  app.get('/health', health);
  app.get('/api/health', health);

  // ── REST API ────────────────────────────────────────────────────────────────
  app.use('/api', apiLimiter, originGuard);
  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/history', historyRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api', notFoundApi);

  // ── Optional: serve the built SPA from this same service ────────────────────
  if (config.serveClient) {
    const dist = path.resolve(__dirname, '../../client/dist');
    if (fs.existsSync(path.join(dist, 'index.html'))) {
      app.use(express.static(dist, {
        index: false,
        setHeaders: (res, file) => {
          if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        },
      }));
      app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(dist, 'index.html')); });
    } else {
      logger.warn('static:missing', { dist });
    }
  }

  app.use(errorHandler);

  // ── Socket.IO ───────────────────────────────────────────────────────────────
  const io = new Server(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 10_000,           // events are tiny; reject anything large
    pingInterval: 20_000,
    pingTimeout: 20_000,
  });
  setIO(io);
  attachSocketServer(io);

  return { app, server, io };
}

/** Periodic housekeeping. Returns a stop function. */
export function startMaintenance(): () => void {
  const run = async () => {
    try {
      await db.delete(userSessions).where(lt(userSessions.expire, sql`now()`));
      await pruneNotifications();
      await pruneStaleRooms();
    } catch (err) { logger.warn('maintenance:failed', { message: (err as Error).message }); }
  };
  const t = setInterval(run, 6 * 60 * 60 * 1000);
  t.unref();
  void run();
  return () => clearInterval(t);
}
