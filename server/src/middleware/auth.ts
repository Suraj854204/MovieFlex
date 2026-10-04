import type { NextFunction, Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { Errors } from '../lib/errors';

/** Loads the signed-in user from the session or rejects with 401. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    if (!userId) throw Errors.unauthenticated();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      await new Promise<void>((r) => req.session.destroy(() => r()));
      throw Errors.unauthenticated('Your session has expired. Please sign in again.');
    }
    req.user = user;
    // Cheap "last seen" bump, at most once per minute per user.
    if (Date.now() - user.lastSeenAt.getTime() > 60_000) {
      void db.update(users).set({ lastSeenAt: sql`now()` }).where(eq(users.id, user.id)).catch(() => {});
    }
    next();
  } catch (err) { next(err); }
}
