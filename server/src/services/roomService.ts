import bcrypt from 'bcryptjs';
import { and, desc, eq, ilike, inArray, or, sql, SQL } from 'drizzle-orm';
import { db } from '../db';
import { rooms, roomMembers, users, type MemberRole, type Privacy } from '../db/schema';
import { config } from '../config';
import { AppError, Errors, isUniqueViolation } from '../lib/errors';
import { generateRoomCode, normaliseCode, ROOM_CODE_RE } from '../lib/codes';
import { cleanText } from '../lib/sanitize';
import { resolveVideo } from '../lib/youtube';
import { RateLimiter } from '../lib/rateLimiter';
import { registry } from '../realtime/registry';
import { emitToRoom, getIO, roomChannel } from '../realtime/io';
import type { LiveRoom } from '../realtime/LiveRoom';
import { recordWatch } from './historyService';
import { transferHost } from './moderationService';

const passwordAttempts = new RateLimiter(6, 10 * 60 * 1000);

type RoomRow = typeof rooms.$inferSelect;
type HostRow = { id: string; username: string; displayName: string; avatarColor: string } | null;

// ── Card shape (what the UI lists on Home / Discover / My Rooms) ──────────────
export function toCard(row: RoomRow, host: HostRow) {
  const liveRoom = registry.peek(row.code);
  const v = liveRoom?.video;
  const videoId = v ? v.videoId : row.videoId;
  return {
    id: row.id, code: row.code,
    name: liveRoom?.name ?? row.name,
    description: liveRoom?.description ?? row.description,
    privacy: liveRoom?.privacy ?? row.privacy,
    locked: liveRoom?.locked ?? row.locked,
    hasPassword: liveRoom?.hasPassword ?? !!row.passwordHash,
    maxParticipants: row.maxParticipants,
    host: host ? { id: host.id, username: host.username, displayName: host.displayName, avatarColor: host.avatarColor } : null,
    video: videoId ? {
      videoId, title: (v ? v.title : row.videoTitle) ?? '', thumbnail: (v ? v.thumbnail : row.videoThumbnail) ?? '',
      playing: v ? v.playing : false,
    } : null,
    participantCount: liveRoom?.onlineCount() ?? 0,
    live: (liveRoom?.onlineCount() ?? 0) > 0,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt,
  };
}

const roomWithHost = () => db
  .select({ room: rooms, host: { id: users.id, username: users.username, displayName: users.displayName, avatarColor: users.avatarColor } })
  .from(rooms).leftJoin(users, eq(users.id, rooms.hostId));

export async function getRoomRow(code: string) {
  const c = normaliseCode(code);
  if (!ROOM_CODE_RE.test(c)) throw Errors.roomNotFound();
  const [r] = await roomWithHost().where(eq(rooms.code, c)).limit(1);
  if (!r) throw Errors.roomNotFound();
  return r;
}

// ── Create ────────────────────────────────────────────────────────────────────
export interface CreateRoomInput {
  name: string; description?: string; privacy: Privacy; password?: string; videoUrl?: string;
}

export async function createRoom(userId: string, input: CreateRoomInput) {
  const video = input.videoUrl ? await resolveVideo(input.videoUrl) : null;
  const passwordHash = input.privacy === 'private' && input.password
    ? await bcrypt.hash(input.password, config.bcryptRounds) : null;

  for (let attempt = 0; attempt < 6; attempt++) {
    const code = generateRoomCode();
    try {
      const room = await db.transaction(async (tx) => {
        const [r] = await tx.insert(rooms).values({
          code, name: cleanText(input.name), description: cleanText(input.description ?? ''),
          hostId: userId, privacy: input.privacy, passwordHash,
          videoId: video?.videoId ?? null, videoTitle: video?.title ?? null, videoThumbnail: video?.thumbnail ?? null,
          playing: false,                    // a new room waits for the host to press play
        }).returning();
        await tx.insert(roomMembers).values({ roomId: r.id, userId, role: 'host' });
        return r;
      });
      if (video) await recordWatch([userId], room.id, video).catch(() => {});
      const [{ host }] = await roomWithHost().where(eq(rooms.id, room.id));
      return { room, card: toCard(room, host) };
    } catch (err) {
      if (isUniqueViolation(err)) continue;            // code collision → try another
      throw err;
    }
  }
  throw new AppError(500, 'INTERNAL', 'Could not allocate a room code. Please try again.');
}

