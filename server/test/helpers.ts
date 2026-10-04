// Integration-test harness: real Postgres, real HTTP server, real Socket.IO clients.
process.env.NODE_ENV = 'test';
process.env.TEST_DATABASE_URL ||= process.env.DATABASE_URL_TEST || 'postgres://postgres@localhost:5433/watchparty_test';
process.env.DATABASE_URL ||= process.env.TEST_DATABASE_URL;
process.env.SESSION_SECRET ||= 'test-secret-test-secret-test-secret-1234';
process.env.PRESENCE_GRACE_MS ||= '400';
process.env.HOST_AWAY_MS ||= '900';
process.env.ROOM_EVICT_MS ||= '600';

import { io as ioClient, type Socket } from 'socket.io-client';
import type { AddressInfo } from 'net';

export interface Ack { ok: boolean; data?: any; error?: { code: string; message: string } }
export type TestSocket = Socket & { log: { ev: string; p: any }[] };

export interface Ctx { url: string; stop: () => Promise<void>; pool: import('pg').Pool }

export async function startServer(): Promise<Ctx> {
  const { pool } = await import('../src/db');
  const { runMigrations } = await import('../src/db/migrate');
  await runMigrations();
  await pool.query('truncate table messages, notifications, watch_history, room_members, rooms, users, user_sessions restart identity cascade');
  const { buildServer } = await import('../src/server');
  const { registry } = await import('../src/realtime/registry');
  const { server, io } = buildServer();
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url, pool,
    stop: async () => {
      registry.clear();
      io.close();
      await new Promise<void>((r) => server.close(() => r()));
      await pool.end();
    },
  };
}

export class Api {
  cookie = '';
  constructor(public readonly url: string) {}
  async req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(this.url + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(this.cookie ? { cookie: this.cookie } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.getSetCookie?.() ?? [];
    for (const c of set) {
      const pair = c.split(';')[0];
      if (/=;?$/.test(pair) || /Expires=Thu, 01 Jan 1970/i.test(c)) this.cookie = '';
      else this.cookie = pair;
    }
    let json: any = null;
    try { json = await res.json(); } catch { /* not json */ }
    return { status: res.status, body: json, headers: res.headers, setCookie: set };
  }
  get = (p: string) => this.req('GET', p);
  post = (p: string, b: unknown = {}) => this.req('POST', p, b);
  patch = (p: string, b: unknown) => this.req('PATCH', p, b);
  del = (p: string) => this.req('DELETE', p);
}

let counter = 0;
export async function newUser(ctx: Ctx, label = 'user') {
  const n = ++counter;
  const username = `${label}${n}`.slice(0, 20);
  const api = new Api(ctx.url);
  const res = await api.post('/api/auth/signup', { username, email: `${username}@example.com`, password: 'password123', displayName: `${label} ${n}` });
  if (res.status !== 201) throw new Error('signup failed ' + JSON.stringify(res.body));
  return { api, user: res.body.data.user as { id: string; username: string; displayName: string }, username };
}

export async function connect(api: Api, tokenOverride?: string): Promise<TestSocket> {
  const token = tokenOverride ?? (await api.get('/api/auth/socket-token')).body.data.token;
  const s = ioClient(api.url, { auth: { token }, transports: ['websocket'], reconnection: false, forceNew: true }) as TestSocket;
  s.log = [];
  s.onAny((ev, p) => s.log.push({ ev, p }));
  await new Promise<void>((resolve, reject) => {
    s.once('connect', () => resolve());
    s.once('connect_error', (e) => reject(e));
  });
  return s;
}

export const emit = (s: Socket, ev: string, payload?: unknown): Promise<Ack> =>
  new Promise((resolve) => s.emit(ev, payload ?? {}, (ack: Ack) => resolve(ack)));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export { sleep };

/** Waits for an event (already logged since `since`, or arriving within `ms`). */
export async function waitEvent(s: TestSocket, ev: string, pred: (p: any) => boolean = () => true, since = 0, ms = 2500) {
  const end = Date.now() + ms;
  for (;;) {
    const hit = s.log.slice(since).find((e) => e.ev === ev && pred(e.p));
    if (hit) return hit.p;
    if (Date.now() > end) throw new Error(`timed out waiting for "${ev}" (saw: ${s.log.slice(since).map((e) => e.ev).join(', ') || 'nothing'})`);
    await sleep(15);
  }
}
export async function expectNoEvent(s: TestSocket, ev: string, since: number, ms = 350, pred: (p: any) => boolean = () => true) {
  await sleep(ms);
  const hit = s.log.slice(since).find((e) => e.ev === ev && pred(e.p));
  if (hit) throw new Error(`unexpected "${ev}" event: ${JSON.stringify(hit.p)}`);
}

/** Creates a room as `host`, joins `members` via REST, and connects everyone's sockets to it. */
export async function setupRoom(ctx: Ctx, host: Awaited<ReturnType<typeof newUser>>, members: Awaited<ReturnType<typeof newUser>>[] = [], opts: Record<string, unknown> = {}) {
  const created = await host.api.post('/api/rooms', { name: 'Test Room', privacy: 'public', ...opts });
  if (created.status !== 201) throw new Error('create failed ' + JSON.stringify(created.body));
  const code: string = created.body.data.room.code;
  const hostSock = await connect(host.api);
  const hj = await emit(hostSock, 'room:join', { code });
  if (!hj.ok) throw new Error('host join failed ' + JSON.stringify(hj));
  const sockets: TestSocket[] = [];
  for (const m of members) {
    const j = await m.api.post(`/api/rooms/${code}/join`, {});
    if (j.status !== 200) throw new Error('rest join failed ' + JSON.stringify(j.body));
    const s = await connect(m.api);
    const sj = await emit(s, 'room:join', { code });
    if (!sj.ok) throw new Error('socket join failed ' + JSON.stringify(sj));
    sockets.push(s);
  }
  return { code, hostSock, sockets, close: () => { hostSock.close(); sockets.forEach((s) => s.close()); } };
}
