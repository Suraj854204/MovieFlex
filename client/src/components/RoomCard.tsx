import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';
import { timeAgo } from '../lib/format';
import type { RoomCardData } from '../lib/types';

/* Inline styles keep Thumb self-sufficient wherever it is reused
   (Home history rows, etc.) — it always fills its parent box. */
const thumbFill: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const thumbEmpty: React.CSSProperties = {
  width: '100%', height: '100%', display: 'grid', placeItems: 'center',
  color: 'rgba(255,255,255,.35)',
  background: 'radial-gradient(120% 120% at 20% 10%, #312e81 0%, #0b1020 70%)',
};

export function Thumb({ src, alt = '' }: { src?: string | null; alt?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="thumb thumb-empty" style={thumbEmpty} aria-hidden="true"><Icon name="film" size={28} /></div>;
  return <img className="thumb" style={thumbFill} src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}

/* ──────────────────────────────────────────────────────────────
   UI FIXES IN THIS VERSION
   1. `font: 700 16px/1.3 inherit` is INVALID CSS (inherit can't sit
      inside the font shorthand) → the browser dropped the whole line,
      so title / pill / button text sizes never applied. Rewritten
      with longhand properties.
   2. Old global classes (card, thumb-badges, room-card-foot, badges,
      btn-sm, muted, line-1…) were fighting these styles. Presentational
      legacy classes removed; every rule is now scoped as `.rc .rc-*`
      so it always wins.
   3. width:100% on the card — container-type:inline-size can collapse
      a card to 0 width inside shrink-to-fit parents.
   4. Footer CTA keeps its 44px tap size; tags wrap instead of
      overflowing; long titles/hosts truncate cleanly.
   ────────────────────────────────────────────────────────────── */
const styles = `
  .rc, .rc *, .rc *::before, .rc *::after { box-sizing: border-box; }
  .rc {
    --rc-border: rgba(255,255,255,.08);
    --rc-border-hi: rgba(129,140,248,.45);
    --rc-text: #f8fafc;
    --rc-text-2: #a8b3c7;
    --rc-text-3: #7b88a1;
    --rc-brand: #6366f1;
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    gap: 0;
    border-radius: 20px;
    background: rgba(15, 23, 42, .78);
    border: 1px solid var(--rc-border);
    overflow: hidden;
    color: var(--rc-text);
    container-type: inline-size;
    transition: transform .22s cubic-bezier(.16,1,.3,1), border-color .2s, box-shadow .22s;
  }
  .rc:focus-within { border-color: var(--rc-border-hi); }

  .rc .rc-link {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    color: inherit;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    outline: none;
  }
  .rc .rc-link:focus-visible { box-shadow: inset 0 0 0 2px #a5b4fc; border-radius: 20px 20px 0 0; }
  /* press tint over the whole tappable area */
  .rc .rc-link::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(129,140,248,.14);
    opacity: 0;
    transition: opacity .12s;
    pointer-events: none;
    z-index: 3;
  }
  .rc .rc-link:active::after { opacity: 1; }

  /* ── Thumbnail ── */
  .rc .rc-thumb {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #0b1020;
  }
  .rc .rc-thumb .thumb { transition: transform .5s cubic-bezier(.16,1,.3,1); }
  .rc .rc-thumb::after {            /* readability gradient for badges */
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, rgba(3,7,18,.55) 0%, transparent 38%),
      linear-gradient(0deg, rgba(3,7,18,.6) 0%, transparent 40%);
    pointer-events: none;
  }
  .rc .rc-badges {
    position: absolute;
    z-index: 2;
    top: 10px; left: 10px; right: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  .rc .rc-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 26px;
    padding: 0 10px;
    border-radius: 999px;
    font-family: inherit;
    font-size: 11px;
    font-weight: 700;
    line-height: 1;
    letter-spacing: .03em;
    white-space: nowrap;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .rc .rc-pill-live {
    background: rgba(244,63,94,.92);
    color: #fff;
    text-transform: uppercase;
    box-shadow: 0 4px 14px rgba(244,63,94,.45);
  }
  .rc .rc-pill-live i {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #fff;
    animation: rcPulse 1.6s ease-in-out infinite;
  }
  @keyframes rcPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.7); }
    50% { box-shadow: 0 0 0 5px rgba(255,255,255,0); }
  }
  .rc .rc-pill-dark { background: rgba(3,7,18,.62); color: #fff; border: 1px solid rgba(255,255,255,.14); margin-left: auto; }

  .rc .rc-play {
    position: absolute;
    z-index: 2;
    right: 10px; bottom: 10px;
    width: 40px; height: 40px;
    display: grid; place-items: center;
    border-radius: 50%;
    background: rgba(255,255,255,.2);
    border: 1px solid rgba(255,255,255,.4);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: #fff;
    font-size: 13px;
    padding-left: 2px;
    transition: transform .22s cubic-bezier(.16,1,.3,1), background .2s;
  }
  .rc .rc-link:active .rc-play { transform: scale(.9); background: rgba(255,255,255,.35); }

  /* ── Body ── */
  .rc .rc-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px 16px 12px;
    min-width: 0;
  }
  .rc .rc-title {
    margin: 0;
    font-family: inherit;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.3;
    letter-spacing: -.01em;
    color: var(--rc-text);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rc .rc-sub {
    margin: 0;
    font-size: 13px;
    line-height: 1.4;
    color: var(--rc-text-2);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .rc .rc-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 4px;
    min-width: 0;
    font-size: 12px;
    color: var(--rc-text-3);
  }
  .rc .rc-host {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    color: var(--rc-text-2);
    font-weight: 600;
  }
  .rc .rc-host > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rc .rc-time { flex-shrink: 0; }

  /* ── Footer ── */
  .rc .rc-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px 14px;
    border-top: 1px solid var(--rc-border);
    background: rgba(0,0,0,.18);
  }
  .rc .rc-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  .rc .rc-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 24px;
    padding: 0 9px;
    border-radius: 8px;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    color: var(--rc-text-2);
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
  }
  .rc .rc-tag-warn { background: rgba(245,158,11,.14); border-color: rgba(245,158,11,.35); color: #fcd34d; }
  .rc .rc-tag-accent { background: rgba(99,102,241,.2); border-color: rgba(129,140,248,.4); color: #c7d2fe; }

  .rc .rc-cta {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: auto;
    min-height: 44px;
    min-width: 84px;
    padding: 0 18px;
    border-radius: 12px;
    border: 0;
    background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    color: #fff;
    font-family: inherit;
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
    text-decoration: none;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(99,102,241,.4);
    transition: transform .15s, box-shadow .2s;
    -webkit-tap-highlight-color: transparent;
  }
  .rc .rc-cta:active { transform: scale(.96); }

  /* Narrow card (phone rail, small columns): stack footer, full-width CTA */
  @container (max-width: 340px) {
    .rc .rc-foot { flex-direction: column; align-items: stretch; gap: 12px; }
    .rc .rc-cta { width: 100%; min-height: 48px; }
    .rc .rc-body { padding: 12px 14px 10px; }
    .rc .rc-title { font-size: 15px; }
  }

  /* Pointer devices: lift + zoom + bigger play chip */
  @media (hover: hover) {
    .rc:hover {
      transform: translateY(-4px);
      border-color: var(--rc-border-hi);
      box-shadow: 0 18px 40px rgba(0,0,0,.45);
    }
    .rc:hover .rc-thumb .thumb { transform: scale(1.05); }
    .rc:hover .rc-play { transform: scale(1.15); background: rgba(255,255,255,.34); }
    .rc .rc-cta:hover { transform: translateY(-1px); box-shadow: 0 10px 26px rgba(99,102,241,.55); }
  }
  /* Touch: press feedback on the whole card */
  @media (hover: none) {
    .rc:active { transform: scale(.985); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rc, .rc .thumb, .rc .rc-play, .rc .rc-cta { transition: none; }
    .rc .rc-pill-live i { animation: none; }
  }
`;

export function RoomCard({ room, action }: { room: RoomCardData; action?: React.ReactNode }) {
  return (
    <article className="room-card rc">
      <style>{styles}</style>
      <Link to={`/room/${room.code}`} className="rc-link" aria-label={`Open room ${room.name}`}>
        <div className="rc-thumb">
          <Thumb src={room.video?.thumbnail} />
          <div className="rc-badges">
            {room.live && <span className="rc-pill rc-pill-live"><i /> Live</span>}
            <span className="rc-pill rc-pill-dark"><Icon name="users" size={12} /> {room.participantCount}</span>
          </div>
          <span className="rc-play" aria-hidden="true">▶</span>
        </div>
        <div className="rc-body">
          <h3 className="rc-title">{room.name}</h3>
          <p className="rc-sub">{room.video?.title || room.description || 'No video yet'}</p>
          <div className="rc-meta">
            {room.host && <span className="rc-host"><Avatar name={room.host.displayName} color={room.host.avatarColor} size={20} /><span>{room.host.displayName}</span></span>}
            <span className="rc-time">{timeAgo(room.createdAt)}</span>
          </div>
        </div>
      </Link>
      <div className="rc-foot">
        <span className="rc-tags">
          <span className="rc-tag"><Icon name={room.privacy === 'public' ? 'globe' : 'lock'} size={12} /> {room.privacy === 'public' ? 'Public' : 'Private'}</span>
          {room.locked && <span className="rc-tag rc-tag-warn">Locked</span>}
          {room.hasPassword && <span className="rc-tag">Password</span>}
          {room.myRole === 'host' && <span className="rc-tag rc-tag-accent"><Icon name="crown" size={12} /> Host</span>}
          {room.myRole === 'moderator' && <span className="rc-tag rc-tag-accent"><Icon name="shield" size={12} /> Mod</span>}
        </span>
        {action ?? <Link to={`/room/${room.code}`} className="rc-cta">{room.myRole ? 'Open' : 'Join'}</Link>}
      </div>
    </article>
  );
}