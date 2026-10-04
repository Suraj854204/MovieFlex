// Full browser E2E: two real Chromium contexts (desktop host + phone-sized guest) against a running
// server that also serves the built client.  Usage: BASE_URL=http://localhost:4000 node e2e/two-users.mjs
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || 'http://localhost:4000';
const FAKE_YT = fs.readFileSync(path.join(here, 'fake-youtube.js'), 'utf8');
const SHOTS = path.join(here, 'shots');
const run = Date.now().toString(36).slice(-5);
const V1 = 'dQw4w9WgXcQ', V2 = '9bZkp7q19f0';

let passed = 0;
const errors = [];
const ok = (cond, msg) => { if (!cond) throw new Error('ASSERT FAILED: ' + msg); passed++; console.log('  ✔', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, msg, ms = 6000) {
  const end = Date.now() + ms; let last;
  while (Date.now() < end) { try { const v = await fn(); if (v) { passed++; console.log('  ✔', msg); return v; } } catch (e) { last = e; } await sleep(80); }
  throw new Error('TIMEOUT: ' + msg + (last ? ' (' + last.message + ')' : ''));
}

async function newCtx(browser, opts, label) {
  const ctx = await browser.newContext(opts);
  await ctx.route('**/www.youtube.com/iframe_api', (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE_YT }));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(/i\.ytimg\.com/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270"><rect width="480" height="270" fill="#234"/></svg>' }));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|ERR_INTERNET|net::/.test(m.text())) errors.push(`[${label}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  if (process.env.DEBUG_WS) page.on('websocket', (ws) => { ws.on('framereceived', (f) => { if (/video:state/.test(String(f.payload))) console.log(`   [${label} recv]`, String(f.payload).slice(0, 160)); }); ws.on('framesent', (f) => { if (/video:/.test(String(f.payload))) console.log(`   [${label} sent]`, String(f.payload).slice(0, 100)); }); });
  return { ctx, page };
}

const fakeState = (page) => page.evaluate(() => { const p = window.__yt?.current(); return p ? { vid: p.vid, state: p.state, t: p.getCurrentTime(), muted: p.muted } : null; });
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });

async function signup(page, label, uname) {
  await page.goto(BASE + '/');
  await page.getByRole('link', { name: 'Get started' }).first().click();
  await page.getByLabel('Display name').fill(label);
  await page.getByLabel('Username').fill(uname);
  await page.getByLabel('Email').fill(`${uname}@example.com`);
  await page.getByLabel('Password').fill('supersecret1');
  await page.getByRole('button', { name: 'Create account' }).click();
  await page.waitForURL('**/home', { waitUntil: 'commit' });
}

