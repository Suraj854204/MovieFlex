// Minimal structured logger. Never pass passwords, tokens or secrets in `meta`.
type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN: Level = (process.env.LOG_LEVEL as Level) || (process.env.NODE_ENV === 'test' ? 'error' : 'info');

const REDACT = /pass(word)?|token|secret|cookie|authorization|database_url/i;

function clean(meta?: Record<string, unknown>) {
  if (!meta) return '';
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) out[k] = REDACT.test(k) ? '[redacted]' : v;
  return ' ' + JSON.stringify(out);
}

function log(level: Level, event: string, meta?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[MIN]) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${event}${clean(meta)}`;
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
}

export const logger = {
  debug: (e: string, m?: Record<string, unknown>) => log('debug', e, m),
  info:  (e: string, m?: Record<string, unknown>) => log('info', e, m),
  warn:  (e: string, m?: Record<string, unknown>) => log('warn', e, m),
  error: (e: string, m?: Record<string, unknown>) => log('error', e, m),
};
