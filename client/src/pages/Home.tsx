// src/pages/Home.tsx

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { useCreateRoom } from '../components/CreateRoom';
import { JoinByCode } from '../components/JoinByCode';
import { RoomCard, Thumb } from '../components/RoomCard';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Avatar } from '../components/ui/Avatar';
import { Icon } from '../components/ui/Icon';
import { formatClock, timeAgo } from '../lib/format';
import { watchUrl } from '../lib/youtube';
import type { HistoryItem, PublicUser, RoomCardData } from '../lib/types';

/* ──────────────────────────────────────────────────────────────
   LAYOUT
   Phone   : top bar → hero → swipe rails → bottom tab bar
   Tablet  : single column, 2–3 col card grids
   Laptop  : hero (greeting + stats | create/join)
             main  = My Rooms, Live Now
             aside = Continue Watching, Watched With (sticky)
   ────────────────────────────────────────────────────────────── */

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

  :root {
    --hp-surface: rgba(15, 23, 42, 0.72);
    --hp-surface-2: rgba(30, 41, 59, 0.6);
    --hp-border: rgba(255, 255, 255, 0.08);
    --hp-border-strong: rgba(129, 140, 248, 0.4);

    --hp-text: #f8fafc;
    --hp-text-2: #a8b3c7;
    --hp-text-3: #7b88a1;

    --hp-brand: #6366f1;
    --hp-brand-2: #a855f7;
    --hp-live: #f43f5e;
    --hp-online: #10b981;
    --hp-grad: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);

    --hp-font-head: 'Space Grotesk', system-ui, sans-serif;
    --hp-font-body: 'Plus Jakarta Sans', system-ui, sans-serif;

    --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s5: 24px; --s6: 32px; --s7: 48px;
    --r-sm: 10px; --r-md: 14px; --r-lg: 22px;

    --hp-top-h: 56px;
    --hp-tab-h: 64px;
  }

  .hp-root, .hp-root *, .hp-root *::before, .hp-root *::after { box-sizing: border-box; }
  .hp-root {
    font-family: var(--hp-font-body);
    color: var(--hp-text);
    width: 100%;
    max-width: 1680px;
    margin-inline: auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--s5);
    padding-bottom: calc(var(--hp-tab-h) + env(safe-area-inset-bottom, 0px) + var(--s5));
  }
  .hp-root a { text-decoration: none; }
  .hp-root :focus-visible {
    outline: 2px solid #a5b4fc;
    outline-offset: 2px;
    border-radius: 8px;
  }

  /* ───────── Buttons ───────── */
  .hp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--s2);
    min-height: 48px;
    padding: 0 var(--s5);
    border: 0;
    border-radius: var(--r-md);
    background: var(--hp-grad);
    color: #fff;
    font: 700 15px/1 var(--hp-font-head);
    letter-spacing: -0.01em;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(99, 102, 241, 0.35);
    transition: transform .18s ease, box-shadow .18s ease;
    -webkit-tap-highlight-color: transparent;
  }
  .hp-btn:hover { transform: translateY(-1px); box-shadow: 0 10px 28px rgba(99, 102, 241, 0.5); }
  .hp-btn:active { transform: translateY(0) scale(.98); }

  /* ───────── Mobile top bar ───────── */
  .hp-top {
    position: sticky;
    top: 0;
    z-index: 60;
    height: var(--hp-top-h);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--s3);
    padding: 0 var(--s1);
    background: rgba(3, 7, 18, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--hp-border);
  }
  .hp-brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font: 700 18px/1 var(--hp-font-head);
    letter-spacing: -0.02em;
    color: var(--hp-text);
  }
  .hp-brand-mark {
    width: 30px; height: 30px;
    display: grid; place-items: center;
    border-radius: 9px;
    background: var(--hp-grad);
    font-size: 12px;
    box-shadow: 0 4px 14px rgba(99, 102, 241, .45);
  }
  .hp-top-actions { display: flex; align-items: center; gap: var(--s2); }
  .hp-icon-btn {
    width: 44px; height: 44px;
    display: grid; place-items: center;
    border-radius: var(--r-md);
    background: rgba(255,255,255,.05);
    border: 1px solid var(--hp-border);
    color: var(--hp-text);
    -webkit-tap-highlight-color: transparent;
  }
  .hp-me {
    width: 40px; height: 40px;
    display: grid; place-items: center;
    border-radius: 50%;
    background: var(--hp-grad);
    border: 2px solid rgba(255,255,255,.16);
    font: 700 15px/1 var(--hp-font-head);
    color: #fff;
  }

  /* ───────── Hero ───────── */
  .hp-hero {
    position: relative;
    display: grid;
    gap: var(--s5);
    padding: var(--s5);
    border-radius: var(--r-lg);
    background:
      radial-gradient(120% 140% at 0% 0%, rgba(99,102,241,.22) 0%, transparent 55%),
      radial-gradient(90% 120% at 100% 100%, rgba(168,85,247,.18) 0%, transparent 55%),
      var(--hp-surface);
    border: 1px solid var(--hp-border);
    overflow: hidden;
  }
  .hp-hero-copy { display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  .hp-eyebrow {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #a5b4fc;
    margin: 0 0 var(--s2);
  }
  .hp-hero h1 {
    margin: 0 0 var(--s2);
    font: 700 clamp(26px, 5.5vw, 44px)/1.1 var(--hp-font-head);
    letter-spacing: -0.03em;
    overflow-wrap: anywhere;
  }
  .hp-hero-copy > p {
    margin: 0;
    max-width: 54ch;
    font-size: 15px;
    line-height: 1.6;
    color: var(--hp-text-2);
  }

  /* stats strip */
  .hp-stats {
    display: none;
    gap: var(--s3);
    margin-top: var(--s5);
    flex-wrap: wrap;
  }
  .hp-stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 108px;
    padding: var(--s3) var(--s4);
    border-radius: var(--r-md);
    background: rgba(255,255,255,.04);
    border: 1px solid var(--hp-border);
  }
  .hp-stat b { font: 700 24px/1.1 var(--hp-font-head); letter-spacing: -0.02em; }
  .hp-stat span { font-size: 12px; font-weight: 600; color: var(--hp-text-3); }

  /* create / join panel */
  .hp-hero-actions {
    display: grid;
    gap: var(--s3);
    align-content: center;
    min-width: 0;
  }
  .hp-join {
    display: grid;
    gap: var(--s2);
    padding: var(--s3) var(--s4);
    border-radius: var(--r-md);
    background: rgba(255,255,255,.04);
    border: 1px solid var(--hp-border);
  }
  .hp-join > span {
    font-size: 12px;
    font-weight: 600;
    color: var(--hp-text-3);
  }

  /* ───────── Layout ───────── */
  .hp-layout { display: grid; gap: var(--s6); min-width: 0; }
  .hp-main { display: flex; flex-direction: column; gap: var(--s6); min-width: 0; }
  .hp-aside { display: flex; flex-direction: column; gap: var(--s6); min-width: 0; }

  /* ───────── Section ───────── */
  .hp-section { display: flex; flex-direction: column; gap: var(--s4); min-width: 0; }
  .hp-head { display: flex; align-items: center; justify-content: space-between; gap: var(--s3); }
  .hp-head h2 {
    display: flex; align-items: center; gap: 10px;
    margin: 0;
    font: 700 20px/1.2 var(--hp-font-head);
    letter-spacing: -0.02em;
  }
  .hp-badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: rgba(244, 63, 94, .14);
    border: 1px solid rgba(244, 63, 94, .35);
    color: #fda4af;
    font: 700 11px/1.4 var(--hp-font-body);
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .hp-badge i {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--hp-live);
    animation: hpPulse 1.8s ease-in-out infinite;
  }
  @keyframes hpPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(244,63,94,.6); }
    50% { box-shadow: 0 0 0 6px rgba(244,63,94,0); }
  }
  .hp-seeall {
    display: inline-flex; align-items: center; gap: 4px;
    min-height: 44px;
    padding: 0 var(--s1);
    font-size: 14px; font-weight: 600;
    color: #a5b4fc;
    white-space: nowrap;
  }
  .hp-seeall:hover { color: #c7d2fe; }

  /* ───────── Card rail: swipe on phone, auto-fit grid on larger ───────── */
  .hp-rail {
    display: flex;
    gap: var(--s3);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: var(--s1);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    padding-bottom: var(--s2);
    scrollbar-width: none;
  }
  .hp-rail::-webkit-scrollbar { display: none; }
  .hp-rail > * { flex: 0 0 82%; max-width: 360px; scroll-snap-align: start; min-width: 0; }
  .hp-skel { min-width: 0; }

  /* ───────── History rows ───────── */
  .hp-hist-list { display: grid; gap: var(--s3); }
  .hp-hist {
    display: grid;
    grid-template-columns: 112px minmax(0, 1fr);
    gap: var(--s3) var(--s4);
    align-items: center;
    padding: var(--s3);
    border-radius: var(--r-md);
    background: var(--hp-surface);
    border: 1px solid var(--hp-border);
    transition: border-color .2s, background .2s;
    min-width: 0;
  }
  .hp-hist:hover { border-color: var(--hp-border-strong); background: var(--hp-surface-2); }
  .hp-hist-thumb {
    position: relative;
    aspect-ratio: 16 / 9;
    border-radius: var(--r-sm);
    overflow: hidden;
    background: #0b1020;
  }
  .hp-hist-body { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  .hp-hist-body h3 { margin: 0; font: 700 14px/1.3 var(--hp-font-body); }
  .hp-hist-body p { margin: 0; font-size: 12px; color: var(--hp-text-3); }
  .hp-hist .btn { grid-column: 1 / -1; min-height: 44px; width: 100%; }

  /* ───────── People ───────── */
  .hp-people {
    display: flex;
    gap: var(--s3);
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    padding-bottom: var(--s2);
  }
  .hp-people::-webkit-scrollbar { display: none; }
  .hp-person {
    flex: 0 0 min(240px, 70%);
    scroll-snap-align: start;
    display: flex; align-items: center; gap: var(--s3);
    padding: var(--s3) var(--s4);
    border-radius: var(--r-md);
    background: var(--hp-surface);
    border: 1px solid var(--hp-border);
    min-width: 0;
    transition: border-color .2s, background .2s;
  }
  .hp-person:hover { border-color: var(--hp-border-strong); background: var(--hp-surface-2); }
  .hp-person strong {
    display: block; font-size: 14px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .hp-person span { font-size: 12px; color: var(--hp-text-3); }
  .hp-people-skel { display: grid; gap: var(--s3); }

  /* ───────── Bottom tab bar (phone) ───────── */
  .hp-tabs {
    position: fixed;
    left: 0; right: 0; bottom: 0;
    z-index: 70;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    align-items: center;
    height: calc(var(--hp-tab-h) + env(safe-area-inset-bottom, 0px));
    padding: 6px var(--s2) env(safe-area-inset-bottom, 0px);
    background: rgba(8, 12, 26, 0.94);
    backdrop-filter: blur(22px);
    -webkit-backdrop-filter: blur(22px);
    border-top: 1px solid var(--hp-border);
    box-shadow: 0 -10px 30px rgba(0,0,0,.4);
  }
  .hp-tab {
    height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 3px;
    color: var(--hp-text-3);
    font: 600 11px/1 var(--hp-font-body);
    -webkit-tap-highlight-color: transparent;
    min-width: 0;
  }
  .hp-tab-ico {
    width: 48px; height: 28px;
    display: grid; place-items: center;
    border-radius: 999px;
    transition: background .2s;
  }
  .hp-tab.is-active { color: #c7d2fe; }
  .hp-tab.is-active .hp-tab-ico { background: rgba(99,102,241,.2); }
  .hp-tab:active .hp-tab-ico { background: rgba(255,255,255,.08); }
  .hp-fab-wrap { display: flex; justify-content: center; align-items: center; height: 100%; }
  .hp-fab {
    width: 56px; height: 56px;
    margin-top: -28px;
    display: grid; place-items: center;
    border-radius: 18px;
    border: 4px solid #030712;
    background: var(--hp-grad);
    color: #fff;
    cursor: pointer;
    box-shadow: 0 10px 26px rgba(99,102,241,.55);
    -webkit-tap-highlight-color: transparent;
    transition: transform .15s;
  }
  .hp-fab:active { transform: scale(.92); }

  /* =====================================================
     ≥ 640px : card grids
     ===================================================== */
  @media (min-width: 640px) {
    .hp-rail {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--s4);
      overflow: visible;
      scroll-snap-type: none;
      padding-bottom: 0;
    }
    .hp-rail > * { max-width: none; }

    .hp-people {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      overflow: visible;
      padding-bottom: 0;
    }
    .hp-person { flex: initial; }

    .hp-hist { grid-template-columns: 144px minmax(0, 1fr) auto; }
    .hp-hist .btn { grid-column: auto; width: auto; }

    .hp-hero { padding: var(--s6); }
  }

  /* =====================================================
     ≥ 768px : mobile chrome off, 2-col hero, stats on
     ===================================================== */
  @media (min-width: 768px) {
    .hp-top, .hp-tabs { display: none; }
    .hp-root { padding-bottom: var(--s7); gap: var(--s6); }
    .hp-hero {
      grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
      align-items: stretch;
      gap: var(--s6);
    }
    .hp-stats { display: flex; }
    .hp-hero-actions {
      padding: var(--s5);
      border-radius: var(--r-lg);
      background: rgba(3, 7, 18, .45);
      border: 1px solid var(--hp-border);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .hp-head h2 { font-size: 22px; }
    .hp-aside .hp-hist-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .hp-aside .hp-hist { grid-template-columns: 112px minmax(0, 1fr); }
    .hp-aside .hp-hist .btn { grid-column: 1 / -1; width: 100%; }
  }

  /* =====================================================
     ≥ 1100px : laptop — main feed + sticky sidebar
     ===================================================== */
  @media (min-width: 1100px) {
    .hp-hero { padding: 40px; }
    .hp-layout {
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: var(--s6);
      align-items: start;
    }
    .hp-aside {
      position: sticky;
      top: var(--s5);
      max-height: calc(100vh - 48px);
      overflow-y: auto;
      scrollbar-width: none;
    }
    .hp-aside::-webkit-scrollbar { display: none; }
    .hp-aside .hp-hist-list { grid-template-columns: minmax(0, 1fr); }
    .hp-aside .hp-hist { grid-template-columns: 104px minmax(0, 1fr); }
    .hp-people { display: flex; flex-direction: column; overflow: visible; }
    .hp-person { flex: initial; }
  }

  /* Large monitors */
  @media (min-width: 1700px) {
    .hp-layout { grid-template-columns: minmax(0, 1fr) 380px; }
    .hp-rail { grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); }
  }

  /* Tight phones */
  @media (max-width: 380px) {
    .hp-hero { padding: var(--s4); }
    .hp-tab { font-size: 10px; }
    .hp-tab-ico { width: 40px; }
    .hp-hist { grid-template-columns: 96px minmax(0, 1fr); }
  }

  /* Touch: no sticky hover */
  @media (hover: none) {
    .hp-btn:hover { transform: none; box-shadow: 0 6px 20px rgba(99,102,241,.35); }
    .hp-hist:hover, .hp-person:hover { background: var(--hp-surface); border-color: var(--hp-border); }
  }
  @media (prefers-reduced-motion: reduce) {
    .hp-badge i { animation: none; }
    .hp-btn, .hp-fab, .hp-hist, .hp-person, .hp-tab-ico { transition: none; }
  }
`;

function Section({
  title,
  to,
  badge,
  children,
}: {
  title: string;
  to?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="hp-section">
      <div className="hp-head">
        <h2>
          {title}
          {badge}
        </h2>
        {to && (
          <Link to={to} className="hp-seeall">
            See all <span aria-hidden="true">›</span>
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function HomeGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Late night watch?';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Home() {
  const { user } = useAuth();
  const openCreate = useCreateRoom();

  useEffect(() => {
    document.title = 'Home · MovieFlex Watch Party';
  }, []);

  const live = useFetch<{ items: RoomCardData[] }>('/rooms/discover?filter=live&limit=6');
  const mine = useFetch<{ rooms: RoomCardData[] }>('/rooms/mine');
  const hist = useFetch<{ items: HistoryItem[] }>('/history?limit=6');
  const friends = useFetch<{ friends: (PublicUser & { sharedRooms: number })[] }>('/users/friends');

  const liveCount = !live.loading && !live.error ? live.data?.items.length ?? 0 : 0;

  // display-only values for the hero stats strip
  const stat = (loading: boolean, error: unknown, n?: number) =>
    loading || error ? '–' : String(n ?? 0);

  return (
    <div className="hp-root">
      <style>{styles}</style>

      {/* ───────── Mobile top bar ───────── */}
      <header className="hp-top">
        <Link to="/" className="hp-brand" aria-label="MovieFlex Home">
          <span className="hp-brand-mark" aria-hidden="true">▶</span>
          MovieFlex
        </Link>
        <div className="hp-top-actions">
          <Link to="/discover" className="hp-icon-btn" aria-label="Discover rooms">
            <Icon name="compass" size={18} />
          </Link>
          <span className="hp-me" aria-label="Your profile">
            {user?.displayName?.[0]?.toUpperCase() ?? '?'}
          </span>
        </div>
      </header>

      {/* ───────── Hero ───────── */}
      <section className="hp-hero" aria-label="Start watching">
        <div className="hp-hero-copy">
          <p className="hp-eyebrow">{greeting()}</p>
          <h1>Welcome back, {user?.displayName.split(' ')[0]} 👋</h1>
          <p>Start a private watch room in seconds, or hop into a live stream with friends.</p>

          <div className="hp-stats" aria-label="Your activity">
            <div className="hp-stat">
              <b>{stat(mine.loading, mine.error, mine.data?.rooms.length)}</b>
              <span>My rooms</span>
            </div>
            <div className="hp-stat">
              <b>{stat(live.loading, live.error, live.data?.items.length)}</b>
              <span>Live now</span>
            </div>
            <div className="hp-stat">
              <b>{stat(friends.loading, friends.error, friends.data?.friends.length)}</b>
              <span>Watch buddies</span>
            </div>
          </div>
        </div>

        <div className="hp-hero-actions">
          <button className="hp-btn" onClick={() => openCreate()}>
            <Icon name="plus" size={18} /> Create Watch Party
          </button>
          <div className="hp-join">
            <span>Have a room code?</span>
            <JoinByCode />
          </div>
        </div>
      </section>

      <div className="hp-layout">
        {/* ───────── Main feed ───────── */}
        <div className="hp-main">
          <Section title="My Rooms" to="/rooms">
            {mine.loading ? (
              <div className="hp-skel"><CardGridSkeleton count={3} /></div>
            ) : mine.error ? (
              <ErrorState message={mine.error} onRetry={mine.reload} />
            ) : mine.data!.rooms.length ? (
              <div className="hp-rail">
                {mine.data!.rooms.slice(0, 3).map((r) => (
                  <RoomCard key={r.id} room={r} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="users"
                title="You haven't joined any rooms yet"
                text="Create one or enter a room code from a friend to start watching."
                action={<button className="hp-btn" onClick={() => openCreate()}>Create a Room</button>}
              />
            )}
          </Section>

          <Section
            title="Live Now"
            to="/discover?filter=live"
            badge={
              liveCount > 0 ? (
                <span className="hp-badge"><i /> {liveCount} live</span>
              ) : undefined
            }
          >
            {live.loading ? (
              <div className="hp-skel"><CardGridSkeleton count={3} /></div>
            ) : live.error ? (
              <ErrorState message={live.error} onRetry={live.reload} />
            ) : live.data!.items.length ? (
              <div className="hp-rail">
                {live.data!.items.map((r) => (
                  <RoomCard key={r.id} room={r} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="compass"
                title="No public rooms live right now"
                text="Be the first — create a public room and others can discover it."
                action={<Link to="/discover" className="btn btn-secondary">Browse Discover</Link>}
              />
            )}
          </Section>
        </div>

        {/* ───────── Sidebar: resume + social ───────── */}
        <aside className="hp-aside">
          <Section title="Continue Watching" to="/history">
            {hist.loading ? (
              <div className="hp-skel"><CardGridSkeleton count={3} /></div>
            ) : hist.error ? (
              <ErrorState message={hist.error} onRetry={hist.reload} />
            ) : hist.data!.items.length ? (
              <div className="hp-hist-list">
                {hist.data!.items.slice(0, 3).map((h) => (
                  <article className="hp-hist" key={h.id}>
                    <div className="hp-hist-thumb">
                      <Thumb src={h.thumbnail} />
                    </div>
                    <div className="hp-hist-body">
                      <h3 className="line-2">{h.title}</h3>
                      <p>
                        {timeAgo(h.lastWatchedAt)}
                        {h.lastPosition > 5 ? ` · Stopped at ${formatClock(h.lastPosition)}` : ''}
                      </p>
                    </div>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => openCreate({ name: h.title, videoUrl: watchUrl(h.videoId) })}
                    >
                      Watch Again
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="history"
                title="Nothing watched yet"
                text="Videos you stream in watch parties will automatically appear here."
              />
            )}
          </Section>

          <Section title="Watched With">
            {friends.loading ? (
              <div className="hp-people-skel">
                <div className="skeleton" style={{ height: 64, borderRadius: 14 }} />
                <div className="skeleton" style={{ height: 64, borderRadius: 14 }} />
              </div>
            ) : friends.error ? (
              <ErrorState message={friends.error} onRetry={friends.reload} />
            ) : friends.data!.friends.length ? (
              <div className="hp-people">
                {friends.data!.friends.slice(0, 8).map((f) => (
                  <div className="hp-person" key={f.id}>
                    <Avatar name={f.displayName} color={f.avatarColor} size={42} online={!!f.online} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong>{f.displayName}</strong>
                      <span>
                        {f.online ? 'Online now' : `@${f.username}`} · {f.sharedRooms} {f.sharedRooms === 1 ? 'room' : 'rooms'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="userPlus"
                title="No watch buddies yet"
                text="People you share a watch party room with will show up in this roster."
              />
            )}
          </Section>
        </aside>
      </div>

      {/* ───────── Mobile bottom tab bar ───────── */}
      <nav className="hp-tabs" aria-label="Primary">
        <Link to="/" className="hp-tab is-active" aria-current="page">
          <span className="hp-tab-ico"><HomeGlyph /></span>
          Home
        </Link>
        <Link to="/discover" className="hp-tab">
          <span className="hp-tab-ico"><Icon name="compass" size={20} /></span>
          Discover
        </Link>
        <div className="hp-fab-wrap">
          <button type="button" className="hp-fab" onClick={() => openCreate()} aria-label="Create watch party">
            <Icon name="plus" size={24} />
          </button>
        </div>
        <Link to="/rooms" className="hp-tab">
          <span className="hp-tab-ico"><Icon name="users" size={20} /></span>
          Rooms
        </Link>
        <Link to="/history" className="hp-tab">
          <span className="hp-tab-ico"><Icon name="history" size={20} /></span>
          History
        </Link>
      </nav>
    </div>
  );
}