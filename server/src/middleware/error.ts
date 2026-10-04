import type { NextFunction, Request, Response } from 'express';
import { AppError, isUniqueViolation } from '../lib/errors';
import { logger } from '../lib/logger';

export function notFoundApi(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, 'NOT_FOUND', 'That endpoint does not exist.'));
}

/** Central error → consistent JSON. Stack traces never reach the client. */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  const e = err as { type?: string; status?: number };
  if (err instanceof AppError) {
    return void res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, details: err.details } });
  }
  if (e?.type === 'entity.parse.failed') {
    return void res.status(400).json({ ok: false, error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
  }
  if (e?.type === 'entity.too.large') {
    return void res.status(413).json({ ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' } });
  }
  if (isUniqueViolation(err)) {
    return void res.status(409).json({ ok: false, error: { code: 'CONFLICT', message: 'That already exists.' } });
  }
  logger.error('http:unhandled', { method: req.method, path: req.path, message: (err as Error)?.message, stack: (err as Error)?.stack });
  res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' } });
}
