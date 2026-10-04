import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { body, query, type WithQuery } from '../middleware/validate';
import { clearHistory, listHistory, removeHistory } from '../services/historyService';
import { deleteNotification, listNotifications, markRead } from '../services/notificationService';

// ── Watch history ─────────────────────────────────────────────────────────────
export const historyRouter = Router();
historyRouter.use(requireAuth);

const pageSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(5000).default(0),
});
historyRouter.get('/', query(pageSchema), async (req, res, next) => {
  try {
    const { limit, offset } = (req as WithQuery<typeof pageSchema>).q;
    res.json({ ok: true, data: await listHistory(req.user!.id, limit, offset) });
  } catch (e) { next(e); }
});
historyRouter.delete('/', async (req, res, next) => {
  try { await clearHistory(req.user!.id); res.json({ ok: true, data: {} }); } catch (e) { next(e); }
});
historyRouter.delete('/:id', async (req, res, next) => {
  try {
    if (!z.string().uuid().safeParse(req.params.id).success) return void res.json({ ok: true, data: {} });
    await removeHistory(req.user!.id, req.params.id);
    res.json({ ok: true, data: {} });
  } catch (e) { next(e); }
});

// ── Notifications ─────────────────────────────────────────────────────────────
export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res, next) => {
  try { res.json({ ok: true, data: await listNotifications(req.user!.id) }); } catch (e) { next(e); }
});
notificationsRouter.post('/read', body(z.object({ ids: z.array(z.string().uuid()).max(100).optional() })), async (req, res, next) => {
  try { await markRead(req.user!.id, req.body.ids); res.json({ ok: true, data: {} }); } catch (e) { next(e); }
});
notificationsRouter.delete('/:id', async (req, res, next) => {
  try {
    if (z.string().uuid().safeParse(req.params.id).success) await deleteNotification(req.user!.id, req.params.id);
    res.json({ ok: true, data: {} });
  } catch (e) { next(e); }
});
