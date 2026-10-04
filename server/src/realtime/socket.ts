import type { Server, Socket } from 'socket.io';
import { z, ZodType } from 'zod';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { verifySocketToken } from '../lib/tokens';
import { AppError, Errors } from '../lib/errors';
import { RateLimiter } from '../lib/rateLimiter';
import { cleanMessage } from '../lib/sanitize';
import { resolveVideo } from '../lib/youtube';
import { normaliseCode, ROOM_CODE_RE } from '../lib/codes';
import { logger } from '../lib/logger';
import { registry } from './registry';
import { emitToRoom, roomChannel, userChannel } from './io';
import { presence } from './presence';
import { attachSocket, detachSocket, type SessionUser } from './lifecycle';
import type { LiveRoom } from './LiveRoom';
import { deleteMessage, clearChat, postSystem, postUserMessage } from '../services/chatService';
import { leaveRoom, persistNow, schedulePersist } from '../services/roomService';
import { kick, setRole, transferHost } from '../services/moderationService';
import { recordWatch } from '../services/historyService';

export const REACTIONS = ['❤️', '😂', '🔥', '😮', '👏', '👍'] as const;

// Per-user limiters (keyed by user id so opening many tabs doesn't multiply the budget).
const limits = {
  join:     new RateLimiter(20, 60_000),
  control:  new RateLimiter(40, 10_000),
  chat:     new RateLimiter(6, 6_000),
  reaction: new RateLimiter(10, 5_000),
  mod:      new RateLimiter(20, 10_000),
};

type Ack = (res: { ok: true; data?: unknown } | { ok: false; error: { code: string; message: string } }) => void;

const time = z.number().finite().min(0).max(60 * 60 * 24 * 3);

function errorPayload(err: unknown) {
  if (err instanceof AppError) return { code: err.code, message: err.message };
  return { code: 'INTERNAL', message: 'Something went wrong. Please try again.' };
}

