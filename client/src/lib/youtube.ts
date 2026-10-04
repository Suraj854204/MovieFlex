const ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Accepts watch / youtu.be / embed / shorts / live URLs or a bare 11-char ID. Mirrors the server. */
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

export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
