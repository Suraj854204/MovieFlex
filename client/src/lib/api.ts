export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');
export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: Record<string, string>) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

interface Opts { signal?: AbortSignal; /** don't trigger the global "session expired" flow on 401 */ quiet401?: boolean }

async function request<T>(method: string, path: string, body?: unknown, opts: Opts = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method, credentials: 'include', signal: opts.signal,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Check your connection and try again.");
  }
  let json: any = null;
  try { json = await res.json(); } catch { /* proxy error page, cold start, etc. */ }
  if (res.ok && json?.ok) return json.data as T;
  if (!json?.error) {
    throw new ApiError(res.status, 'SERVER', res.status >= 500
      ? 'The server is unavailable right now. Please try again in a moment.'
      : 'Unexpected response from the server.');
  }
  const e = json.error as { code: string; message: string; details?: Record<string, string> };
  if (res.status === 401 && e.code === 'UNAUTHENTICATED' && !opts.quiet401) onUnauthorized?.();
  throw new ApiError(res.status, e.code, e.message, e.details);
}

export const api = {
  get: <T>(path: string, opts?: Opts) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body: unknown = {}, opts?: Opts) => request<T>('POST', path, body, opts),
  patch: <T>(path: string, body: unknown, opts?: Opts) => request<T>('PATCH', path, body, opts),
  del: <T>(path: string, opts?: Opts) => request<T>('DELETE', path, undefined, opts),
};

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
