import { AppError } from './errors';
import { cleanText } from './sanitize';

const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Accepts watch / youtu.be / embed / shorts / live URLs or a bare 11-char ID. */
export function extractVideoId(input: string): string | null {
  const s = String(input ?? '').trim();
  if (ID_RE.test(s)) return s;
  let url: URL;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = url.hostname.replace(/^(www\.|m\.|music\.)/, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return ID_RE.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v');
    if (v && ID_RE.test(v)) return v;
    const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) return m[1];
  }
  return null;
}

export const thumbnailFor = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

export interface VideoMeta { videoId: string; title: string; thumbnail: string }

/**
 * Resolves title via YouTube oEmbed (no API key). 401/404 mean the video is
 * private, removed or not embeddable → reject. Network failures degrade
 * gracefully: the room still plays the video, we just lack a title.
 */
export async function resolveVideo(input: string): Promise<VideoMeta> {
  const videoId = extractVideoId(input);
  if (!videoId) throw new AppError(400, 'INVALID_VIDEO', 'That does not look like a valid YouTube link or video ID.');
  const fallback: VideoMeta = { videoId, title: `YouTube video ${videoId}`, thumbnail: thumbnailFor(videoId) };
  if (process.env.NODE_ENV === 'test' && !process.env.TEST_YT_ORACLE) return fallback;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`,
      { signal: ctrl.signal },
    ).finally(() => clearTimeout(timer));
    if (res.status === 401 || res.status === 404) {   // 403 is usually rate-limiting/proxying, so we do not trust it
      throw new AppError(422, 'VIDEO_UNAVAILABLE', 'This video is unavailable or cannot be embedded. Try a different one.');
    }
    if (!res.ok) return fallback;
    const data = (await res.json()) as { title?: string };
    return { ...fallback, title: cleanText(data.title || fallback.title).slice(0, 200) || fallback.title };
  } catch (err) {
    if (err instanceof AppError) throw err;
    return fallback;
  }
}
