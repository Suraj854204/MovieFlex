import { and, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { db } from '../db';
import { notifications } from '../db/schema';
import { emitToUser } from '../realtime/io';

export interface NotificationInput { type: string; title: string; body?: string; link?: string }

const toPayload = (n: typeof notifications.$inferSelect) => ({
  id: n.id, type: n.type, title: n.title, body: n.body, link: n.link,
  read: !!n.readAt, createdAt: n.createdAt,
});

export async function notify(userId: string, input: NotificationInput) {
  const [row] = await db.insert(notifications).values({
    userId, type: input.type, title: input.title.slice(0, 120),
    body: (input.body ?? '').slice(0, 240), link: input.link ?? null,
  }).returning();
  emitToUser(userId, 'notification:new', toPayload(row));
  return row;
}

export async function listNotifications(userId: string, limit = 30) {
  const rows = await db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt)).limit(limit);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return { items: rows.map(toPayload), unread: count };
}

export async function markRead(userId: string, ids?: string[]) {
  const where = ids?.length
    ? and(eq(notifications.userId, userId), isNull(notifications.readAt), inArray(notifications.id, ids))
    : and(eq(notifications.userId, userId), isNull(notifications.readAt));
  await db.update(notifications).set({ readAt: new Date() }).where(where);
}

export async function deleteNotification(userId: string, id: string) {
  await db.delete(notifications).where(and(eq(notifications.userId, userId), eq(notifications.id, id)));
}

export async function pruneNotifications() {
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  await db.delete(notifications).where(and(lt(notifications.createdAt, cutoff), sql`${notifications.readAt} is not null`));
}