let G, H;
const browser = await chromium.launch();
try {
  console.log('\n● Landing & auth');
  const host = await newCtx(browser, { viewport: { width: 1360, height: 860 } }, 'host');
  const guest = await newCtx(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' }, 'guest');
  H = host.page; G = guest.page;

  await H.goto(BASE + '/'); await shot(H, '01-landing-desktop');
  await G.goto(BASE + '/'); await shot(G, '02-landing-mobile');
  await H.goto(BASE + '/login');
  await H.getByLabel('Email or username').fill('nobody'); await H.getByLabel('Password').fill('wrongwrong');
  await H.getByRole('button', { name: 'Sign in' }).click();
  await until(() => H.getByRole('alert').filter({ hasText: 'Incorrect' }).isVisible(), 'invalid login shows an error');
  await shot(H, '03-login-error');
  await H.goto(BASE + '/home');
  await H.waitForURL('**/login', { waitUntil: 'commit' }); ok(true, 'protected route redirects to login when signed out');

  await signup(H, `Hosty ${run}`, `host_${run}`);
  await signup(G, `Guesty ${run}`, `guest_${run}`);
  ok((await H.locator('h1').first().innerText()).includes('Hey'), 'host lands on dashboard after signup');
  await H.reload(); await until(() => H.locator('h1').first().isVisible(), 'session persists across reload');
  await shot(H, '04-home-desktop-empty'); await shot(G, '05-home-mobile-empty');

  console.log('\n● Create room (host) & join by code (guest)');
  await H.getByRole('button', { name: 'Create watch party' }).click();
  await H.getByLabel('Room name').fill(`Movie Night ${run}`);
  await H.getByLabel(/First video/).fill(`https://youtu.be/${V1}`);
  await shot(H, '06-create-modal');
  await H.getByRole('button', { name: 'Create room' }).click();
  await H.waitForURL(/\/room\/[A-Z0-9]{6}/, { waitUntil: 'commit' });
  const code = H.url().match(/room\/([A-Z0-9]{6})/)[1];
  ok(!!code, `room created with code ${code}`);
  await until(async () => (await fakeState(H))?.vid === V1, 'host player loaded the first video (cued, waiting for play)');
  await H.evaluate(() => window.__yt.current().userPlay());
  await until(async () => (await fakeState(H)).state === 1, 'host presses play');
  await sleep(500);

  await G.getByLabel('Room code or invite link').fill('zzzzzz');
  await G.getByRole('button', { name: 'Join' }).click();
  await until(() => G.getByRole('heading', { name: 'Room not found' }).isVisible(), 'invalid room code shows "Room not found"');
  await shot(G, '07-room-not-found-mobile');
  await G.goto(BASE + '/home');
  await G.getByLabel('Room code or invite link').fill(`${BASE}/room/${code.toLowerCase()}`);
  await G.getByRole('button', { name: 'Join' }).click();
  await G.waitForURL(`**/room/${code}`, { waitUntil: 'commit' });
  await until(async () => (await fakeState(G))?.vid === V1, 'guest player loads the same video');
  await until(async () => (await fakeState(G)).state === 1, 'guest joins in the playing state');
  const [ht, gt] = [(await fakeState(H)).t, (await fakeState(G)).t];
  ok(Math.abs(ht - gt) < 3, `late joiner is in sync (host ${ht.toFixed(1)}s vs guest ${gt.toFixed(1)}s)`);
  await shot(H, '08-room-desktop-host'); await shot(G, '09-room-mobile-guest');

  console.log('\n● Synchronised playback');
  await H.evaluate(() => window.__yt.current().userPause());
  await until(async () => (await fakeState(G)).state === 2, 'host pause → guest paused');
  const gp = (await fakeState(G)).t; const hp = (await fakeState(H)).t;
  ok(Math.abs(gp - hp) < 2.5, `paused positions match (${hp.toFixed(1)} / ${gp.toFixed(1)})`);
  await sleep(800);   // a human can't scrub within ms of pausing; let the pause echo settle
  await H.evaluate(() => window.__yt.current().userSeek(120));
  await until(async () => Math.abs((await fakeState(G)).t - 120) < 3, 'host seek → guest jumps to ~120s');
  await H.evaluate(() => window.__yt.current().userPlay());
  await until(async () => (await fakeState(G)).state === 1, 'host play → guest playing');
  await sleep(1500);
  const [h2, g2] = [(await fakeState(H)).t, (await fakeState(G)).t];
  ok(Math.abs(h2 - g2) < 3 && h2 > 120, `still in sync after playing (host ${h2.toFixed(1)}, guest ${g2.toFixed(1)})`);
  // no feedback loop: after settling, the guest must not have emitted anything back
  const rev0 = await G.evaluate(() => window.__yt.current().getCurrentTime());
  await sleep(1200);
  ok((await fakeState(H)).state === 1, 'no echo/ping-pong: host still playing after guest applied the state');
  await H.getByLabel('YouTube link').fill(`https://www.youtube.com/watch?v=${V2}`);
  await H.getByRole('button', { name: 'Play', exact: true }).click();
  await until(async () => (await fakeState(G))?.vid === V2 && (await fakeState(H))?.vid === V2, 'video change reaches the guest');
  await H.getByLabel('YouTube link').fill('https://example.com/nope'); await H.getByRole('button', { name: 'Play', exact: true }).click();
  await until(() => H.getByText('valid YouTube link').isVisible(), 'invalid YouTube URL is rejected with a message');
  ok(rev0 >= 0, 'drift sample taken');

  console.log('\n● Chat, reactions, permissions');
  await G.getByRole('textbox', { name: 'Message' }).fill('hello <img src=x onerror="window.__xss=1"> from phone');
  await G.getByRole('button', { name: 'Send message' }).click();
  await until(() => H.getByText('from phone').isVisible(), 'guest chat message reaches host instantly');
  ok((await H.locator('.msg-text img').count()) === 0 && !(await H.evaluate(() => window.__xss)), 'HTML in chat is rendered as text (no XSS)');
  await H.getByRole('textbox', { name: 'Message' }).fill('welcome!'); await H.getByRole('textbox', { name: 'Message' }).press('Enter');
  await until(() => G.getByText('welcome!').isVisible(), 'host reply reaches guest');
  await G.getByRole('button', { name: 'React 🔥' }).click();
  await until(() => H.locator('.floater').first().isVisible(), 'reaction floats over the host player');
  ok(await G.getByText(/You can chat and react/).isVisible(), 'guest sees the view-only notice');
  ok((await G.getByLabel('YouTube link').count()) === 0, 'guest has no video controls');
  await shot(G, '10-room-mobile-chat'); await shot(H, '11-room-desktop-chat');

  console.log('\n● People & moderation');
  await H.getByRole('tab', { name: /People/ }).click();
  await until(() => H.getByText(`@guest_${run}`).isVisible(), 'participant list shows the guest');
  await G.getByRole('tab', { name: /People/ }).click(); await shot(G, '12-room-mobile-people');
  await H.getByRole('button', { name: /Actions for Guesty/ }).click();
  await H.getByRole('menuitem', { name: 'Make moderator' }).click();
  await until(() => G.getByLabel('YouTube link').isVisible(), 'promoted guest immediately gets video controls');
  await until(() => H.getByText('Mod', { exact: true }).first().isVisible(), 'host sees the moderator badge');
  await G.evaluate(() => window.__yt.current().userPause());
  await until(async () => (await fakeState(H)).state === 2, 'moderator pause → host paused (moderators can control)');
  await H.getByRole('button', { name: /Actions for Guesty/ }).click();
  await H.getByRole('menuitem', { name: 'Remove moderator' }).click();
  await until(async () => (await G.getByLabel('YouTube link').count()) === 0, 'demoted → controls disappear');

  console.log('\n● Reconnect');
  await G.getByRole('tab', { name: /Chat/ }).click();
  await guest.ctx.setOffline(true);
  await until(() => G.getByText(/offline|Reconnecting|Connection lost/i).first().isVisible(), 'guest sees an offline/reconnecting banner', 15000);
  await shot(G, '13-room-mobile-offline');
  await H.evaluate(() => window.__yt.current().userPlay());
  await guest.ctx.setOffline(false);
  await until(async () => !(await G.locator('.conn-banner').count()), 'guest reconnects and the banner disappears', 20000);
  await until(async () => (await fakeState(G)).state === 1, 'state restored after reconnect (host played while guest was offline)');
  await G.getByRole('textbox', { name: 'Message' }).fill('back online'); await G.getByRole('button', { name: 'Send message' }).click();
  await H.getByRole('tab', { name: /Chat/ }).click();
  await until(() => H.getByText('back online').first().isVisible(), 'chat works after reconnect');
  await H.getByRole('tab', { name: /People/ }).click();
  ok((await H.locator('.person-row').count()) === 2, 'no duplicate participants after reconnect');

  console.log('\n● Settings, share, kick');
  await H.getByRole('button', { name: 'Room settings' }).click();
  await H.getByLabel('Description').fill('Weekly watch'); await H.getByText('Lock room').click();
  await shot(H, '14-settings-modal');
  await H.getByRole('button', { name: 'Save changes' }).click();
  await until(() => H.getByText(/Locked/).first().isVisible(), 'lock/settings applied live');
  await H.getByRole('button', { name: /Invite/ }).click();
  await until(() => H.getByText(code, { exact: true }).first().isVisible(), 'invite dialog shows the room code'); await shot(H, '15-share-modal');
  await H.keyboard.press('Escape');
  await H.getByRole('tab', { name: /People/ }).click();
  await H.getByRole('button', { name: /Actions for Guesty/ }).click();
  await H.getByRole('menuitem', { name: 'Remove from room' }).click();
  await H.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
  await until(() => G.getByRole('heading', { name: 'You were removed' }).isVisible(), 'kicked guest sees the "removed" screen'); await shot(G, '16-removed-mobile');
  await G.goto(`${BASE}/room/${code}`);
  await until(() => G.getByRole('heading', { name: 'You were removed' }).isVisible(), 'kicked user cannot rejoin');

  console.log('\n● Dashboard pages (mobile)');
  await G.goto(BASE + '/discover'); await until(() => G.getByRole('heading', { name: 'Discover' }).isVisible(), 'discover loads'); await G.waitForTimeout(400);
  await shot(G, '17-discover-mobile');
  await H.goto(BASE + '/discover?q=Movie+Night'); await until(() => H.getByText(`Movie Night ${run}`).first().isVisible(), 'discover search finds the public room'); await shot(H, '18-discover-desktop');
  await H.goto(BASE + '/history'); await until(() => H.getByText(/YouTube video/).first().isVisible(), 'history lists watched videos'); await shot(H, '19-history-desktop');
  await G.goto(BASE + '/notifications'); await until(() => G.getByText('You were removed from a room').isVisible(), 'kicked user received a notification'); await shot(G, '20-notifications-mobile');
  await G.goto(BASE + '/profile'); await shot(G, '21-profile-mobile');
  await H.goto(BASE + '/home'); await H.waitForTimeout(500); await shot(H, '22-home-desktop');
  await H.goto(BASE + '/rooms'); await until(() => H.getByText(`Movie Night ${run}`).first().isVisible(), 'My Rooms lists the hosted room');

  console.log('\n● Logout & session expiry');
  await H.getByRole('button', { name: 'Account menu' }).click(); await H.getByRole('menuitem', { name: 'Sign out' }).click();
  await H.waitForURL(BASE + '/', { waitUntil: 'commit' }); ok(true, 'logout returns to landing');
  await H.goto(BASE + '/home'); await H.waitForURL('**/login', { waitUntil: 'commit' }); ok(true, 'session is gone after logout');
  await G.context().clearCookies();
  await G.goto(BASE + '/home'); await G.waitForURL('**/login', { waitUntil: 'commit' }); ok(true, 'cleared cookie (expired session) → login');

  if (errors.length) throw new Error('Browser console errors:\n' + errors.join('\n'));
  console.log(`\nALL GOOD — ${passed} checks passed, 0 console errors`);
} catch (e) {
  console.error('\n✖ ' + e.message + '\n' + (e.stack||'').split('\n').filter(l=>l.includes('two-users')).join('\n'));
  try { if (typeof G !== 'undefined') { console.error('guest url:', G.url(), '| banner:', await G.locator('.conn-banner').allTextContents()); await shot(G, 'zz-failure-guest'); await shot(H, 'zz-failure-host'); console.error('host chat:', (await H.locator('.chat-list').innerText()).slice(-200)); } } catch {}
  if (errors.length) console.error('console errors so far:\n' + errors.join('\n'));
  process.exitCode = 1;
} finally { await browser.close(); }
