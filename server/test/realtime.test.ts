import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, newUser, setupRoom, connect, emit, waitEvent, expectNoEvent, sleep, type Ctx } from './helpers';

let ctx: Ctx;
before(async () => { ctx = await startServer(); });
after(async () => { await ctx.stop(); });

describe('realtime: join & presence', () => {
  it('requires membership; snapshot has role, participants and video; duplicate join is idempotent', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest'); const outsider = await newUser(ctx, 'out');
    const room = await setupRoom(ctx, host, [guest]);

    const os = await connect(outsider.api);
    const denied = await emit(os, 'room:join', { code: room.code });
    assert.equal(denied.ok, false); assert.equal(denied.error?.code, 'NOT_MEMBER');
    assert.equal((await emit(os, 'room:join', { code: 'ZZZZZZ' })).error?.code, 'ROOM_NOT_FOUND');
    assert.equal((await emit(os, 'room:join', { code: '' })).error?.code, 'VALIDATION_ERROR');
    assert.equal((await emit(os, 'video:play', { time: 1 })).error?.code, 'NOT_MEMBER', 'no events before joining');

    const gs = room.sockets[0];
    const again = await emit(gs, 'room:join', { code: room.code });
    assert.ok(again.ok);
    assert.equal(again.data.you.role, 'member');
    assert.equal(again.data.participants.length, 2, 'duplicate join does not duplicate the participant');
    assert.deepEqual(again.data.participants.map((p: any) => p.role), ['host', 'member']);
    assert.ok(again.data.video.serverNow > 0);
    os.close(); room.close();
  });

  it('broadcasts joins/leaves; a quick refresh does not flap; same user in two tabs counts once', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest');
    const room = await setupRoom(ctx, host, [guest]);
    const hs = room.hostSock;
    const mark = hs.log.length;
    // second tab for the guest
    const tab2 = await connect(guest.api); await emit(tab2, 'room:join', { code: room.code });
    const upd = await waitEvent(hs, 'presence:update', () => true, mark);
    assert.equal(upd.participants.filter((p: any) => p.userId === guest.user.id).length, 1);
    // refresh: close tab 1 and tab 2, reconnect inside the grace period → no "left" message
    const m2 = hs.log.length;
    room.sockets[0].close(); tab2.close();
    await sleep(100);
    const back = await connect(guest.api); await emit(back, 'room:join', { code: room.code });
    await expectNoEvent(hs, 'chat:message', m2, 700, (m) => /left/.test(m.text));
    // really leaving shows "left" and marks them offline
    const m3 = hs.log.length;
    back.close();
    const left = await waitEvent(hs, 'chat:message', (m) => /left/.test(m.text), m3, 2000);
    assert.match(left.text, /guest/i);
    const pu = await waitEvent(hs, 'presence:update', (p) => !p.participants.some((x: any) => x.userId === guest.user.id), m3);
    assert.equal(pu.participants.length, 1);
    room.close();
  });
});

