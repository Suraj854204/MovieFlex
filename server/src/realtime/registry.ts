import { eq } from 'drizzle-orm';
import { db } from '../db';
import { rooms, roomMembers, users } from '../db/schema';
import { LiveRoom } from './LiveRoom';
import { logger } from '../lib/logger';

// code → LiveRoom for rooms with recent activity.
const live = new Map<string, LiveRoom>();
// code → in-flight DB hydration. Prevents two simultaneous joins from building
// two LiveRoom instances for the same room (the "duplicate host" race in v1).
const loading = new Map<string, Promise<LiveRoom | null>>();

export const registry = {
  peek: (code: string) => live.get(code),
  all: () => [...live.values()],
  size: () => live.size,

  async get(code: string): Promise<LiveRoom | null> {
    const hit = live.get(code);
    if (hit) return hit;
    const pending = loading.get(code);
    if (pending) return pending;
    const p = hydrate(code).finally(() => loading.delete(code));
    loading.set(code, p);
    return p;
  },

  drop(code: string) {
    const room = live.get(code);
    if (!room) return;
    room.clearTimers();
    live.delete(code);
    logger.info('room:evicted', { code });
  },

  clear() { for (const r of live.values()) r.clearTimers(); live.clear(); },
};

async function hydrate(code: string): Promise<LiveRoom | null> {
  const [row] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!row) return null;

  const members = await db
    .select({
      userId: roomMembers.userId, role: roomMembers.role, banned: roomMembers.banned,
      username: users.username, displayName: users.displayName, avatarColor: users.avatarColor,
    })
    .from(roomMembers)
    .innerJoin(users, eq(users.id, roomMembers.userId))
    .where(eq(roomMembers.roomId, row.id));

  const room = new LiveRoom({
    id: row.id, code: row.code, name: row.name, description: row.description, privacy: row.privacy,
    locked: row.locked, hasPassword: !!row.passwordHash, maxParticipants: row.maxParticipants,
    hostId: row.hostId, createdAt: row.createdAt,
    video: {
      videoId: row.videoId, title: row.videoTitle, thumbnail: row.videoThumbnail,
      // After a restart we resume paused at the last known position — never "ghost-play".
      playing: false,
      position: row.positionSec,
      updatedAt: Date.now(),
    },
  });
  for (const m of members) {
    if (m.banned) { room.banned.add(m.userId); continue; }
    room.roles.set(m.userId, m.role);
    room.profiles.set(m.userId, {
      userId: m.userId, username: m.username, displayName: m.displayName, avatarColor: m.avatarColor,
    });
  }
  // Another request may have hydrated while we awaited — keep the first.
  const existing = live.get(code);
  if (existing) return existing;
  live.set(code, room);
  logger.info('room:hydrated', { code, members: members.length });
  return room;
}
