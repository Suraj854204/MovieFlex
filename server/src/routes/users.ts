import { Router } from 'express';
import { alias } from 'drizzle-orm/pg-core';
import { and, desc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { users, roomMembers, rooms } from '../db/schema';
import { cleanText } from '../lib/sanitize';
import { body, query, type WithQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { publicUser, selfUser } from '../services/userService';
import { presence } from '../realtime/presence';

const router = Router();
router.use(requireAuth);

const patchSchema = z.object({
  displayName: z.string().transform(cleanText).pipe(z.string().min(1, 'Display name is required.').max(40)).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid colour.').optional(),
});

router.patch('/me', body(patchSchema), async (req, res, next) => {
  try {
    const patch = req.body as z.infer<typeof patchSchema>;
    if (!Object.keys(patch).length) return void res.json({ ok: true, data: { user: selfUser(req.user!) } });
    const [u] = await db.update(users).set(patch).where(eq(users.id, req.user!.id)).returning();
    res.json({ ok: true, data: { user: selfUser(u) } });
  } catch (e) { next(e); }
});

const searchSchema = z.object({ q: z.string().trim().min(2).max(30) });
router.get('/search', query(searchSchema), async (req, res, next) => {
  try {
    const { q } = (req as WithQuery<typeof searchSchema>).q;
    const pat = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const rows = await db.select().from(users)
      .where(and(ne(users.id, req.user!.id), or(ilike(users.username, pat), ilike(users.displayName, pat))))
      .limit(8);
    res.json({ ok: true, data: { users: rows.map((u) => ({ ...publicUser(u), online: presence.isOnline(u.id) })) } });
  } catch (e) { next(e); }
});

/** "Watched with": people who share a room with you, most recent first. */
router.get('/friends', async (req, res, next) => {
  try {
    const mine = alias(roomMembers, 'mine');
    const rows = await db
      .select({
        id: users.id, username: users.username, displayName: users.displayName, avatarColor: users.avatarColor,
        shared: sql<number>`count(distinct ${roomMembers.roomId})::int`,
        lastActive: sql<Date>`max(${rooms.lastActiveAt})`,
      })
      .from(mine)
      .innerJoin(roomMembers, and(eq(roomMembers.roomId, mine.roomId), ne(roomMembers.userId, mine.userId)))
      .innerJoin(users, eq(users.id, roomMembers.userId))
      .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
      .where(and(eq(mine.userId, req.user!.id), eq(mine.banned, false), eq(roomMembers.banned, false)))
      .groupBy(users.id)
      .orderBy(desc(sql`max(${rooms.lastActiveAt})`))
      .limit(24);
    res.json({ ok: true, data: { friends: rows.map((r) => ({ ...publicUser(r), sharedRooms: r.shared, online: presence.isOnline(r.id) })) } });
  } catch (e) { next(e); }
});

export default router;
