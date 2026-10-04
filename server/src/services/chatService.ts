import crypto from 'crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { messages } from '../db/schema';
import type { LiveRoom } from '../realtime/LiveRoom';
import { Errors } from '../lib/errors';

export interface MessagePayload {
  id: string; type: 'user' | 'system'; userId: string | null; username: string | null;
  displayName: string | null; avatarColor: string | null; role: string | null;
  text: string; createdAt: number;
}

function userPayload(room: LiveRoom, m: { id: string; userId: string | null; body: string; createdAt: Date }): MessagePayload {
  const p = m.userId ? room.profiles.get(m.userId) : undefined;
  return {
    id: m.id, type: 'user', userId: m.userId, username: p?.username ?? null,
    displayName: p?.displayName ?? 'Former member', avatarColor: p?.avatarColor ?? '#626578',
    role: m.userId ? room.roleOf(m.userId) ?? null : null, text: m.body, createdAt: m.createdAt.getTime(),
  };
}

export async function postUserMessage(room: LiveRoom, userId: string, text: string): Promise<MessagePayload> {
  const [row] = await db.insert(messages).values({ roomId: room.id, userId, body: text, type: 'user' }).returning();
  return userPayload(room, row);
}

/** System notices. `persist=false` for noisy ones (joins/leaves) so we don't spam the table. */
export async function postSystem(room: LiveRoom, text: string, persist: boolean): Promise<MessagePayload> {
  let id: string = crypto.randomUUID();
  let createdAt = new Date();
  if (persist) {
    const [row] = await db.insert(messages).values({ roomId: room.id, userId: null, body: text, type: 'system' }).returning();
    id = row.id; createdAt = row.createdAt;
  }
  return {
    id, type: 'system', userId: null, username: null, displayName: null, avatarColor: null,
    role: null, text, createdAt: createdAt.getTime(),
  };
}

export async function recentMessages(room: LiveRoom, limit = 60): Promise<MessagePayload[]> {
  const rows = await db.select({
    id: messages.id, userId: messages.userId, body: messages.body, type: messages.type, createdAt: messages.createdAt,
  }).from(messages)
    .where(and(eq(messages.roomId, room.id), isNull(messages.deletedAt)))
    .orderBy(desc(messages.createdAt)).limit(limit);
  return rows.reverse().map((m) => m.type === 'system'
    ? { id: m.id, type: 'system' as const, userId: null, username: null, displayName: null, avatarColor: null, role: null, text: m.body, createdAt: m.createdAt.getTime() }
    : userPayload(room, m));
}

/** host: any message · moderator: own + plain members' · member: own only. */
export async function deleteMessage(room: LiveRoom, actorId: string, messageId: string): Promise<void> {
  const [msg] = await db.select().from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.roomId, room.id), isNull(messages.deletedAt))).limit(1);
  if (!msg) throw Errors.notFound('Message not found.');
  const actorRole = room.roleOf(actorId);
  const ownerRole = msg.userId ? room.roleOf(msg.userId) : undefined;
  const own = msg.userId === actorId;
  const allowed =
    own ||
    actorRole === 'host' ||
    (actorRole === 'moderator' && msg.type === 'user' && ownerRole !== 'host' && ownerRole !== 'moderator');
  if (!allowed) throw Errors.forbidden('You cannot delete this message.');
  await db.update(messages).set({ deletedAt: new Date() }).where(eq(messages.id, messageId));
}

export async function clearChat(room: LiveRoom): Promise<void> {
  await db.update(messages).set({ deletedAt: new Date() })
    .where(and(eq(messages.roomId, room.id), isNull(messages.deletedAt)));
}

