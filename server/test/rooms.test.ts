import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, newUser, setupRoom, connect, emit, waitEvent, sleep, type Ctx } from './helpers';

let ctx: Ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.stop(); });

describe('rooms REST', () => {
  it('creates rooms with validation, unique 6-char codes, and host membership', async () => {
    const host = await newUser(ctx, 'host');
    assert.equal((await host.api.post('/api/rooms', { name: '' })).status, 400);
    assert.equal((await host.api.post('/api/rooms', { name: 'x'.repeat(61) })).status, 400);
    assert.equal((await host.api.post('/api/rooms', { name: 'Pub', privacy: 'public', password: 'secret1' })).status, 400, 'public rooms cannot have a password');
    assert.equal((await host.api.post('/api/rooms', { name: 'Bad', videoUrl: 'not a url' })).body.error.code, 'INVALID_VIDEO');
    const codes = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const r = await host.api.post('/api/rooms', { name: `Room ${i}`, description: 'desc <script>alert(1)</script>' });
      assert.equal(r.status, 201);
      assert.match(r.body.data.room.code, /^[A-HJ-KM-NP-Z2-9]{6}$/);
      assert.equal(r.body.data.room.myRole, 'host');
      assert.ok(!r.body.data.room.description.includes('<'));
      assert.equal(r.body.data.room.passwordHash, undefined);
      codes.add(r.body.data.room.code);
    }
    assert.equal(codes.size, 15);
  });

  it('creates a room with an initial video', async () => {
    const host = await newUser(ctx, 'host');
    const r = await host.api.post('/api/rooms', { name: 'Preloaded', videoUrl: 'https://youtu.be/dQw4w9WgXcQ?t=5' });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.room.video.videoId, 'dQw4w9WgXcQ');
    assert.match(r.body.data.room.video.thumbnail, /ytimg\.com\/vi\/dQw4w9WgXcQ/);
  });

  it('discover lists only public rooms, supports search, pagination and never leaks private ones', async () => {
    const host = await newUser(ctx, 'host');
    const viewer = await newUser(ctx, 'viewer');
    const pub = (await host.api.post('/api/rooms', { name: 'Zebra Documentary Night', privacy: 'public' })).body.data.room;
    const priv = (await host.api.post('/api/rooms', { name: 'Zebra Secret Club', privacy: 'private' })).body.data.room;
    const res = await viewer.api.get('/api/rooms/discover?q=zebra');
    assert.equal(res.status, 200);
    const codes = res.body.data.items.map((r: any) => r.code);
    assert.ok(codes.includes(pub.code));
    assert.ok(!codes.includes(priv.code));
    assert.equal(res.body.data.items.find((r: any) => r.code === pub.code).host.username, host.username);
    // search by host name, case-insensitive, and LIKE wildcards are escaped
    assert.ok((await viewer.api.get(`/api/rooms/discover?q=${host.username.toUpperCase()}`)).body.data.items.length >= 1);
    assert.equal((await viewer.api.get('/api/rooms/discover?q=%25')).body.data.items.length, 0);
    const page = await viewer.api.get('/api/rooms/discover?limit=2&offset=0');
    assert.equal(page.body.data.items.length, 2); assert.equal(page.body.data.hasMore, true);
    assert.equal((await viewer.api.get('/api/rooms/discover?limit=999')).status, 400);
    assert.equal((await viewer.api.get('/api/rooms/discover?filter=live')).body.data.items.length, 0, 'nobody is connected yet');
  });

  it('join: invalid code, not found, password flow, locked, banned', async () => {
    const host = await newUser(ctx, 'host');
    const guest = await newUser(ctx, 'guest');
    assert.equal((await guest.api.post('/api/rooms/ZZZZZZ/join', {})).body.error.code, 'ROOM_NOT_FOUND');
    assert.equal((await guest.api.post('/api/rooms/!!/join', {})).body.error.code, 'ROOM_NOT_FOUND');

    const room = (await host.api.post('/api/rooms', { name: 'Vault', privacy: 'private', password: 'letmein1' })).body.data.room;
    assert.equal(room.hasPassword, true);
    const noPw = await guest.api.post(`/api/rooms/${room.code}/join`, {});
    assert.equal(noPw.status, 403); assert.equal(noPw.body.error.code, 'PASSWORD_REQUIRED');
    assert.equal((await guest.api.post(`/api/rooms/${room.code}/join`, { password: 'wrong' })).body.error.code, 'INVALID_PASSWORD');
    const ok = await guest.api.post(`/api/rooms/${room.code.toLowerCase()}/join`, { password: 'letmein1' });
    assert.equal(ok.status, 200); assert.equal(ok.body.data.room.myRole, 'member');
    // existing members rejoin without the password; join is idempotent
    assert.equal((await guest.api.post(`/api/rooms/${room.code}/join`, {})).status, 200);

    // locked room blocks newcomers, not members
    const late = await newUser(ctx, 'late');
    assert.equal((await host.api.patch(`/api/rooms/${room.code}`, { locked: true })).status, 200);
    assert.equal((await late.api.post(`/api/rooms/${room.code}/join`, { password: 'letmein1' })).body.error.code, 'ROOM_LOCKED');
    assert.equal((await guest.api.post(`/api/rooms/${room.code}/join`, {})).status, 200);
  });

  it('only the host can update or delete; privacy change drops the password; settings persist', async () => {
    const host = await newUser(ctx, 'host');
    const other = await newUser(ctx, 'other');
    const room = (await host.api.post('/api/rooms', { name: 'Mine', privacy: 'private', password: 'pass1234' })).body.data.room;
    await other.api.post(`/api/rooms/${room.code}/join`, { password: 'pass1234' });
    assert.equal((await other.api.patch(`/api/rooms/${room.code}`, { name: 'Hacked' })).status, 403);
    assert.equal((await other.api.del(`/api/rooms/${room.code}`)).status, 403);
    assert.equal((await host.api.patch(`/api/rooms/${room.code}`, { maxParticipants: 1 })).status, 400);
    const upd = await host.api.patch(`/api/rooms/${room.code}`, { name: 'Renamed', privacy: 'public', description: 'hello' });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.data.room.hasPassword, false);
    const d = await other.api.get(`/api/rooms/${room.code}`);
    assert.equal(d.body.data.room.name, 'Renamed'); assert.equal(d.body.data.room.privacy, 'public');
    const { rows } = await ctx.pool.query('select name, privacy, password_hash from rooms where code=$1', [room.code]);
    assert.deepEqual([rows[0].name, rows[0].privacy, rows[0].password_hash], ['Renamed', 'public', null]);
    assert.equal((await host.api.del(`/api/rooms/${room.code}`)).status, 200);
    assert.equal((await host.api.get(`/api/rooms/${room.code}`)).status, 404);
  });

  it('my rooms, leave (member), host leave hands over, sole host cannot orphan the room', async () => {
    const host = await newUser(ctx, 'host');
    const guest = await newUser(ctx, 'guest');
    const room = (await host.api.post('/api/rooms', { name: 'Leave test' })).body.data.room;
    await guest.api.post(`/api/rooms/${room.code}/join`, {});
    const mine = await guest.api.get('/api/rooms/mine');
    assert.ok(mine.body.data.rooms.some((r: any) => r.code === room.code && r.myRole === 'member'));
    assert.equal((await guest.api.post(`/api/rooms/${room.code}/leave`)).body.data.left, true);
    assert.ok(!(await guest.api.get('/api/rooms/mine')).body.data.rooms.some((r: any) => r.code === room.code));
    // sole host: leave is a no-op, room stays
    const sole = await host.api.post(`/api/rooms/${room.code}/leave`);
    assert.equal(sole.body.data.left, false);
    assert.ok((await host.api.get('/api/rooms/mine')).body.data.rooms.some((r: any) => r.code === room.code));
    // host with others: host passes on, then leaves
    await guest.api.post(`/api/rooms/${room.code}/join`, {});
    assert.equal((await host.api.post(`/api/rooms/${room.code}/leave`)).body.data.left, true);
    assert.equal((await guest.api.get(`/api/rooms/${room.code}`)).body.data.room.myRole, 'host');
  });

  it('invites create notifications; notifications can be read and deleted', async () => {
    const host = await newUser(ctx, 'host');
    const friend = await newUser(ctx, 'friend');
    const stranger = await newUser(ctx, 'stranger');
    const room = (await host.api.post('/api/rooms', { name: 'Invite me' })).body.data.room;
    assert.equal((await stranger.api.post(`/api/rooms/${room.code}/invite`, { username: friend.username })).status, 403, 'non-members cannot invite');
    assert.equal((await host.api.post(`/api/rooms/${room.code}/invite`, { username: 'nobody_here' })).status, 404);

    const fs = await connect(friend.api);                  // live push
    const mark = fs.log.length;
    assert.equal((await host.api.post(`/api/rooms/${room.code}/invite`, { username: friend.username })).status, 200);
    const pushed = await waitEvent(fs, 'notification:new', () => true, mark);
    assert.equal(pushed.type, 'invite'); assert.equal(pushed.link, `/room/${room.code}`);

    const list = await friend.api.get('/api/notifications');
    assert.equal(list.body.data.unread, 1);
    assert.equal((await friend.api.post('/api/notifications/read', {})).status, 200);
    assert.equal((await friend.api.get('/api/notifications')).body.data.unread, 0);
    assert.equal((await friend.api.del(`/api/notifications/${list.body.data.items[0].id}`)).status, 200);
    assert.equal((await friend.api.get('/api/notifications')).body.data.items.length, 0);
    fs.close();
  });

  it('user search and "watched with" friends list', async () => {
    const a = await newUser(ctx, 'sam');
    const b = await newUser(ctx, 'sue');
    const room = (await a.api.post('/api/rooms', { name: 'Co-watch' })).body.data.room;
    await b.api.post(`/api/rooms/${room.code}/join`, {});
    const f = await a.api.get('/api/users/friends');
    assert.deepEqual(f.body.data.friends.map((x: any) => x.username), [b.username]);
    assert.equal(f.body.data.friends[0].passwordHash, undefined);
    assert.equal(f.body.data.friends[0].email, undefined);
    const s = await a.api.get(`/api/users/search?q=${b.username.slice(0, 4)}`);
    assert.ok(s.body.data.users.some((u: any) => u.username === b.username));
    assert.ok(!s.body.data.users.some((u: any) => u.id === a.user.id));
    assert.equal((await a.api.get('/api/users/search?q=a')).status, 400);
  });

  it('watch history: one row per video, positions saved on leave, removable', async () => {
    const host = await newUser(ctx, 'host');
    const room = await setupRoom(ctx, host);
    const a = await emit(room.hostSock, 'video:change', { url: 'dQw4w9WgXcQ' });
    assert.ok(a.ok, JSON.stringify(a));
    await emit(room.hostSock, 'video:change', { url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' });
    await emit(room.hostSock, 'video:change', { url: 'dQw4w9WgXcQ' });             // same video again → no duplicate
    const h = await host.api.get('/api/history');
    assert.equal(h.body.data.items.length, 2);
    assert.equal(h.body.data.items[0].videoId, 'dQw4w9WgXcQ');                      // most recent first
    await emit(room.hostSock, 'video:seek', { time: 42 });
    room.hostSock.close();                                                          // disconnect → position saved after grace
    await sleep(900);
    const pos = (await host.api.get('/api/history')).body.data.items[0];
    assert.ok(pos.lastPosition >= 41, `lastPosition ${pos.lastPosition}`);
    assert.equal((await host.api.del(`/api/history/${pos.id}`)).status, 200);
    assert.equal((await host.api.get('/api/history')).body.data.items.length, 1);
    assert.equal((await host.api.del('/api/history')).status, 200);
    assert.equal((await host.api.get('/api/history')).body.data.items.length, 0);
    // users cannot touch each other's history
    const other = await newUser(ctx, 'other');
    assert.equal((await other.api.del('/api/history')).status, 200);
  });
});
