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

const dashboardStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

  :root {
    --dash-bg: #030712;
    --dash-card: rgba(15, 23, 42, 0.65);
    --dash-card-hover: rgba(30, 41, 59, 0.8);
    --dash-border: rgba(255, 255, 255, 0.08);
    --dash-border-bright: rgba(129, 140, 248, 0.35);

    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;

    --accent-indigo: #6366f1;
    --accent-teal: #10b981;
    --accent-rose: #f43f5e;

    --grad-glow: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(168, 85, 247, 0.12) 50%, rgba(16, 185, 129, 0.08) 100%);
    --grad-primary: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);

    --font-heading: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Plus Jakarta Sans', system-ui, sans-serif;

    /* Fluid spacing: scales smoothly from phone to large desktop */
    --dash-gap-section: clamp(28px, 4vw, 44px);
    --dash-gap-grid: clamp(14px, 1.8vw, 24px);
  }

  .dash-root {
    font-family: var(--font-body);
    color: var(--text-primary);
    display: flex;
    flex-direction: column;
    gap: var(--dash-gap-section);
    padding-bottom: clamp(32px, 6vw, 72px);
    width: 100%;
    max-width: 1600px;
    margin-inline: auto;
    min-width: 0;
  }
  .dash-root *,
  .dash-root *::before,
  .dash-root *::after {
    box-sizing: border-box;
  }

  .dash-section {
    display: flex;
    flex-direction: column;
    gap: clamp(14px, 2vw, 20px);
    min-width: 0;
  }
  .dash-section-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .dash-section-head h2 {
    font-family: var(--font-heading);
    font-size: clamp(18px, 2.2vw, 24px);
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .dash-link {
    font-size: 14px;
    font-weight: 600;
    color: #818cf8;
    text-decoration: none;
    transition: color 0.2s;
    white-space: nowrap;
    padding: 6px 0;
  }
  .dash-link:hover {
    color: #a5b4fc;
  }

  /* ---------- Welcome banner ---------- */
  .dash-welcome-card {
    position: relative;
    border-radius: clamp(20px, 3vw, 28px);
    padding: clamp(20px, 4vw, 44px);
    background: var(--dash-card);
    border: 1px solid var(--dash-border);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    overflow: hidden;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: clamp(20px, 3vw, 40px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
  .dash-welcome-card::before {
    content: "";
    position: absolute;
    inset: -50px;
    background: var(--grad-glow);
    filter: blur(60px);
    pointer-events: none;
    z-index: 0;
  }
  .dash-welcome-info {
    position: relative;
    z-index: 1;
    max-width: 560px;
    min-width: 0;
    flex: 1 1 auto;
  }
  .dash-welcome-info h1 {
    font-family: var(--font-heading);
    font-size: clamp(24px, 4vw, 44px);
    font-weight: 700;
    letter-spacing: -0.03em;
    margin: 0 0 10px;
    line-height: 1.12;
    overflow-wrap: anywhere;
  }
  .dash-welcome-info p {
    font-size: clamp(13px, 1.4vw, 15px);
    line-height: 1.55;
    color: var(--text-secondary);
    margin: 0;
  }
  .dash-welcome-actions {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: flex-end;
    flex: 0 0 auto;
    min-width: 0;
  }
  .dash-join-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 10px;
    font-size: 13px;
    min-width: 0;
  }
  .dash-join-row > span {
    color: var(--text-muted);
  }

  .dash-btn-primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 50px;
    min-height: 44px; /* comfortable touch target */
    padding: 0 26px;
    border-radius: 14px;
    background: var(--grad-primary);
    color: #fff;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 15px;
    border: none;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(99, 102, 241, 0.35);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    -webkit-tap-highlight-color: transparent;
  }
  .dash-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(99, 102, 241, 0.5);
  }
  .dash-btn-primary:active {
    transform: translateY(0);
  }

  /* ---------- Card grid ----------
     Large desktop: 4 cols | Laptop/desktop: 3 cols | Tablet: 2 cols | Phone: 1 col */
  .dash-grid-3 {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--dash-gap-grid);
  }

  /* ---------- People ---------- */
  .dash-people-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
    gap: 14px;
  }
  .dash-person-chip {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 16px;
    border-radius: 16px;
    background: var(--dash-card);
    border: 1px solid var(--dash-border);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: all 0.2s;
    min-width: 0;
  }
  .dash-person-chip:hover {
    background: var(--dash-card-hover);
    border-color: var(--dash-border-bright);
    transform: translateY(-2px);
  }

  /* ---------- History cards ---------- */
  .dash-history-card {
    border-radius: 20px;
    background: var(--dash-card);
    border: 1px solid var(--dash-border);
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    transition: all 0.25s;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .dash-history-card:hover {
    border-color: var(--dash-border-bright);
    transform: translateY(-3px);
    box-shadow: 0 16px 36px rgba(0,0,0,0.4);
  }
  .dash-history-body {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }
  .dash-history-foot {
    padding: 12px 16px;
    border-top: 1px solid var(--dash-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    background: rgba(0, 0, 0, 0.2);
  }

  /* ---------- Extra-large screens (wide desktop monitors) ---------- */
  @media (min-width: 1500px) {
    .dash-grid-3 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  /* ---------- Laptop / small desktop ---------- */
  @media (max-width: 1199px) {
    .dash-welcome-info { max-width: 460px; }
  }

  /* ---------- Tablet (portrait & landscape) ---------- */
  @media (max-width: 1023px) {
    .dash-grid-3 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 899px) {
    .dash-welcome-card {
      flex-direction: column;
      align-items: flex-start;
    }
    .dash-welcome-info { max-width: 100%; }
    .dash-welcome-actions {
      align-items: flex-start;
      width: 100%;
    }
    .dash-join-row {
      justify-content: flex-start;
    }
  }

  /* ---------- Phone ---------- */
  @media (max-width: 639px) {
    .dash-grid-3 {
      grid-template-columns: minmax(0, 1fr);
    }
    .dash-welcome-actions .dash-btn-primary {
      width: 100%;
    }
    .dash-join-row {
      width: 100%;
    }
    .dash-history-card { border-radius: 16px; }
    .dash-history-body { padding: 14px; }
    .dash-history-foot { padding: 10px 14px; }
    .dash-person-chip { padding: 10px 14px; }
    .dash-people-list { grid-template-columns: minmax(0, 1fr); }
  }

  /* ---------- Small phones ---------- */
  @media (max-width: 380px) {
    .dash-btn-primary {
      padding: 0 18px;
      font-size: 14px;
    }
    .dash-history-foot {
      flex-direction: column;
      align-items: stretch;
    }
  }

  /* ---------- Touch devices: no sticky hover lift ---------- */
  @media (hover: none) {
    .dash-btn-primary:hover,
    .dash-person-chip:hover,
    .dash-history-card:hover {
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dash-btn-primary,
    .dash-person-chip,
    .dash-history-card {
      transition: none;
    }
  }
`;

function Section({ title, to, children, action }: { title: string; to?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="dash-section">
      <div className="dash-section-head">
        <h2>{title}</h2>
        {action ?? (to && <Link to={to} className="dash-link">See all</Link>)}
      </div>
      {children}
    </section>
  );
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

  return (
    <div className="dash-root">
      <style>{dashboardStyles}</style>

      {/* Glassmorphic Welcome Banner */}
      <section className="dash-welcome-card">
        <div className="dash-welcome-info">
          <h1>Welcome back, {user?.displayName.split(' ')[0]} 👋</h1>
          <p>Ready for movie night? Launch your private watch room or jump into a live stream with friends.</p>
        </div>

        <div className="dash-welcome-actions">
          <button className="dash-btn-primary" onClick={() => openCreate()}>
            <Icon name="plus" size={18} /> Create Watch Party
          </button>
          
          <div className="dash-join-row">
            <span>or join with room code:</span>
            <JoinByCode />
          </div>
        </div>
      </section>

      {/* Live Now Section */}
      <Section title="Live Rooms Now" to="/discover?filter=live">
        {live.loading ? (
          <CardGridSkeleton count={3} />
        ) : live.error ? (
          <ErrorState message={live.error} onRetry={live.reload} />
        ) : live.data!.items.length ? (
          <div className="dash-grid-3">
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

      {/* My Rooms Section */}
      <Section title="My Saved Rooms" to="/rooms">
        {mine.loading ? (
          <CardGridSkeleton count={3} />
        ) : mine.error ? (
          <ErrorState message={mine.error} onRetry={mine.reload} />
        ) : mine.data!.rooms.length ? (
          <div className="dash-grid-3">
            {mine.data!.rooms.slice(0, 3).map((r) => (
              <RoomCard key={r.id} room={r} />
            ))}
          </div>
        ) : (
          <EmptyState 
            icon="users" 
            title="You haven't joined any rooms yet" 
            text="Create one or enter a room code from a friend to start watching." 
            action={<button className="dash-btn-primary" onClick={() => openCreate()}>Create a Room</button>} 
          />
        )}
      </Section>

      {/* Recently Watched History Section */}
      <Section title="Recently Watched" to="/history">
        {hist.loading ? (
          <CardGridSkeleton count={3} />
        ) : hist.error ? (
          <ErrorState message={hist.error} onRetry={hist.reload} />
        ) : hist.data!.items.length ? (
          <div className="dash-grid-3">
            {hist.data!.items.slice(0, 3).map((h) => (
              <article className="dash-history-card" key={h.id}>
                <div style={{ position: 'relative', aspectRatio: '16/9', overflow: 'hidden' }}>
                  <Thumb src={h.thumbnail} />
                </div>
                <div className="dash-history-body">
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, lineHeight: 1.3 }} className="line-2">
                    {h.title}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    {timeAgo(h.lastWatchedAt)}{h.lastPosition > 5 ? ` · Stopped at ${formatClock(h.lastPosition)}` : ''}
                  </p>
                </div>
                <div className="dash-history-foot">
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>YouTube Stream</span>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    onClick={() => openCreate({ name: h.title, videoUrl: watchUrl(h.videoId) })}
                  >
                    Watch Again
                  </button>
                </div>
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

      {/* Watched With / Friend Network */}
      <Section title="Watched With">
        {friends.loading ? (
          <div className="dash-people-list">
            <div className="skeleton" style={{ height: 60, borderRadius: 16 }} />
            <div className="skeleton" style={{ height: 60, borderRadius: 16 }} />
          </div>
        ) : friends.error ? (
          <ErrorState message={friends.error} onRetry={friends.reload} />
        ) : friends.data!.friends.length ? (
          <div className="dash-people-list">
            {friends.data!.friends.slice(0, 8).map((f) => (
              <div className="dash-person-chip" key={f.id}>
                <Avatar name={f.displayName} color={f.avatarColor} size={42} online={!!f.online} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {f.displayName}
                  </strong>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
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
    </div>
  );
}