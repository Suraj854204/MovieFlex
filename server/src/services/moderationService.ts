import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { rooms, roomMembers } from '../db/schema';
import { Errors } from '../lib/errors';
import { registry } from '../realtime/registry';
import { emitToRoom, emitToUser, getIO, roomChannel } from '../realtime/io';
import { postSystem } from './chatService';
import { notify } from './notificationService';
import { logger } from '../lib/logger';

async function liveOrThrow(code: string) {
  const live = await registry.get(code);
  if (!live) throw Errors.roomNotFound();
  return live;
}

function pushPresence(code: string) {
  const live = registry.peek(code);
  if (live) emitToRoom(code, 'presence:update', { participants: live.participants() });
}

async function announce(code: string, text: string, persist = true) {
  const live = registry.peek(code);
  if (!live) return;
  emitToRoom(code, 'chat:message', await postSystem(live, text, persist));
}

const name = (code: string, userId: string) => registry.peek(code)?.profiles.get(userId)?.displayName ?? 'Someone';

/** Host promotes/demotes between moderator and member. */
export async function setRole(code: string, actorId: string, targetId: string, role: 'moderator' | 'member') {
  const live = await liveOrThrow(code);
  if (!live.isHost(actorId)) throw Errors.forbidden('Only the host can change roles.');
  const current = live.roleOf(targetId);
  if (!current) throw Errors.notFound('That person is not in this room.');
  if (current === 'host') throw Errors.forbidden('The host role must be transferred instead.');
  if (current === role) return;
  await db.update(roomMembers).set({ role }).where(and(eq(roomMembers.roomId, live.id), eq(roomMembers.userId, targetId)));
  live.roles.set(targetId, role);
  pushPresence(code);
  emitToUser(targetId, 'role:changed', { code, role });
  await announce(code, role === 'moderator' ? `${name(code, targetId)} is now a moderator` : `${name(code, targetId)} is no longer a moderator`);
  void notify(targetId, {
    type: 'role_changed', title: role === 'moderator' ? 'You are now a moderator' : 'Your moderator role was removed',
    body: `In “${live.name}”`, link: `/room/${code}`,
  }).catch(() => {});
}

/** Host hands over the room. The previous host stays on as a moderator. */
export async function transferHost(code: string, actorId: string, targetId: string, opts: { silent?: boolean; automatic?: boolean } = {}) {
  const live = await liveOrThrow(code);
  if (!opts.automatic && !live.isHost(actorId)) throw Errors.forbidden('Only the host can transfer the room.');
  if (!live.roles.has(targetId)) throw Errors.notFound('That person is not in this room.');
  if (targetId === actorId) throw Errors.validation('You are already the host.');
  const prevHost = live.hostId;

  await db.transaction(async (tx) => {
    if (prevHost) await tx.update(roomMembers).set({ role: 'moderator' })
      .where(and(eq(roomMembers.roomId, live.id), eq(roomMembers.userId, prevHost)));
    await tx.update(roomMembers).set({ role: 'host' })
      .where(and(eq(roomMembers.roomId, live.id), eq(roomMembers.userId, targetId)));
    await tx.update(rooms).set({ hostId: targetId }).where(eq(rooms.id, live.id));
  });
  if (prevHost && live.roles.has(prevHost)) live.roles.set(prevHost, 'moderator');
  live.roles.set(targetId, 'host');
  live.hostId = targetId;
  clearTimeout(live.hostTimer);

  pushPresence(code);
  emitToRoom(code, 'room:updated', live.settings());
  emitToUser(targetId, 'role:changed', { code, role: 'host' });
  if (prevHost) emitToUser(prevHost, 'role:changed', { code, role: 'moderator' });
  if (!opts.silent) await announce(code, `${name(code, targetId)} is now the host`);
  void notify(targetId, { type: 'host_transferred', title: 'You are now the host', body: `Of “${live.name}”`, link: `/room/${code}` }).catch(() => {});
  logger.info('room:host_transferred', { code, to: targetId, automatic: !!opts.automatic });
}

/** Removes the person and blocks them from rejoining. Host: anyone but self; moderator: plain members only. */
export async function kick(code: string, actorId: string, targetId: string) {
  const live = await liveOrThrow(code);
  const actor = live.roleOf(actorId);
  const target = live.roleOf(targetId);
  if (actor !== 'host' && actor !== 'moderator') throw Errors.forbidden();
  if (!target) throw Errors.notFound('That person is not in this room.');
  if (targetId === actorId) throw Errors.validation('You cannot remove yourself — use Leave instead.');
  if (target === 'host') throw Errors.forbidden('The host cannot be removed.');
  if (actor === 'moderator' && target !== 'member') throw Errors.forbidden('Moderators can only remove regular members.');

  const targetName = name(code, targetId);
  await db.update(roomMembers).set({ banned: true, role: 'member' })
    .where(and(eq(roomMembers.roomId, live.id), eq(roomMembers.userId, targetId)));

  const io = getIO();
  for (const sid of live.socketsOf(targetId)) {
    const s = io?.sockets.sockets.get(sid);
    if (s) { s.leave(roomChannel(code)); s.data.roomCode = undefined; }
  }
  emitToUser(targetId, 'room:removed', { code, reason: 'kicked' });
  live.presence.delete(targetId);
  clearTimeout(live.graceTimers.get(targetId)); live.graceTimers.delete(targetId);
  live.roles.delete(targetId); live.profiles.delete(targetId); live.banned.add(targetId);

  pushPresence(code);
  await announce(code, `${targetName} was removed from the room`);
  void notify(targetId, { type: 'removed', title: 'You were removed from a room', body: `“${live.name}”` }).catch(() => {});
  logger.info('room:kick', { code, actor: actorId, target: targetId });
}

