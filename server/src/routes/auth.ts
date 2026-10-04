import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users } from '../db/schema';
import { config } from '../config';
import { Errors, isUniqueViolation, AppError } from '../lib/errors';
import { cleanText } from '../lib/sanitize';
import { randomAvatarColor } from '../lib/codes';
import { createSocketToken } from '../lib/tokens';
import { body } from '../middleware/validate';
import { authLimiter, signupLimiter } from '../middleware/security';
import { requireAuth } from '../middleware/auth';
import { selfUser } from '../services/userService';
import { logger } from '../lib/logger';

const router = Router();

const username = z.string().trim().toLowerCase()
  .min(3, 'Username must be at least 3 characters.').max(20, 'Username must be at most 20 characters.')
  .regex(/^[a-z0-9_]+$/, 'Use only letters, numbers and underscores.');
const email = z.string().trim().toLowerCase().max(254).email('Enter a valid email address.');
const password = z.string().min(8, 'Password must be at least 8 characters.').max(72, 'Password must be at most 72 characters.');
const displayName = z.string().transform(cleanText).pipe(z.string().min(1, 'Display name is required.').max(40, 'Display name is too long.'));

const signupSchema = z.object({ username, email, password, displayName: displayName.optional() });
const loginSchema = z.object({ identifier: z.string().trim().toLowerCase().min(1, 'Enter your email or username.').max(254), password: z.string().min(1, 'Enter your password.').max(200) });

// A real bcrypt hash of a random string: lets login spend the same time whether or not the user exists.
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser-' + Math.random(), config.bcryptRounds);

function startSession(req: import('express').Request, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {                       // new session id → no session fixation
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((e) => (e ? reject(e) : resolve()));
    });
  });
}

router.post('/signup', signupLimiter, body(signupSchema), async (req, res, next) => {
  try {
    const { username: uname, email: mail, password: pw, displayName: dn } = req.body as z.infer<typeof signupSchema>;
    const dup = await db.select({ username: users.username, email: users.email }).from(users)
      .where(or(eq(users.username, uname), eq(users.email, mail)));
    if (dup.length) {
      const details: Record<string, string> = {};
      if (dup.some((d) => d.username === uname)) details.username = 'That username is taken.';
      if (dup.some((d) => d.email === mail)) details.email = 'An account with this email already exists.';
      throw Errors.conflict(Object.values(details)[0], details);
    }
    const passwordHash = await bcrypt.hash(pw, config.bcryptRounds);
    let user;
    try {
      [user] = await db.insert(users).values({
        username: uname, email: mail, passwordHash, displayName: dn ?? uname, avatarColor: randomAvatarColor(),
      }).returning();
    } catch (err) {                                          // lost a race with a concurrent signup
      if (isUniqueViolation(err)) throw Errors.conflict('That username or email is already registered.');
      throw err;
    }
    await startSession(req, user.id);
    logger.info('auth:signup', { user: user.id });
    res.status(201).json({ ok: true, data: { user: selfUser(user) } });
  } catch (e) { next(e); }
});

router.post('/login', authLimiter, body(loginSchema), async (req, res, next) => {
  try {
    const { identifier, password: pw } = req.body as z.infer<typeof loginSchema>;
    const [user] = await db.select().from(users)
      .where(or(eq(users.email, identifier), eq(users.username, identifier))).limit(1);
    const valid = await bcrypt.compare(pw, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      logger.info('auth:login_failed', {});
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect email/username or password.');
    }
    await startSession(req, user.id);
    logger.info('auth:login', { user: user.id });
    res.json({ ok: true, data: { user: selfUser(user) } });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('mf.sid', { path: '/', httpOnly: true, secure: config.cookieSecure, sameSite: config.sameSite });
    res.json({ ok: true, data: {} });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, data: { user: selfUser(req.user!) } });
});

/** Short-lived token for the WebSocket handshake (avoids relying on third-party cookies). */
router.get('/socket-token', requireAuth, (req, res) => {
  res.json({ ok: true, data: { token: createSocketToken(req.user!.id) } });
});

router.post('/password', requireAuth, body(z.object({ currentPassword: z.string().min(1).max(200), newPassword: password })), async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
    if (!(await bcrypt.compare(currentPassword, req.user!.passwordHash))) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' });
    }
    await db.update(users).set({ passwordHash: await bcrypt.hash(newPassword, config.bcryptRounds) }).where(eq(users.id, req.user!.id));
    res.json({ ok: true, data: {} });
  } catch (e) { next(e); }
});

export default router;