describe('realtime: synchronised playback', () => {
  it('host actions reach members; sender gets an authoritative ack; echoes are suppressed', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest');
    const room = await setupRoom(ctx, host, [guest]);
    const [gs] = room.sockets; const hs = room.hostSock;

    let m = gs.log.length;
    const ch = await emit(hs, 'video:change', { url: 'https://youtu.be/dQw4w9WgXcQ' });
    assert.ok(ch.ok); assert.equal(ch.data.videoId, 'dQw4w9WgXcQ'); assert.equal(ch.data.playing, true);
    const st = await waitEvent(gs, 'video:state', (p) => p.videoId === 'dQw4w9WgXcQ', m);
    assert.equal(st.time, 0); assert.equal(st.playing, true);

    m = gs.log.length; const hm = hs.log.length;
    const pause = await emit(hs, 'video:pause', { time: 12.5 });
    assert.ok(pause.ok); assert.equal(pause.data.playing, false);
    const p1 = await waitEvent(gs, 'video:state', (p) => p.playing === false, m);
    assert.equal(p1.time, 12.5); assert.equal(p1.by, host.user.id);
    await expectNoEvent(hs, 'video:state', hm, 250);                      // sender is not echoed its own event

    m = gs.log.length;
    await emit(hs, 'video:seek', { time: 100 });
    assert.equal((await waitEvent(gs, 'video:state', (p) => p.time === 100, m)).playing, false);

    m = gs.log.length;
    await emit(hs, 'video:play', { time: 100 });
    const p2 = await waitEvent(gs, 'video:state', (p) => p.playing === true, m);
    assert.ok(p2.rev > p1.rev, 'revision increases on every change');

    // identical repeat commands are no-ops → no rebroadcast storm
    m = gs.log.length;
    await emit(hs, 'video:play', { time: 100.3 });
    await expectNoEvent(gs, 'video:state', m, 250);
    room.close();
  });

  it('members cannot control playback — enforced on the server, and nothing is broadcast', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest');
    const room = await setupRoom(ctx, host, [guest]);
    const [gs] = room.sockets; const hs = room.hostSock;
    await emit(hs, 'video:change', { url: 'dQw4w9WgXcQ' });
    const m = hs.log.length;
    for (const [ev, payload] of [['video:play', { time: 5 }], ['video:pause', { time: 5 }], ['video:seek', { time: 99 }], ['video:change', { url: '9bZkp7q19f0' }], ['video:heartbeat', { rev: 1, time: 1, playing: true }]] as const) {
      const r = await emit(gs, ev, payload);
      assert.equal(r.ok, false, ev); assert.equal(r.error?.code, 'FORBIDDEN', ev);
    }
    await expectNoEvent(hs, 'video:state', m, 250);
    assert.equal((await emit(gs, 'video:sync')).data.videoId, 'dQw4w9WgXcQ', 'but members may request state');
    room.close();
  });

  it('validates input: bad URLs, NaN/negative/huge times, extra garbage', async () => {
    const host = await newUser(ctx, 'host');
    const room = await setupRoom(ctx, host);
    const hs = room.hostSock;
    assert.equal((await emit(hs, 'video:change', { url: 'https://example.com/x' })).error?.code, 'INVALID_VIDEO');
    assert.equal((await emit(hs, 'video:change', {})).error?.code, 'VALIDATION_ERROR');
    await emit(hs, 'video:change', { url: 'dQw4w9WgXcQ' });
    for (const t of [-1, 1e12, 'abc', null]) assert.equal((await emit(hs, 'video:seek', { time: t })).error?.code, 'VALIDATION_ERROR', String(t));
    assert.equal((await emit(hs, 'video:seek', undefined)).error?.code, 'VALIDATION_ERROR');
    hs.emit('video:play', 'not-an-object');            // no ack, must not crash the server
    hs.emit('chat:send');
    await sleep(100);
    assert.equal((await emit(hs, 'clock:sync')).ok, true, 'server still healthy');
    room.close();
  });

  it('late joiners receive the position advanced by elapsed time; heartbeats cannot clobber newer state', async () => {
    const host = await newUser(ctx, 'host'); const late = await newUser(ctx, 'late');
    const room = await setupRoom(ctx, host);
    const hs = room.hostSock;
    await emit(hs, 'video:change', { url: 'dQw4w9WgXcQ' });
    const seek = await emit(hs, 'video:seek', { time: 50 });
    await sleep(1200);
    await late.api.post(`/api/rooms/${room.code}/join`, {});
    const ls = await connect(late.api);
    const snap = await emit(ls, 'room:join', { code: room.code });
    const v = snap.data.video;
    const effective = v.playing ? v.time + (v.serverNow - v.updatedAt) / 1000 : v.time;
    assert.ok(v.playing && effective >= 51 && effective < 54, `effective time ${effective}`);

    // fresh heartbeat with correct rev: small drift tracked silently, big drift corrected + broadcast
    const m = ls.log.length;
    assert.equal((await emit(hs, 'video:heartbeat', { rev: v.rev, time: effective + 0.4, playing: true })).data.result, 'ok');
    await expectNoEvent(ls, 'video:state', m, 200);
    assert.equal((await emit(hs, 'video:heartbeat', { rev: v.rev, time: effective + 30, playing: true })).data.result, 'corrected');
    await waitEvent(ls, 'video:state', (p) => p.time >= effective + 29, m);
    // stale rev (someone changed state since) and mismatched play state are ignored
    assert.equal((await emit(hs, 'video:heartbeat', { rev: v.rev, time: 1, playing: true })).data.result, 'ignored');
    assert.equal((await emit(hs, 'video:heartbeat', { rev: seek.data.rev + 10, time: 1, playing: false })).data.result, 'ignored');
    ls.close(); room.close();
  });

  it('room isolation: events in room A never reach room B', async () => {
    const hostA = await newUser(ctx, 'hosta'); const hostB = await newUser(ctx, 'hostb');
    const ra = await setupRoom(ctx, hostA); const rb = await setupRoom(ctx, hostB);
    const m = rb.hostSock.log.length;
    await emit(ra.hostSock, 'video:change', { url: 'dQw4w9WgXcQ' });
    await emit(ra.hostSock, 'chat:send', { text: 'secret for room A' });
    await emit(ra.hostSock, 'reaction:send', { emoji: '🔥' });
    await emit(ra.hostSock, 'chat:clear');
    await sleep(300);
    const leaked = rb.hostSock.log.slice(m).filter((e) => ['video:state', 'chat:message', 'reaction', 'chat:cleared', 'presence:update'].includes(e.ev));
    assert.deepEqual(leaked, []);
    // a client cannot target another room by lying in the payload
    assert.equal((await emit(rb.hostSock, 'video:change', { url: '9bZkp7q19f0', code: ra.code })).ok, true);
    assert.equal((await emit(ra.hostSock, 'video:sync')).data.videoId, 'dQw4w9WgXcQ');
    ra.close(); rb.close();
  });

  it('moving a socket to another room detaches it from the first', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest');
    const r1 = await setupRoom(ctx, host, [guest]);
    const r2 = (await host.api.post('/api/rooms', { name: 'Second' })).body.data.room;
    const gs = r1.sockets[0];
    await guest.api.post(`/api/rooms/${r2.code}/join`, {});
    assert.ok((await emit(gs, 'room:join', { code: r2.code })).ok);
    const m = gs.log.length;
    await emit(r1.hostSock, 'chat:send', { text: 'hello room one' });
    await expectNoEvent(gs, 'chat:message', m, 250, (x) => x.text === 'hello room one');
    r1.close(); gs.close();
  });
});