// ── Join / leave ──────────────────────────────────────────────────────────────
async function loadMember(roomId: string, userId: string) {
  const [m] = await db.select().from(roomMembers)
    .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId))).limit(1);
  return m;
}

export async function joinRoom(userId: string, codeInput: string, password?: string) {
  const { room: row, host } = await getRoomRow(codeInput);
  const live = await registry.get(row.code);
  const existing = await loadMember(row.id, userId);

  if (existing?.banned) throw new AppError(403, 'BANNED', 'You were removed from this room by its host.');

  if (!existing) {
    if (row.locked) throw new AppError(403, 'ROOM_LOCKED', 'This room is locked and not accepting new people.');
    if (row.passwordHash) {
      if (!password) throw new AppError(403, 'PASSWORD_REQUIRED', 'This room is password protected.');
      const key = `${userId}:${row.id}`;
      if (!passwordAttempts.allow(key)) throw Errors.rateLimited('Too many password attempts. Try again in a few minutes.');
      if (!(await bcrypt.compare(password, row.passwordHash))) throw new AppError(403, 'INVALID_PASSWORD', 'Incorrect room password.');
      passwordAttempts.reset(key);
    }
  }
  if ((live?.onlineCount() ?? 0) >= row.maxParticipants && !live?.isOnline(userId)) {
    throw new AppError(409, 'ROOM_FULL', 'This room is full right now. Try again in a moment.');
  }

  let role: MemberRole = existing?.role ?? 'member';
  if (!existing) {
    await db.insert(roomMembers).values({ roomId: row.id, userId, role: 'member' }).onConflictDoNothing();
    const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (live && u) {
      live.roles.set(userId, 'member');
      live.profiles.set(userId, { userId, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor });
    }
  }
  return { role, card: toCard(row, host) };
}

/** Removes the membership. A host with other members hands the room over first. */
export async function leaveRoom(userId: string, codeInput: string) {
  const { room: row } = await getRoomRow(codeInput);
  const live = await registry.get(row.code);
  const member = await loadMember(row.id, userId);
  if (!member) return { left: false };

  if (member.role === 'host') {
    const others = await db.select().from(roomMembers)
      .where(and(eq(roomMembers.roomId, row.id), eq(roomMembers.banned, false), sql`${roomMembers.userId} <> ${userId}`))
      .orderBy(sql`case ${roomMembers.role} when 'moderator' then 0 else 1 end`, roomMembers.joinedAt);
    const successor = (live?.pickSuccessor(userId)) ?? others[0]?.userId ?? null;
    if (!successor) return { left: false, reason: 'sole_host' as const };   // room stays in My Rooms
    await transferHost(row.code, userId, successor, { silent: true });
  }
  await db.delete(roomMembers).where(and(eq(roomMembers.roomId, row.id), eq(roomMembers.userId, userId)));
  if (live) { live.roles.delete(userId); live.profiles.delete(userId); }
  return { left: true };
}

// ── Update / delete (host only) ───────────────────────────────────────────────
export interface UpdateRoomInput {
  name?: string; description?: string; privacy?: Privacy; locked?: boolean;
  password?: string | null; maxParticipants?: number;
}

export async function updateRoom(userId: string, codeInput: string, patch: UpdateRoomInput) {
  const { room: row } = await getRoomRow(codeInput);
  const live = await registry.get(row.code);
  if (row.hostId !== userId) throw Errors.forbidden('Only the host can change room settings.');

  const set: Partial<typeof rooms.$inferInsert> = {};
  if (patch.name !== undefined) set.name = cleanText(patch.name);
  if (patch.description !== undefined) set.description = cleanText(patch.description);
  if (patch.locked !== undefined) set.locked = patch.locked;
  if (patch.maxParticipants !== undefined) set.maxParticipants = patch.maxParticipants;
  const nextPrivacy = patch.privacy ?? row.privacy;
  if (patch.privacy !== undefined) set.privacy = patch.privacy;
  if (nextPrivacy === 'public') set.passwordHash = null;                      // public rooms never have a password
  else if (patch.password === null) set.passwordHash = null;
  else if (typeof patch.password === 'string' && patch.password) set.passwordHash = await bcrypt.hash(patch.password, config.bcryptRounds);
  if (!Object.keys(set).length) return toCard(row, (await getRoomRow(codeInput)).host);

  const [updated] = await db.update(rooms).set(set).where(eq(rooms.id, row.id)).returning();
  if (live) {
    live.name = updated.name; live.description = updated.description; live.privacy = updated.privacy;
    live.locked = updated.locked; live.hasPassword = !!updated.passwordHash; live.maxParticipants = updated.maxParticipants;
    emitToRoom(live.code, 'room:updated', live.settings());
  }
  const { host } = await getRoomRow(row.code);
  return toCard(updated, host);
}

