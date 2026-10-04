import type { Request, Response, NextFunction } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { Errors } from '../lib/errors';

function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const details: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!details[key]) details[key] = issue.message;
  }
  throw Errors.validation(Object.values(details)[0] ?? 'Invalid request.', details);
}

export const body = <S extends ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try { req.body = parse(schema, req.body ?? {}); next(); } catch (e) { next(e); }
  };

export const query = <S extends ZodTypeAny>(schema: S) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try { (req as Request & { q: z.infer<S> }).q = parse(schema, req.query); next(); } catch (e) { next(e); }
  };

export type WithQuery<S extends ZodTypeAny> = Request & { q: z.infer<S> };
