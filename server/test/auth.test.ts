import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, Api, connect, type Ctx } from './helpers';

let ctx: Ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.stop(); });

const valid = { username: 'alice_w', email: 'Alice@Example.com', password: 'correct horse 1', displayName: 'Alice' };

describe('auth', () => {
  it('rejects invalid signup input with field-level messages', async () => {
    const api = new Api(ctx.url);
    for (const [patch, field] of [
      [{ username: 'ab' }, 'username'], [{ username: 'bad name!' }, 'username'],
      [{ email: 'nope' }, 'email'], [{ password: 'short' }, 'password'], [{ password: 'x'.repeat(73) }, 'password'],
    ] as const) {
      const r = await api.post('/api/auth/signup', { ...valid, ...patch });
      assert.equal(r.status, 400, JSON.stringify(patch));
      assert.equal(r.body.ok, false);
      assert.equal(r.body.error.code, 'VALIDATION_ERROR');
      assert.ok(r.body.error.details[field], `details.${field}`);
    }
  });

  it('signs up, sets an HTTP-only cookie, hides the password hash and stores a bcrypt hash', async () => {
    const api = new Api(ctx.url);
    const r = await api.post('/api/auth/signup', valid);
    assert.equal(r.status, 201);
    assert.equal(r.body.data.user.username, 'alice_w');
    assert.equal(r.body.data.user.email, 'alice@example.com');
    assert.equal(r.body.data.user.passwordHash, undefined);
    assert.ok(r.body.data.user.createdAt);
    const cookie = r.setCookie.find((c) => c.startsWith('mf.sid='))!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    const { rows } = await ctx.pool.query('select password_hash from users where username=$1', ['alice_w']);
    assert.match(rows[0].password_hash, /^\$2[aby]\$/);
    assert.ok(!JSON.stringify(rows).includes('correct horse'));
  });

  it('rejects duplicate username / email (409)', async () => {
    const api = new Api(ctx.url);
    const a = await api.post('/api/auth/signup', { ...valid, email: 'other@example.com' });
    assert.equal(a.status, 409); assert.ok(a.body.error.details.username);
    const b = await api.post('/api/auth/signup', { ...valid, username: 'someone_else', email: 'ALICE@example.com' });
    assert.equal(b.status, 409); assert.ok(b.body.error.details.email);
  });

  it('login: wrong password and unknown user give the same generic 401', async () => {
    const api = new Api(ctx.url);
    const a = await api.post('/api/auth/login', { identifier: 'alice_w', password: 'wrong-password' });
    const b = await api.post('/api/auth/login', { identifier: 'ghost', password: 'wrong-password' });
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.equal(a.body.error.code, 'INVALID_CREDENTIALS');
    assert.equal(a.body.error.message, b.body.error.message);
  });

  it('login by username or email, session persists, logout invalidates it', async () => {
    const api = new Api(ctx.url);
    assert.equal((await api.get('/api/auth/me')).status, 401);
    const r = await api.post('/api/auth/login', { identifier: 'alice@example.com', password: valid.password });
    assert.equal(r.status, 200);
    const me = await api.get('/api/auth/me');
    assert.equal(me.status, 200); assert.equal(me.body.data.user.username, 'alice_w');
    // a second request with the same cookie still works (persistence)
    assert.equal((await api.get('/api/auth/me')).status, 200);
    const oldCookie = api.cookie;
    assert.equal((await api.post('/api/auth/logout')).status, 200);
    assert.equal((await api.get('/api/auth/me')).status, 401);
    // the old cookie is dead server-side, not just cleared in the browser
    const replay = new Api(ctx.url); replay.cookie = oldCookie;
    assert.equal((await replay.get('/api/auth/me')).status, 401);
    const again = await new Api(ctx.url).post('/api/auth/login', { identifier: 'ALICE_W', password: valid.password });
    assert.equal(again.status, 200, 'username login is case-insensitive');
  });

  it('protected routes return 401 with a consistent error shape', async () => {
    const api = new Api(ctx.url);
    for (const [m, p] of [['GET', '/api/rooms/mine'], ['GET', '/api/history'], ['GET', '/api/notifications'], ['POST', '/api/rooms'], ['GET', '/api/auth/socket-token']]) {
      const r = await api.req(m, p, m === 'POST' ? {} : undefined);
      assert.equal(r.status, 401, `${m} ${p}`);
      assert.equal(r.body.error.code, 'UNAUTHENTICATED');
    }
  });

  it('sockets require a valid, unexpired signed token', async () => {
    const api = new Api(ctx.url);
    await api.post('/api/auth/login', { identifier: 'alice_w', password: valid.password });
    await assert.rejects(connect(api, 'garbage'), /UNAUTHORIZED/);
    const token = (await api.get('/api/auth/socket-token')).body.data.token as string;
    await assert.rejects(connect(api, token.slice(0, -3) + 'abc'), /UNAUTHORIZED/);
    const s = await connect(api, token); s.close();
  });

  it('blocks cross-site state-changing requests (CSRF origin guard) but allows same-site', async () => {
    const api = new Api(ctx.url);
    const bad = await api.req('POST', '/api/auth/login', { identifier: 'alice_w', password: valid.password }, { origin: 'https://evil.example' });
    assert.equal(bad.status, 403); assert.equal(bad.body.error.code, 'ORIGIN_NOT_ALLOWED');
    const ok = await api.req('POST', '/api/auth/login', { identifier: 'alice_w', password: valid.password }, { origin: 'http://localhost:5173' });
    assert.equal(ok.status, 200);
  });

  it('returns JSON for bad JSON, oversize bodies and unknown endpoints; never leaks stack traces', async () => {
    const raw = await fetch(ctx.url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{oops' });
    assert.equal(raw.status, 400);
    assert.equal(((await raw.json()) as any).error.code, 'BAD_JSON');
    const big = await fetch(ctx.url + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ x: 'a'.repeat(20000) }) });
    assert.equal(big.status, 413);
    const nf = await new Api(ctx.url).get('/api/does-not-exist');
    assert.equal(nf.status, 404); assert.equal(nf.body.error.code, 'NOT_FOUND');
    assert.ok(!/stack|\n\s+at /.test(JSON.stringify(nf.body)));
  });

  it('updates profile, changes password, health endpoint reports db', async () => {
    const api = new Api(ctx.url);
    await api.post('/api/auth/login', { identifier: 'alice_w', password: valid.password });
    const p = await api.patch('/api/users/me', { displayName: '  <b>Ali</b>  ', avatarColor: '#112233' });
    assert.equal(p.status, 200);
    assert.equal(p.body.data.user.displayName, 'bAli/b');   // angle brackets stripped
    assert.equal((await api.patch('/api/users/me', { avatarColor: 'red' })).status, 400);
    assert.equal((await api.post('/api/auth/password', { currentPassword: 'nope', newPassword: 'another pass 1' })).status, 400);
    assert.equal((await api.post('/api/auth/password', { currentPassword: valid.password, newPassword: 'another pass 1' })).status, 200);
    assert.equal((await new Api(ctx.url).post('/api/auth/login', { identifier: 'alice_w', password: valid.password })).status, 401);
    assert.equal((await new Api(ctx.url).post('/api/auth/login', { identifier: 'alice_w', password: 'another pass 1' })).status, 200);
    const h = await api.get('/health');
    assert.equal(h.status, 200); assert.equal(h.body.db, 'up');
  });
});
