import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { watchHistory } from '../db/schema';

export interface HistoryVideo { videoId: string; title: string; thumbnail: string }

/** One row per (user, video): re-watching bumps the timestamp instead of adding duplicates. */
export async function recordWatch(userIds: string[], roomId: string, v: HistoryVideo, opts: { keepPosition?: boolean } = {}) {
  if (!userIds.length) return;
  await db.insert(watchHistory)
    .values(userIds.map((userId) => ({
      userId, roomId, videoId: v.videoId, title: v.title, thumbnail: v.thumbnail, lastPosition: 0,
    })))
    .onConflictDoUpdate({
      target: [watchHistory.userId, watchHistory.videoId],
      set: {
        title: v.title, thumbnail: v.thumbnail, roomId,
        ...(opts.keepPosition ? {} : { lastPosition: 0 }),
        lastWatchedAt: sql`now()`,
      },
    });
}

export async function savePosition(userId: string, videoId: string, position: number) {
  await db.update(watchHistory)
    .set({ lastPosition: Math.max(0, Math.floor(position)), lastWatchedAt: sql`now()` })
    .where(and(eq(watchHistory.userId, userId), eq(watchHistory.videoId, videoId)));
}

export async function listHistory(userId: string, limit: number, offset: number) {
  const rows = await db.select().from(watchHistory)
    .where(eq(watchHistory.userId, userId))
    .orderBy(desc(watchHistory.lastWatchedAt)).limit(limit + 1).offset(offset);
  return {
    items: rows.slice(0, limit).map((h) => ({
      id: h.id, videoId: h.videoId, title: h.title, thumbnail: h.thumbnail,
      lastPosition: h.lastPosition, lastWatchedAt: h.lastWatchedAt,
    })),
    hasMore: rows.length > limit,
  };
}

export async function removeHistory(userId: string, id: string) {
  await db.delete(watchHistory).where(and(eq(watchHistory.userId, userId), eq(watchHistory.id, id)));
}
export async function clearHistory(userId: string) {
  await db.delete(watchHistory).where(eq(watchHistory.userId, userId));
}
