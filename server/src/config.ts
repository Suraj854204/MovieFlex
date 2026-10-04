import 'dotenv/config';
import crypto from 'crypto';

const env = process.env;
const NODE_ENV = env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const IS_TEST = NODE_ENV === 'test';

function required(name: string): string {
  const v = env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

let sessionSecret = env.SESSION_SECRET || '';
if (!sessionSecret) {
  if (IS_PROD) throw new Error('Missing required environment variable: SESSION_SECRET');
  sessionSecret = crypto.randomBytes(32).toString('hex');
  if (!IS_TEST) console.warn('[config] SESSION_SECRET not set — using a random one (sessions reset on restart).');
}
if (IS_PROD && sessionSecret.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters in production.');
}

const frontendUrls = (env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

const serveClient = (env.SERVE_CLIENT ?? (IS_PROD ? 'true' : 'false')) === 'true';

// Cookies: when the SPA is served by another origin (e.g. Vercel → Render) the
// session cookie must be SameSite=None; Secure. Same-origin deployments use Lax.
const sameSiteEnv = env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none' | undefined;
const sameSite: 'lax' | 'strict' | 'none' =
  sameSiteEnv || (IS_PROD && !serveClient ? 'none' : 'lax');

export const config = {
  nodeEnv: NODE_ENV,
  isProd: IS_PROD,
  isTest: IS_TEST,
  port: Number(env.PORT) || 4000,
  databaseUrl: IS_TEST ? (env.TEST_DATABASE_URL || required('DATABASE_URL')) : required('DATABASE_URL'),
  databaseSsl: (env.DATABASE_SSL || 'auto') as 'auto' | 'true' | 'false',
  databaseSslInsecure: env.DATABASE_SSL_INSECURE === 'true',
  dbPoolMax: Number(env.DB_POOL_MAX) || 10,
  sessionSecret,
  frontendUrls,
  serveClient,
  sameSite,
  cookieSecure: sameSite === 'none' ? true : IS_PROD,
  trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : (IS_PROD ? 1 : 0),
  autoMigrate: env.AUTO_MIGRATE !== 'false',
  sessionMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
  bcryptRounds: IS_TEST ? 4 : 12,
};
