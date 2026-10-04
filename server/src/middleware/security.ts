import type { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { AppError } from '../lib/errors';

/**
 * CSRF defence for cookie auth, layered with SameSite cookies and JSON-only bodies:
 * state-changing requests that carry an Origin header must come from our own site.
 */
export function originGuard(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();   // non-browser clients (curl, server-to-server) — no ambient cookies to abuse
  if (config.frontendUrls.includes(origin)) return next();
  try { if (new URL(origin).host === req.headers.host) return next(); } catch { /* fall through */ }
  next(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.'));
}

const scale = config.isTest ? 1000 : 1;

const limiter = (windowMs: number, limit: number, message: string, extra: Partial<Parameters<typeof rateLimit>[0]> = {}) =>
  rateLimit({
    windowMs, limit: limit * scale, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ ok: false, error: { code: 'RATE_LIMITED', message } }); },
    ...extra,
  });

export const apiLimiter  = limiter(60_000, 400, 'Too many requests. Please slow down.');
export const authLimiter = limiter(15 * 60_000, 20, 'Too many attempts. Please try again in a few minutes.', { skipSuccessfulRequests: true });
export const signupLimiter = limiter(60 * 60_000, 15, 'Too many accounts created from this network. Try again later.');