export function attachSocketServer(io: Server) {
  // ── Authentication: every socket must present a valid signed token ───────────
  io.use(async (socket, next) => {
    try {
      const userId = verifySocketToken((socket.handshake.auth as { token?: unknown })?.token);
      if (!userId) return next(new Error('UNAUTHORIZED'));
      const [u] = await db.select({
        id: users.id, username: users.username, displayName: users.displayName, avatarColor: users.avatarColor,
      }).from(users).where(eq(users.id, userId)).limit(1);
      if (!u) return next(new Error('UNAUTHORIZED'));
      socket.data.user = u satisfies SessionUser;
      next();
    } catch (err) {
      logger.error('socket:auth_error', { message: (err as Error).message });
      next(new Error('SERVER_ERROR'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SessionUser;
    presence.connect(user.id);
    void socket.join(userChannel(user.id));
    logger.info('socket:connect', { sid: socket.id, user: user.id, transport: socket.conn.transport.name });

    /** Registers a validated, rate-limited, error-safe event handler. */
    function on<T>(
      event: string, schema: ZodType<T> | null, limiter: RateLimiter | null,
      fn: (payload: T) => Promise<unknown> | unknown,
    ) {
      socket.on(event, async (raw: unknown, ack?: Ack) => {
        const reply: Ack = typeof ack === 'function' ? ack : () => {};
        try {
          if (limiter && !limiter.allow(user.id)) throw Errors.rateLimited(event === 'chat:send' ? 'You are sending messages too quickly.' : 'Slow down a little.');
          let payload = undefined as T;
          if (schema) {
            const parsed = schema.safeParse(raw ?? {});
            if (!parsed.success) throw Errors.validation(parsed.error.issues[0]?.message ?? 'Invalid request.');
            payload = parsed.data;
          }
          reply({ ok: true, data: await fn(payload) });
        } catch (err) {
          if (!(err instanceof AppError)) logger.error('socket:handler_error', { event, user: user.id, message: (err as Error).message });
          reply({ ok: false, error: errorPayload(err) });
        }
      });
    }

    /** The room this socket is currently in — never trusted from the client payload. */
    const currentRoom = (): LiveRoom => {
      const code = socket.data.roomCode as string | undefined;
      const live = code ? registry.peek(code) : undefined;
      if (!live || !live.roles.has(user.id)) throw new AppError(403, 'NOT_MEMBER', 'You are not in this room.');
      return live;
    };
    const controller = (): LiveRoom => {
      const live = currentRoom();
      if (!live.canControl(user.id)) throw Errors.forbidden('Only the host or moderators can control playback.');
      return live;
    };

    // ── clock sync (client estimates its offset from the server clock) ─────────
    on('clock:sync', null, null, () => ({ serverNow: Date.now() }));

    // ── room membership ────────────────────────────────────────────────────────
    on('room:join', z.object({ code: z.string().min(1).max(12) }), limits.join, async ({ code }) => {
      const c = normaliseCode(code);
      if (!ROOM_CODE_RE.test(c)) throw Errors.roomNotFound();
      return attachSocket(io, socket, c);
    });

    // Leave the page but keep membership (navigating around the app).
    on('room:detach', null, null, async () => { await detachSocket(io, socket, false); });

    // Explicit "Leave room": drops membership (host hands the room over first).
    on('room:leave', null, limits.join, async () => {
      const live = currentRoom();
      const result = await leaveRoom(user.id, live.code);
      await detachSocket(io, socket, true);
      logger.info('room:leave_explicit', { code: live.code, user: user.id, left: result.left });
      return result;
    });

    // ── playback (host / moderators only — enforced here, not just in the UI) ───
    const broadcast = (live: LiveRoom, changed: boolean) => {
      const payload = live.payload(user.id);
      if (changed) { socket.to(roomChannel(live.code)).emit('video:state', payload); schedulePersist(live); }
      return payload;
    };

    on('video:play', z.object({ time }), limits.control, ({ time: t }) => { const l = controller(); return broadcast(l, l.play(t)); });
    on('video:pause', z.object({ time }), limits.control, ({ time: t }) => { const l = controller(); return broadcast(l, l.pause(t)); });
    on('video:seek', z.object({ time }), limits.control, ({ time: t }) => { const l = controller(); return broadcast(l, l.seek(t)); });

    on('video:change', z.object({ url: z.string().min(1).max(300) }), limits.control, async ({ url }) => {
      const live = controller();
      const meta = await resolveVideo(url);
      live.changeVideo(meta);
      const payload = live.payload(user.id);
      emitToRoom(live.code, 'video:state', payload);               // everyone (incl. sender) loads it
      await persistNow(live);
      const online = [...live.presence.keys()].filter((id) => live.roles.has(id));
      void recordWatch(online, live.id, meta).catch(() => {});
      emitToRoom(live.code, 'chat:message', await postSystem(live, `${user.displayName} loaded “${meta.title}”`, false));
      logger.info('video:change', { code: live.code, user: user.id, videoId: meta.videoId });
      return payload;
    });

    // Controllers periodically report their real position so drift can't accumulate.
    on('video:heartbeat', z.object({ rev: z.number().int(), time, playing: z.boolean() }), limits.control, ({ rev, time: t, playing }) => {
      const live = controller();
      const result = live.heartbeat(rev, t, playing);
      if (result === 'corrected') broadcast(live, true);
      return { result };
    });

    // Late joiner / reconnect asks for the authoritative state.
    on('video:sync', null, limits.control, () => currentRoom().payload());

    // ── chat ───────────────────────────────────────────────────────────────────
    on('chat:send', z.object({ text: z.string().max(2000) }), limits.chat, async ({ text }) => {
      const live = currentRoom();
      const clean = cleanMessage(text).slice(0, 500);
      if (!clean) throw Errors.validation('Message cannot be empty.');
      const msg = await postUserMessage(live, user.id, clean);
      emitToRoom(live.code, 'chat:message', msg);
      return { id: msg.id };
    });

    on('chat:delete', z.object({ id: z.string().uuid() }), limits.mod, async ({ id }) => {
      const live = currentRoom();
      await deleteMessage(live, user.id, id);
      emitToRoom(live.code, 'chat:deleted', { id });
    });

    on('chat:clear', null, limits.mod, async () => {
      const live = currentRoom();
      if (!live.isHost(user.id)) throw Errors.forbidden('Only the host can clear the chat.');
      await clearChat(live);
      emitToRoom(live.code, 'chat:cleared', {});
      emitToRoom(live.code, 'chat:message', await postSystem(live, `${user.displayName} cleared the chat`, false));
    });

    // ── reactions (ephemeral — never stored) ───────────────────────────────────
    on('reaction:send', z.object({ emoji: z.enum(REACTIONS) }), limits.reaction, ({ emoji }) => {
      const live = currentRoom();
      emitToRoom(live.code, 'reaction', { id: crypto.randomUUID(), emoji, userId: user.id, displayName: user.displayName });
    });

    // ── moderation ─────────────────────────────────────────────────────────────
    const target = z.object({ userId: z.string().uuid() });
    on('mod:role', target.extend({ role: z.enum(['moderator', 'member']) }), limits.mod,
      ({ userId, role }) => setRole(currentRoom().code, user.id, userId, role));
    on('mod:transfer', target, limits.mod, ({ userId }) => transferHost(currentRoom().code, user.id, userId));
    on('mod:kick', target, limits.mod, ({ userId }) => kick(currentRoom().code, user.id, userId));

    // ── disconnect ─────────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      presence.disconnect(user.id);
      logger.info('socket:disconnect', { sid: socket.id, user: user.id, reason });
      void detachSocket(io, socket, false).catch((err) =>
        logger.error('socket:detach_error', { message: (err as Error).message }));
    });

    socket.on('error', (err) => logger.warn('socket:error', { sid: socket.id, message: err.message }));
  });
}
