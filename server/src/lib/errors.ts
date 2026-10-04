export type ErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'RATE_LIMITED' | 'INTERNAL' | 'INVALID_CREDENTIALS' | 'ROOM_NOT_FOUND' | 'ROOM_FULL'
  | 'ROOM_LOCKED' | 'PASSWORD_REQUIRED' | 'INVALID_PASSWORD' | 'BANNED' | 'NOT_MEMBER'
  | 'VIDEO_UNAVAILABLE' | 'INVALID_VIDEO' | 'ORIGIN_NOT_ALLOWED' | 'BAD_JSON' | 'PAYLOAD_TOO_LARGE';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string>,
  ) { super(message); }
}

export const Errors = {
  validation: (message: string, details?: Record<string, string>) => new AppError(400, 'VALIDATION_ERROR', message, details),
  unauthenticated: (message = 'Please sign in to continue.') => new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have permission to do that.') => new AppError(403, 'FORBIDDEN', message),
  notFound: (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message),
  conflict: (message: string, details?: Record<string, string>) => new AppError(409, 'CONFLICT', message, details),
  roomNotFound: () => new AppError(404, 'ROOM_NOT_FOUND', 'This room does not exist. Check the code and try again.'),
  rateLimited: (message = 'Too many requests. Please slow down.') => new AppError(429, 'RATE_LIMITED', message),
};

/** Postgres unique-violation helper. */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}