describe('realtime: chat & reactions', () => {
  it('delivers messages with sender info, sanitises content, rejects empty/oversize, rate-limits', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest');
    const room = await setupRoom(ctx, host, [guest]);
    const [gs] = room.sockets; const hs = room.hostSock;

    let m = hs.log.length;
    assert.ok((await emit(gs, 'chat:send', { text: 'Hello <img src=x onerror=alert(1)> world' })).ok);
    const msg = await waitEvent(hs, 'chat:message', (x) => x.type === 'user', m);
    assert.equal(msg.userId, guest.user.id); assert.equal(msg.displayName, guest.user.displayName);
    assert.equal(msg.role, 'member'); assert.ok(msg.avatarColor); assert.ok(msg.createdAt > 0);
    assert.ok(!msg.text.includes('<') && !msg.text.includes('>'), msg.text);
    assert.equal((await emit(gs, 'chat:send', { text: '   \n  ' })).error?.code, 'VALIDATION_ERROR');
    assert.equal((await emit(gs, 'chat:send', { text: '​\u0000' })).error?.code, 'VALIDATION_ERROR');
    assert.equal((await emit(gs, 'chat:send', { text: 'x'.repeat(3000) })).error?.code, 'VALIDATION_ERROR');
    m = hs.log.length;
    await emit(gs, 'chat:send', { text: 'y'.repeat(900) });
    assert.equal((await waitEvent(hs, 'chat:message', (x) => x.type === 'user', m)).text.length, 500, 'long messages are cut to 500');

    // rate limit: 6 per 6s per user
    const results: string[] = [];
    for (let i = 0; i < 8; i++) { const r = await emit(gs, 'chat:send', { text: `spam ${i}` }); results.push(r.ok ? 'ok' : r.error!.code); }
    assert.ok(results.includes('RATE_LIMITED'), results.join());
    // persisted: a fresh joiner sees history
    const late = await connect(guest.api);
    const snap = await emit(late, 'room:join', { code: room.code });
    assert.ok(snap.data.messages.some((x: any) => x.text === 'Hello img src=x onerror=alert(1) world'));
    late.close(); room.close();
  });

  it('message deletion rules and clear-chat are host/moderator gated', async () => {
    const host = await newUser(ctx, 'host'); const mod = await newUser(ctx, 'mod'); const a = await newUser(ctx, 'a'); const b = await newUser(ctx, 'b');
    const room = await setupRoom(ctx, host, [mod, a, b]);
    const [ms, as, bs] = room.sockets; const hs = room.hostSock;
    assert.ok((await emit(hs, 'mod:role', { userId: mod.user.id, role: 'moderator' })).ok);

    const send = async (s: typeof as, text: string) => (await emit(s, 'chat:send', { text })).data.id as string;
    const idA = await send(as, 'from a'); const idB = await send(bs, 'from b'); const idH = await send(hs, 'from host'); const idM = await send(ms, 'from mod');

    assert.equal((await emit(as, 'chat:delete', { id: idB })).error?.code, 'FORBIDDEN', 'member cannot delete others');
    assert.ok((await emit(as, 'chat:delete', { id: idA })).ok, 'members can delete their own');
    const m = bs.log.length;
    assert.ok((await emit(ms, 'chat:delete', { id: idB })).ok, 'moderator can delete a member message');
    assert.equal((await waitEvent(bs, 'chat:deleted', (x) => x.id === idB, m)).id, idB);
    assert.equal((await emit(ms, 'chat:delete', { id: idH })).error?.code, 'FORBIDDEN', 'moderator cannot delete the host');
    assert.ok((await emit(hs, 'chat:delete', { id: idM })).ok, 'host can delete anything');
    assert.equal((await emit(ms, 'chat:delete', { id: idB })).error?.code, 'NOT_FOUND');
    assert.equal((await emit(ms, 'chat:delete', { id: 'nope' })).error?.code, 'VALIDATION_ERROR');

    assert.equal((await emit(ms, 'chat:clear')).error?.code, 'FORBIDDEN', 'moderator cannot clear');
    const m2 = bs.log.length;
    assert.ok((await emit(hs, 'chat:clear')).ok);
    await waitEvent(bs, 'chat:cleared', () => true, m2);
    const late = await connect(a.api);
    const snap = await emit(late, 'room:join', { code: room.code });
    assert.ok(!snap.data.messages.some((x: any) => x.type === 'user'), 'cleared messages are gone from history');
    late.close(); room.close();
  });

  it('reactions broadcast to everyone (including sender), reject unknown emoji, are not stored', async () => {
    const host = await newUser(ctx, 'host'); const guest = await newUser(ctx, 'guest');
    const room = await setupRoom(ctx, host, [guest]);
    const [gs] = room.sockets;
    const m = room.hostSock.log.length; const gm = gs.log.length;
    assert.ok((await emit(gs, 'reaction:send', { emoji: '🔥' })).ok);
    const r = await waitEvent(room.hostSock, 'reaction', () => true, m);
    assert.equal(r.emoji, '🔥'); assert.equal(r.displayName, guest.user.displayName);
    await waitEvent(gs, 'reaction', () => true, gm);
    assert.equal((await emit(gs, 'reaction:send', { emoji: '💩' })).error?.code, 'VALIDATION_ERROR');
    assert.equal((await emit(gs, 'reaction:send', { emoji: '<script>' })).error?.code, 'VALIDATION_ERROR');
    const { rows } = await ctx.pool.query("select count(*)::int as n from messages where body like '%🔥%'");
    assert.equal(rows[0].n, 0);
    room.close();
  });
});

