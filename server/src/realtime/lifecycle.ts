import type { Server, Socket } from 'socket.io';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { roomMembers } from '../db/schema';
import { registry } from './registry';
import type { LiveRoom } from './LiveRoom';
import { emitToRoom, roomChannel } from './io';
import { postSystem, recentMessages } from '../services/chatService';
import { persistNow } from '../services/roomService';
import { recordWatch, savePosition } from '../services/historyService';
import { transferHost } from '../services/moderationService';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

const GRACE_MS = Number(process.env.PRESENCE_GRACE_MS ?? 6000);        // refresh / flaky network
const HOST_AWAY_MS = Number(process.env.HOST_AWAY_MS ?? 120_000);       // before auto-promoting a successor
const EVICT_MS = Number(process.env.ROOM_EVICT_MS ?? 120_000);          // empty room kept warm in memory

export interface SessionUser { id: string; username: string; displayName: string; avatarColor: string }

export function snapshot(live: LiveRoom, userId: string, messages: Awaited<ReturnType<typeof recentMessages>>) {
  return {
    room: { code: live.code, id: live.id, ...live.settings(), createdAt: live.createdAt },
    you: { userId, role: live.roleOf(userId) ?? 'member' },
    participants: live.participants(),
    video: live.payload(),
    messages,
  };
}

/** Attach a socket to a room it is a member of. Idempotent for the same socket+room. */
export async function attachSocket(io: Server, socket: Socket, code: string) {
  const user = socket.data.user as SessionUser;
  const live = await registry.get(code);
  if (!live) throw new AppError(404, 'ROOM_NOT_FOUND', 'This room does not exist.');
  if (live.banned.has(user.id)) throw new AppError(403, 'BANNED', 'You were removed from this room by its host.');
  if (!live.roles.has(user.id)) throw new AppError(403, 'NOT_MEMBER', 'Join the room first.');

  // Duplicate join from the same socket (React StrictMode, double click) → just re-send state.
  if (socket.data.roomCode === code) {
    return snapshot(live, user.id, await recentMessages(live));
  }
  if (socket.data.roomCode) await detachSocket(io, socket, false);

  if (live.onlineCount() >= live.maxParticipants && !live.isOnline(user.id)) {
    throw new AppError(409, 'ROOM_FULL', 'This room is full right now.');
  }

  clearTimeout(live.evictTimer); live.evictTimer = undefined;
  clearTimeout(live.graceTimers.get(user.id)); live.graceTimers.delete(user.id);
  if (live.isHost(user.id)) { clearTimeout(live.hostTimer); live.hostTimer = undefined; }

  const first = live.addSocket(user.id, socket.id);
  socket.data.roomCode = code;
  await socket.join(roomChannel(code));
  live.profiles.set(user.id, { userId: user.id, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor });

  emitToRoom(code, 'presence:update', { participants: live.participants() });
  if (first) {
    emitToRoom(code, 'chat:message', await postSystem(live, `${user.displayName} joined`, false));
    void db.update(roomMembers).set({ lastSeenAt: new Date() })
      .where(and(eq(roomMembers.roomId, live.id), eq(roomMembers.userId, user.id))).catch(() => {});
    const v = live.video;
    if (v.videoId) void recordWatch([user.id], live.id, { videoId: v.videoId, title: v.title ?? '', thumbnail: v.thumbnail ?? '' }, { keepPosition: true }).catch(() => {});
  }
  logger.info('room:join', { code, user: user.id, sockets: live.socketsOf(user.id).length });
  return snapshot(live, user.id, await recentMessages(live));
}

/**
 * Detach a socket from its room. `immediate` skips the reconnect grace period
 * (explicit leave); otherwise a refresh or brief network drop doesn't show as leave+join.
 */
export async function detachSocket(io: Server, socket: Socket, immediate: boolean) {
  const code = socket.data.roomCode as string | undefined;
  if (!code) return;
  const user = socket.data.user as SessionUser;
  socket.leave(roomChannel(code));
  socket.data.roomCode = undefined;

  const live = registry.peek(code);
  if (!live) return;
  const noneLeft = live.removeSocket(user.id, socket.id);
  if (!noneLeft) return;

  clearTimeout(live.graceTimers.get(user.id));
  if (immediate) { await finalizeLeave(live, user); return; }
  const t = setTimeout(() => { live.graceTimers.delete(user.id); void finalizeLeave(live, user); }, GRACE_MS);
  t.unref();
  live.graceTimers.set(user.id, t);
}

async function finalizeLeave(live: LiveRoom, user: SessionUser) {
  const entry = live.presence.get(user.id);
  if (entry && entry.sockets.size > 0) return;           // reconnected during grace
  live.dropPresence(user.id);

  emitToRoom(live.code, 'presence:update', { participants: live.participants() });
  if (live.roles.has(user.id)) {
    emitToRoom(live.code, 'chat:message', await postSystem(live, `${user.displayName} left`, false));
    const v = live.video;
    if (v.videoId) void savePosition(user.id, v.videoId, live.currentTime()).catch(() => {});
    void db.update(roomMembers).set({ lastSeenAt: new Date() })
      .where(and(eq(roomMembers.roomId, live.id), eq(roomMembers.userId, user.id))).catch(() => {});
  }
  logger.info('room:leave', { code: live.code, user: user.id });

  if (live.hostId && !live.isOnline(live.hostId) && live.live()) armHostSuccession(live);

  if (live.onlineCount() === 0) {
    await persistNow(live);
    clearTimeout(live.evictTimer);
    live.evictTimer = setTimeout(() => { if (live.onlineCount() === 0) registry.drop(live.code); }, EVICT_MS);
    live.evictTimer.unref();
  }
}

/** If the host stays away, promote someone so the room never gets stuck without control. */
function armHostSuccession(live: LiveRoom) {
  clearTimeout(live.hostTimer);
  live.hostTimer = setTimeout(async () => {
    if (!live.hostId || live.isOnline(live.hostId)) return;
    const next = live.pickSuccessor(live.hostId);
    if (!next) return;
    try { await transferHost(live.code, live.hostId, next, { automatic: true }); }
    catch (err) { logger.warn('room:auto_transfer_failed', { code: live.code, message: (err as Error).message }); }
  }, HOST_AWAY_MS);
  live.hostTimer.unref();
}