export async function deleteRoom(userId: string, codeInput: string) {
  const { room: row } = await getRoomRow(codeInput);
  if (row.hostId !== userId) throw Errors.forbidden('Only the host can delete this room.');
  emitToRoom(row.code, 'room:closed', { code: row.code });
  const io = getIO();
  io?.in(roomChannel(row.code)).socketsLeave(roomChannel(row.code));
  io?.sockets.sockets.forEach((s) => { if (s.data.roomCode === row.code) s.data.roomCode = undefined; });
  registry.drop(row.code);
  await db.delete(rooms).where(eq(rooms.id, row.id));
}

// ── Lists ─────────────────────────────────────────────────────────────────────
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export interface DiscoverQuery { q?: string; filter: 'all' | 'live' | 'playing'; sort: 'active' | 'new'; limit: number; offset: number }

export async function discoverRooms(query: DiscoverQuery) {
  const conds: SQL[] = [eq(rooms.privacy, 'public')];
  if (query.q) {
    const pat = `%${likeEscape(query.q)}%`;
    conds.push(or(ilike(rooms.name, pat), ilike(rooms.description, pat), ilike(rooms.videoTitle, pat), ilike(users.displayName, pat), ilike(users.username, pat))!);
  }
  if (query.filter !== 'all') {
    const liveCodes = registry.all()
      .filter((r) => r.onlineCount() > 0 && (query.filter === 'live' || r.video.playing))
      .map((r) => r.code);
    if (!liveCodes.length) return { items: [], hasMore: false };
    conds.push(inArray(rooms.code, liveCodes));
  }
  const rows = await roomWithHost().where(and(...conds))
    .orderBy(query.sort === 'new' ? desc(rooms.createdAt) : desc(rooms.lastActiveAt))
    .limit(query.limit + 1).offset(query.offset);
  const items = rows.slice(0, query.limit).map((r) => toCard(r.room, r.host));
  // Rooms with people in them float to the top of the page.
  items.sort((a, b) => b.participantCount - a.participantCount);
  return { items, hasMore: rows.length > query.limit };
}

export async function myRooms(userId: string) {
  const rows = await db
    .select({ room: rooms, host: { id: users.id, username: users.username, displayName: users.displayName, avatarColor: users.avatarColor }, role: roomMembers.role })
    .from(roomMembers)
    .innerJoin(rooms, eq(rooms.id, roomMembers.roomId))
    .leftJoin(users, eq(users.id, rooms.hostId))
    .where(and(eq(roomMembers.userId, userId), eq(roomMembers.banned, false)))
    .orderBy(desc(roomMembers.lastSeenAt)).limit(60);
  return rows.map((r) => ({ ...toCard(r.room, r.host), myRole: r.role }));
}

export async function roomDetails(userId: string, codeInput: string) {
  const { room: row, host } = await getRoomRow(codeInput);
  const m = await loadMember(row.id, userId);
  return { ...toCard(row, host), myRole: m && !m.banned ? m.role : null, banned: !!m?.banned };
}

// ── Persistence of the live playback snapshot ─────────────────────────────────
export function schedulePersist(room: LiveRoom) {
  if (room.persistTimer) return;
  room.persistTimer = setTimeout(() => { room.persistTimer = undefined; void persistNow(room); }, 1500);
  room.persistTimer.unref();
}

export async function persistNow(room: LiveRoom) {
  clearTimeout(room.persistTimer); room.persistTimer = undefined;
  const v = room.video;
  try {
    await db.update(rooms).set({
      videoId: v.videoId, videoTitle: v.title, videoThumbnail: v.thumbnail, playing: v.playing,
      positionSec: room.currentTime(), positionUpdatedAt: new Date(), lastActiveAt: new Date(),
    }).where(eq(rooms.id, room.id));
  } catch { /* best effort; next change retries */ }
}

export async function pruneStaleRooms() {
  const cutoff = new Date(Date.now() - 45 * 24 * 3600 * 1000);
  await db.delete(rooms).where(sql`${rooms.lastActiveAt} < ${cutoff}`);
}