describe('realtime: moderation & host controls', () => {
  it('host promotes a moderator who can then control playback; members cannot promote anyone', async () => {
    const host = await newUser(ctx, 'host'); const mod = await newUser(ctx, 'mod'); const mem = await newUser(ctx, 'mem');
    const room = await setupRoom(ctx, host, [mod, mem]);
    const [ms, es] = room.sockets; const hs = room.hostSock;
    await emit(hs, 'video:change', { url: 'dQw4w9WgXcQ' });
    assert.equal((await emit(ms, 'video:pause', { time: 3 })).error?.code, 'FORBIDDEN');
    assert.equal((await emit(es, 'mod:role', { userId: mem.user.id, role: 'moderator' })).error?.code, 'FORBIDDEN', 'self-promotion blocked');
    assert.equal((await emit(ms, 'mod:role', { userId: mem.user.id, role: 'moderator' })).error?.code, 'FORBIDDEN', 'moderators cannot promote');

    const m = ms.log.length;
    assert.ok((await emit(hs, 'mod:role', { userId: mod.user.id, role: 'moderator' })).ok);
    assert.equal((await waitEvent(ms, 'role:changed', () => true, m)).role, 'moderator');
    assert.ok((await waitEvent(es, 'presence:update', (p) => p.participants.some((x: any) => x.userId === mod.user.id && x.role === 'moderator'), 0)));
    const e = es.log.length;
    assert.ok((await emit(ms, 'video:pause', { time: 3 })).ok);
    assert.equal((await waitEvent(es, 'video:state', (p) => !p.playing, e)).by, mod.user.id);
    // demote again
    assert.ok((await emit(hs, 'mod:role', { userId: mod.user.id, role: 'member' })).ok);
    assert.equal((await emit(ms, 'video:play', { time: 3 })).error?.code, 'FORBIDDEN');
    assert.equal((await emit(hs, 'mod:role', { userId: host.user.id, role: 'member' })).error?.code, 'FORBIDDEN', 'host cannot demote themselves');
    room.close();
  });

  it('kick: host removes anyone but themself; moderators only members; kicked user is blocked from rejoining', async () => {
    const host = await newUser(ctx, 'host'); const mod = await newUser(ctx, 'mod'); const mod2 = await newUser(ctx, 'mod2'); const mem = await newUser(ctx, 'mem');
    const room = await setupRoom(ctx, host, [mod, mod2, mem]);
    const [ms, m2s, es] = room.sockets; const hs = room.hostSock;
    await emit(hs, 'mod:role', { userId: mod.user.id, role: 'moderator' });
    await emit(hs, 'mod:role', { userId: mod2.user.id, role: 'moderator' });

    assert.equal((await emit(es, 'mod:kick', { userId: mod.user.id })).error?.code, 'FORBIDDEN', 'member cannot kick');
    assert.equal((await emit(ms, 'mod:kick', { userId: host.user.id })).error?.code, 'FORBIDDEN', 'cannot kick host');
    assert.equal((await emit(ms, 'mod:kick', { userId: mod2.user.id })).error?.code, 'FORBIDDEN', 'moderator cannot kick moderator');
    assert.equal((await emit(hs, 'mod:kick', { userId: host.user.id })).error?.code, 'VALIDATION_ERROR', 'cannot kick yourself');

    const em = es.log.length;
    assert.ok((await emit(ms, 'mod:kick', { userId: mem.user.id })).ok);
    assert.equal((await waitEvent(es, 'room:removed', () => true, em)).reason, 'kicked');
    // kicked socket no longer receives room events and cannot act
    const em2 = es.log.length;
    await emit(hs, 'chat:send', { text: 'after kick' });
    await expectNoEvent(es, 'chat:message', em2, 250, (x) => x.text === 'after kick');
    assert.equal((await emit(es, 'chat:send', { text: 'let me in' })).error?.code, 'NOT_MEMBER');
    assert.equal((await emit(es, 'room:join', { code: room.code })).error?.code, 'BANNED');
    const rejoin = await mem.api.post(`/api/rooms/${room.code}/join`, {});
    assert.equal(rejoin.status, 403); assert.equal(rejoin.body.error.code, 'BANNED');
    const n = (await mem.api.get('/api/notifications')).body.data.items;
    assert.ok(n.some((x: any) => x.type === 'removed'));
    // host can also kick a moderator
    assert.ok((await emit(hs, 'mod:kick', { userId: mod2.user.id })).ok);
    room.close();
  });

  it('transfer host: old host becomes moderator, new host can manage, permissions follow immediately', async () => {
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a'); const b = await newUser(ctx, 'b');
    const room = await setupRoom(ctx, host, [a, b]);
    const [as, bs] = room.sockets; const hs = room.hostSock;
    assert.equal((await emit(as, 'mod:transfer', { userId: a.user.id })).error?.code, 'FORBIDDEN');
    assert.equal((await emit(hs, 'mod:transfer', { userId: host.user.id })).error?.code, 'VALIDATION_ERROR');
    assert.equal((await emit(hs, 'mod:transfer', { userId: '00000000-0000-4000-8000-000000000000' })).error?.code, 'NOT_FOUND');
    const m = as.log.length;
    assert.ok((await emit(hs, 'mod:transfer', { userId: a.user.id })).ok);
    assert.equal((await waitEvent(as, 'role:changed', () => true, m)).role, 'host');
    const pu = await waitEvent(bs, 'presence:update', (p) => p.participants[0]?.userId === a.user.id, 0);
    assert.equal(pu.participants.find((x: any) => x.userId === host.user.id).role, 'moderator');
    assert.equal((await emit(hs, 'mod:kick', { userId: b.user.id })).ok, true, 'old host (now moderator) can still kick members');
    assert.equal((await emit(hs, 'mod:role', { userId: b.user.id, role: 'moderator' })).error?.code, 'FORBIDDEN', 'but is no longer host');
    const { rows } = await ctx.pool.query('select u.username, rm.role from room_members rm join users u on u.id=rm.user_id join rooms r on r.id=rm.room_id where r.code=$1 and rm.role=$2', [room.code, 'host']);
    assert.deepEqual(rows.map((r) => r.username), [a.username], 'exactly one host in the DB');
    room.close();
  });

  it('lock, privacy change and settings are pushed live to everyone in the room', async () => {
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a');
    const room = await setupRoom(ctx, host, [a]);
    const m = room.sockets[0].log.length;
    await host.api.patch(`/api/rooms/${room.code}`, { locked: true, name: 'Locked down', privacy: 'private' });
    const upd = await waitEvent(room.sockets[0], 'room:updated', () => true, m);
    assert.equal(upd.locked, true); assert.equal(upd.name, 'Locked down'); assert.equal(upd.privacy, 'private');
    assert.equal((await a.api.patch(`/api/rooms/${room.code}`, { locked: false })).status, 403);
    room.close();
  });

  it('room is full → 409 ROOM_FULL for newcomers while members connect', async () => {
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a'); const b = await newUser(ctx, 'b');
    const room = await setupRoom(ctx, host, [a]);
    assert.equal((await host.api.patch(`/api/rooms/${room.code}`, { maxParticipants: 2 })).status, 200);
    const r = await b.api.post(`/api/rooms/${room.code}/join`, {});
    assert.equal(r.status, 409); assert.equal(r.body.error.code, 'ROOM_FULL');
    room.close();
  });

  it('delete room closes it for everyone', async () => {
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a');
    const room = await setupRoom(ctx, host, [a]);
    const m = room.sockets[0].log.length;
    assert.equal((await host.api.del(`/api/rooms/${room.code}`)).status, 200);
    await waitEvent(room.sockets[0], 'room:closed', () => true, m);
    assert.equal((await a.api.get(`/api/rooms/${room.code}`)).status, 404);
    room.close();
  });
});

