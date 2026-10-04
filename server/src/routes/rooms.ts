import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';
import { Errors } from '../lib/errors';
import { RateLimiter } from '../lib/rateLimiter';
import { normaliseCode } from '../lib/codes';
import { body, query, type WithQuery } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { config } from '../config';
import {
  createRoom, deleteRoom, discoverRooms, joinRoom, leaveRoom, myRooms, roomDetails, updateRoom, getRoomRow,
} from '../services/roomService';
import { notify } from '../services/notificationService';
import { registry } from '../realtime/registry';
import { getIO } from '../realtime/io';
import { detachSocket } from '../realtime/lifecycle';

const router = Router();
router.use(requireAuth);

const createLimiter = new RateLimiter(config.isTest ? 10_000 : 10, 60 * 60_000);
const inviteLimiter = new RateLimiter(config.isTest ? 10_000 : 30, 60 * 60_000);

const nameField = z.string().trim().min(1, 'Give your room a name.').max(60, 'Room name is too long (max 60).');
const descField = z.string().trim().max(200, 'Description is too long (max 200).');
const passField = z.string().min(4, 'Password must be at least 4 characters.').max(64);

const createSchema = z.object({
  name: nameField, description: descField.optional(),
  privacy: z.enum(['public', 'private']).default('public'),
  password: passField.optional(),
  videoUrl: z.string().trim().max(300).optional(),
}).refine((v) => !(v.privacy === 'public' && v.password), { message: 'Only private rooms can have a password.', path: ['password'] });

router.post('/', body(createSchema), async (req, res, next) => {
  try {
    if (!createLimiter.allow(req.user!.id)) throw Errors.rateLimited('You are creating rooms too quickly. Try again later.');
    const { card } = await createRoom(req.user!.id, req.body);
    res.status(201).json({ ok: true, data: { room: { ...card, myRole: 'host' } } });
  } catch (e) { next(e); }
});

const discoverSchema = z.object({
  q: z.string().trim().max(60).optional(),
  filter: z.enum(['all', 'live', 'playing']).default('all'),
  sort: z.enum(['active', 'new']).default('active'),
  limit: z.coerce.number().int().min(1).max(24).default(12),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});
router.get('/discover', query(discoverSchema), async (req, res, next) => {
  try {
    res.json({ ok: true, data: await discoverRooms((req as WithQuery<typeof discoverSchema>).q) });
  } catch (e) { next(e); }
});

router.get('/mine', async (req, res, next) => {
  try { res.json({ ok: true, data: { rooms: await myRooms(req.user!.id) } }); } catch (e) { next(e); }
});

router.get('/:code', async (req, res, next) => {
  try { res.json({ ok: true, data: { room: await roomDetails(req.user!.id, req.params.code) } }); } catch (e) { next(e); }
});

router.post('/:code/join', body(z.object({ password: z.string().max(64).optional() })), async (req, res, next) => {
  try {
    const { role, card } = await joinRoom(req.user!.id, req.params.code, req.body.password);
    res.json({ ok: true, data: { room: { ...card, myRole: role } } });
  } catch (e) { next(e); }
});

/** REST fallback for leaving (the socket `room:leave` event is the primary path). */
router.post('/:code/leave', async (req, res, next) => {
  try {
    const code = normaliseCode(req.params.code);
    const result = await leaveRoom(req.user!.id, code);
    const live = registry.peek(code);
    const io = getIO();
    if (live && io) for (const sid of live.socketsOf(req.user!.id)) {
      const s = io.sockets.sockets.get(sid);
      if (s) await detachSocket(io, s, true);
    }
    res.json({ ok: true, data: result });
  } catch (e) { next(e); }
});

const patchSchema = z.object({
  name: nameField.optional(), description: descField.optional(),
  privacy: z.enum(['public', 'private']).optional(), locked: z.boolean().optional(),
  password: passField.nullable().optional(),
  maxParticipants: z.number().int().min(2).max(100).optional(),
});
router.patch('/:code', body(patchSchema), async (req, res, next) => {
  try { res.json({ ok: true, data: { room: await updateRoom(req.user!.id, req.params.code, req.body) } }); } catch (e) { next(e); }
});

router.delete('/:code', async (req, res, next) => {
  try { await deleteRoom(req.user!.id, req.params.code); res.json({ ok: true, data: {} }); } catch (e) { next(e); }
});

router.post('/:code/invite', body(z.object({ username: z.string().trim().toLowerCase().min(3).max(20) })), async (req, res, next) => {
  try {
    const { room } = await getRoomRow(req.params.code);
    const details = await roomDetails(req.user!.id, req.params.code);
    if (!details.myRole) throw Errors.forbidden('Join the room before inviting others.');
    if (!inviteLimiter.allow(req.user!.id)) throw Errors.rateLimited('You are sending invites too quickly.');
    const [target] = await db.select().from(users).where(eq(users.username, req.body.username)).limit(1);
    if (!target) throw Errors.notFound('No user with that username.');
    if (target.id === req.user!.id) throw Errors.validation('You cannot invite yourself.');
    await notify(target.id, {
      type: 'invite', title: `${req.user!.displayName} invited you to watch`,
      body: `“${room.name}” · code ${room.code}`, link: `/room/${room.code}`,
    });
    res.json({ ok: true, data: { invited: target.username } });
  } catch (e) { next(e); }
});

export default router;