describe('realtime: reconnect, persistence & lifecycle', () => {
  it('host leaving explicitly hands the room to a moderator (else earliest member)', async () => {
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a'); const b = await newUser(ctx, 'b');
    const room = await setupRoom(ctx, host, [a, b]);
    const [as, bs] = room.sockets;
    await emit(room.hostSock, 'mod:role', { userId: b.user.id, role: 'moderator' });
    const m = as.log.length;
    const r = await emit(room.hostSock, 'room:leave');
    assert.ok(r.ok); assert.equal(r.data.left, true);
    const pu = await waitEvent(as, 'presence:update', (p) => p.participants.length === 2 && p.participants[0].role === 'host', m);
    assert.equal(pu.participants[0].userId, b.user.id);
    assert.equal((await host.api.get(`/api/rooms/${room.code}`)).body.data.room.myRole, null);
    room.close();
  });

  it('absent host: after the timeout a successor is promoted automatically; returning host rejoins as moderator', async () => {
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a');
    const room = await setupRoom(ctx, host, [a]);
    const as = room.sockets[0];
    const m = as.log.length;
    room.hostSock.close();
    const sys = await waitEvent(as, 'chat:message', (x) => /is now the host/.test(x.text), m, 4000);
    assert.match(sys.text, /a \d+ is now the host/);
    const back = await connect(host.api);
    const snap = await emit(back, 'room:join', { code: room.code });
    assert.equal(snap.data.you.role, 'moderator');
    back.close(); room.close();
  });

  it('state survives a server-side eviction: video, position and roles are restored from the DB', async () => {
    const { registry } = await import('../src/realtime/registry');
    const host = await newUser(ctx, 'host'); const a = await newUser(ctx, 'a');
    const room = await setupRoom(ctx, host, [a]);
    await emit(room.hostSock, 'mod:role', { userId: a.user.id, role: 'moderator' });
    await emit(room.hostSock, 'video:change', { url: 'dQw4w9WgXcQ' });
    await emit(room.hostSock, 'video:pause', { time: 77 });
    await emit(room.hostSock, 'chat:send', { text: 'persist me' });
    room.close();
    await sleep(1300);                                       // grace + eviction timers
    registry.drop(room.code);
    assert.equal(registry.peek(room.code), undefined);

    const s = await connect(a.api);
    const snap = await emit(s, 'room:join', { code: room.code });
    assert.ok(snap.ok, JSON.stringify(snap));
    assert.equal(snap.data.you.role, 'moderator');
    assert.equal(snap.data.video.videoId, 'dQw4w9WgXcQ');
    assert.equal(snap.data.video.playing, false, 'never resumes as a "ghost" playing state');
    assert.ok(Math.abs(snap.data.video.time - 77) < 1.5, `time ${snap.data.video.time}`);
    assert.ok(snap.data.messages.some((x: any) => x.text === 'persist me'));
    s.close();
    const hostRow = await ctx.pool.query('select host_id from rooms where code=$1', [room.code]);
    assert.equal(hostRow.rows[0].host_id, host.user.id);
  });

  it('concurrent joins hydrate exactly one LiveRoom (no duplicate-host race)', async () => {
    const { registry } = await import('../src/realtime/registry');
    const host = await newUser(ctx, 'host');
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => newUser(ctx, 'u')));
    const created = (await host.api.post('/api/rooms', { name: 'Race' })).body.data.room;
    await Promise.all(users.map((u) => u.api.post(`/api/rooms/${created.code}/join`, {})));
    registry.drop(created.code);
    const socks = await Promise.all(users.map((u) => connect(u.api)));
    const acks = await Promise.all(socks.map((s) => emit(s, 'room:join', { code: created.code })));
    assert.ok(acks.every((a) => a.ok));
    const hosts = (await emit(socks[0], 'room:join', { code: created.code })).data.participants.filter((p: any) => p.role === 'host');
    assert.equal(hosts.length, 1);
    assert.equal(hosts[0].userId, host.user.id, 'host identity comes from the DB, not join order');
    socks.forEach((s) => s.close());
  });

  it('discover shows live participant counts and the live/playing filters work', async () => {
    const host = await newUser(ctx, 'host'); const viewer = await newUser(ctx, 'viewer');
    const room = await setupRoom(ctx, host, [], { name: 'Live Count Room' });
    await emit(room.hostSock, 'video:change', { url: 'dQw4w9WgXcQ' });
    const live = await viewer.api.get('/api/rooms/discover?filter=live');
    const card = live.body.data.items.find((r: any) => r.code === room.code);
    assert.ok(card); assert.equal(card.participantCount, 1); assert.equal(card.live, true);
    assert.equal(card.video.videoId, 'dQw4w9WgXcQ');
    assert.ok((await viewer.api.get('/api/rooms/discover?filter=playing')).body.data.items.some((r: any) => r.code === room.code));
    await emit(room.hostSock, 'video:pause', { time: 4 });
    assert.ok(!(await viewer.api.get('/api/rooms/discover?filter=playing')).body.data.items.some((r: any) => r.code === room.code));
    room.close();
  });
});
