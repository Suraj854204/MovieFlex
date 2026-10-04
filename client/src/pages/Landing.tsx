import { useEffect, useRef, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Icon, type IconName } from '../components/ui/Icon';

// --- DATA & CONSTANTS ---
const FRIENDS = [
  { name: 'Jamie', color: '#ff9f7a' },
  { name: 'Alex', color: '#ffd166' },
  { name: 'Maya', color: '#5eead4' },
];
const REACTIONS = ['❤️', '😂', '😮', '🔥', '👏'];
const GENRES = ['Thriller', 'Comedy', 'Sci-fi', 'Romance', 'Animation', 'Action', 'Horror'];
const TOTAL = 6200;
const DEMO_INVITE = 'https://movieflex.example/room/DEMO26';

const STATS = [
  { label: 'Active Watch Rooms', value: '14,280+' },
  { label: 'Sync Accuracy', value: '99.98%' },
  { label: 'Live Viewers Now', value: '62.4K' },
  { label: 'Movies Watched', value: '1.2M+' },
];

const STEPS = [
  { title: 'Create your room', text: 'Sign up and open a private watch room in seconds.', pane: 'room' },
  { title: 'Invite your people', text: 'Copy the room link and send it to friends and family.', pane: 'invite' },
  { title: 'Press play together', text: 'Everyone stays in sync while you chat and react live.', pane: 'play' },
];

const FAQS = [
  { q: 'What is MovieFlex?', a: 'MovieFlex is a watch-party app. Create a room, invite friends, and watch the same movie in sync while you chat and react live.' },
  { q: 'How do I invite my friends?', a: 'Create an account, open a watch room, and copy the invite link. Anyone with the link can join instantly on web or mobile.' },
  { q: 'Can I use MovieFlex on my phone or TV?', a: 'Yes. The site adapts to desktop, tablet, mobile, and smart TV browsers with seamlessly matched synchronization.' },
  { q: 'Is MovieFlex free?', a: 'Basic watch rooms are completely free for up to 5 friends. Pro features allow unlimited room capacity and 4K stream sync.' },
];

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// --- 2026/2027 TRENDING CSS SYSTEM ---
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Sora:wght@400;500;600;700&display=swap');

  :root {
    --bg: #070913; 
    --bg-card: rgba(14, 18, 34, 0.65);
    --surface: rgba(255, 255, 255, 0.03); 
    --surface-hover: rgba(255, 255, 255, 0.07);
    --text: #f8fafc; 
    --muted: #94a3b8; 
    --line: rgba(255, 255, 255, 0.09);
    --accent: #6366f1; 
    --accent-light: #818cf8;
    --accent-teal: #2dd4bf; 
    --accent-ink: #030712;
    --grad: linear-gradient(135deg, #818cf8 0%, #c084fc 50%, #2dd4bf 100%);
    --font-head: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Sora', system-ui, sans-serif;
  }

  .mf-page, .mf-page * { box-sizing: border-box; }
  .mf-page { 
    width: 100%; 
    min-height: 100vh; 
    overflow-x: clip; 
    background: var(--bg); 
    color: var(--text); 
    font: 400 16px/1.6 var(--font-body); 
    position: relative; 
  }

  /* Aurora Mesh & Grid Ambient Overlay */
  .mf-page::before { 
    content: ""; 
    position: absolute; 
    inset: 0 0 auto 0; 
    height: 1300px; 
    pointer-events: none;
    background:
      radial-gradient(circle at 18% 12%, rgba(129, 140, 248, 0.2) 0%, transparent 40%),
      radial-gradient(circle at 82% 18%, rgba(192, 132, 252, 0.16) 0%, transparent 45%),
      radial-gradient(circle at 50% 2%, rgba(45, 212, 191, 0.14) 0%, transparent 50%),
      linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px) 0 0 / 48px 48px,
      linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px) 0 0 / 48px 48px;
    -webkit-mask-image: linear-gradient(#000 65%, transparent); 
    mask-image: linear-gradient(#000 65%, transparent); 
  }

  .mf-page a, .mf-page a:hover { color: inherit; text-decoration: none; }
  .mf-page h1, .mf-page h2, .mf-page h3, .mf-page p { margin: 0; }
  .mf-page h1, .mf-page h2, .mf-page h3 { font-family: var(--font-head); font-weight: 700; letter-spacing: -.03em; line-height: 1.08; }
  .mf-page :focus-visible { outline: 2px solid var(--accent-teal); outline-offset: 3px; }
  .mf-wrap { position: relative; width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 clamp(18px, 4vw, 40px); }
  .mf-section { position: relative; padding: clamp(64px, 8vw, 120px) 0; }
  .mf-grad { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .mf-lead { color: var(--muted); font-size: clamp(16px, 1.5vw, 19px); max-width: 58ch; }
  
  .mf-pill { display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px 6px 8px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(12px); font-size: 13px; font-weight: 600; color: #e2e8f0; }
  .mf-pill b { padding: 2px 9px; border-radius: 999px; background: var(--grad); color: var(--accent-ink); font-size: 12px; font-weight: 700; }

  .mf-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 24px; border-radius: 12px; border: 1px solid transparent; font: 700 15px var(--font-head); cursor: pointer; transition: transform .18s, box-shadow .18s, background .18s; }
  .mf-btn:hover { transform: translateY(-2px); }
  .mf-btn-primary { color: #fff; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); box-shadow: 0 10px 30px rgba(99, 102, 241, 0.35), inset 0 1px 0 rgba(255,255,255,.3); }
  .mf-btn-primary:hover { box-shadow: 0 14px 40px rgba(99, 102, 241, 0.5), inset 0 1px 0 rgba(255,255,255,.3); }
  .mf-btn-ghost { background: var(--surface); border-color: var(--line); color: var(--text); backdrop-filter: blur(12px); }
  .mf-btn-ghost:hover { background: var(--surface-hover); }

  .mf-nav { position: sticky; top: 0; z-index: 50; border-bottom: 1px solid transparent; transition: background .25s, border-color .25s; }
  .mf-nav.mf-s { background: rgba(7, 9, 19, 0.8); backdrop-filter: blur(20px); border-color: var(--line); }
  .mf-nav-in { height: 72px; display: flex; align-items: center; gap: 28px; }
  .mf-links { display: flex; gap: 6px; margin-left: 24px; }
  .mf-links a { padding: 8px 14px; border-radius: 10px; font-size: 14px; font-weight: 600; color: var(--muted); transition: background .15s, color .15s; }
  .mf-links a:hover { color: var(--text); background: var(--surface); }
  .mf-actions { margin-left: auto; display: flex; align-items: center; gap: 10px; }
  .mf-actions .mf-btn { min-height: 42px; padding: 0 18px; }
  .mf-login { padding: 0 12px; font-weight: 700; font-size: 14px; }
  .mf-burger { display: none; width: 42px; height: 42px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font-size: 20px; }

  .mf-hero { padding: clamp(40px, 6vw, 80px) 0 0; text-align: center; }
  .mf-hero .mf-wrap { display: flex; flex-direction: column; align-items: center; }
  .mf-page .mf-hero h1 { font-size: clamp(42px, 7.2vw, 88px); line-height: 1.04; letter-spacing: -.04em; max-width: 14ch; margin: 28px 0 24px; }
  .mf-cta { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 36px; }
  .mf-note { margin-top: 18px; font-size: 13px; color: var(--muted); }

  /* Live Stats Banner */
  .mf-stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 56px; width: 100%; padding: 20px 24px; border-radius: 20px; border: 1px solid var(--line); background: rgba(255,255,255,0.015); backdrop-filter: blur(16px); }
  .mf-stat-item b { display: block; font-size: 26px; font-family: var(--font-head); color: #fff; }
  .mf-stat-item span { font-size: 13px; color: var(--muted); font-weight: 500; }

  .mf-app-wrap { margin-top: clamp(48px, 6vw, 80px); width: 100%; position: relative; }
  .mf-app-wrap::before { content: ""; position: absolute; inset: 8% 6% -6%; background: var(--grad); filter: blur(100px); opacity: .22; border-radius: 50%; }
  .mf-app { position: relative; display: grid; grid-template-columns: 220px minmax(0, 1fr) 300px; text-align: left; border: 1px solid var(--line); border-radius: 22px; background: var(--bg-card); backdrop-filter: blur(24px); box-shadow: 0 50px 120px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255,255,255,.08); overflow: hidden; }
  .mf-side, .mf-chatcol { padding: 18px; background: rgba(255,255,255,.015); }
  .mf-side { border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 6px; }
  .mf-chatcol { border-left: 1px solid var(--line); display: flex; flex-direction: column; min-height: 0; }
  .mf-cap { font-size: 11px; font-weight: 700; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .06em; }
  .mf-person { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 10px; font-size: 14px; font-weight: 600; }
  .mf-person:hover { background: var(--surface); }
  .mf-av { position: relative; flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; font-weight: 800; font-size: 13px; color: #000; }
  .mf-av::after { content: ""; position: absolute; right: -1px; bottom: -1px; width: 10px; height: 10px; border-radius: 50%; background: #4ade80; border: 2px solid #0e1222; }
  .mf-main { padding: 18px; min-width: 0; }
  .mf-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; font-weight: 700; font-size: 15px; }
  .mf-bar small { display: block; font-weight: 500; font-size: 12px; color: var(--muted); }
  .mf-badge { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 999px; background: rgba(74,222,128,.12); color: #86efac; font-size: 12px; font-weight: 700; }
  .mf-badge i { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; box-shadow: 0 0 10px #4ade80; }
  
  .mf-screen { position: relative; aspect-ratio: 16/9; border-radius: 14px; overflow: hidden; display: grid; place-items: center; background: radial-gradient(ellipse 45% 55% at 50% 40%, rgba(99,102,241,.4), transparent 70%), radial-gradient(ellipse 30% 40% at 75% 80%, rgba(45,212,191,.25), transparent 70%), linear-gradient(160deg, #111827, #030712); }
  .mf-title { text-align: center; position: relative; z-index: 1; }
  .mf-title b { display: block; font-size: clamp(20px, 3vw, 36px); font-weight: 800; letter-spacing: -.03em; }
  .mf-title span { font-size: 13px; color: #cbd5e1; }
  .mf-screen-top { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; z-index: 5; }
  .mf-vol-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.4); backdrop-filter: blur(8px); color: #fff; font-size: 12px; cursor: pointer; font-family: var(--font-body); }
  .mf-play { position: absolute; z-index: 3; width: 66px; height: 66px; border-radius: 50%; border: 1px solid rgba(255,255,255,.35); background: rgba(255,255,255,.16); backdrop-filter: blur(10px); color: #fff; font-size: 20px; cursor: pointer; transition: transform .18s, opacity .2s; }
  .mf-play:hover { transform: scale(1.1); }
  .mf-on .mf-play { opacity: 0; } .mf-on:hover .mf-play { opacity: 1; }
  .mf-float { position: absolute; z-index: 4; bottom: 12%; font-size: 30px; pointer-events: none; animation: mf-up 2s ease-out forwards; }
  @keyframes mf-up { from { transform: translateY(0) scale(.6); opacity: 1; } to { transform: translateY(-160px) scale(1.2); opacity: 0; } }
  .mf-scrub { display: flex; align-items: center; gap: 12px; margin-top: 14px; font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .mf-scrub input { flex: 1; height: 18px; accent-color: var(--accent); cursor: pointer; }
  .mf-reacts { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .mf-react { height: 40px; min-width: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); font-size: 18px; cursor: pointer; transition: transform .15s, background .15s; }
  .mf-react:hover { transform: translateY(-3px); background: var(--surface-hover); }
  .mf-msgs { flex: 1; min-height: 150px; max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding-right: 4px; scrollbar-width: thin; }
  .mf-msg { display: flex; gap: 10px; font-size: 14px; line-height: 1.45; }
  .mf-msg .mf-av { width: 28px; height: 28px; font-size: 12px; }
  .mf-msg .mf-av::after { display: none; }
  .mf-msg b { display: block; font-size: 12px; color: var(--muted); }
  .mf-send { display: flex; gap: 8px; margin-top: 12px; }
  .mf-send input { flex: 1; min-width: 0; height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font: 500 14px var(--font-body); }
  .mf-send button { width: 42px; height: 42px; border-radius: 10px; border: 0; background: var(--accent); color: #fff; font-weight: 800; cursor: pointer; }

  .mf-head { max-width: 720px; margin: 0 auto clamp(40px, 5vw, 64px); text-align: center; display: flex; flex-direction: column; align-items: center; gap: 18px; }
  .mf-page .mf-head h2 { font-size: clamp(32px, 4.6vw, 56px); }

  .mf-bento { display: grid; grid-template-columns: repeat(6, 1fr); gap: 16px; }
  .mf-card { position: relative; overflow: hidden; padding: 28px; border-radius: 22px; border: 1px solid var(--line); background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px); transition: border-color .25s, transform .25s; }
  .mf-card::before { content: ""; position: absolute; inset: 0; opacity: 0; transition: opacity .3s; pointer-events: none; background: radial-gradient(360px circle at var(--x, 50%) var(--y, 50%), rgba(129, 140, 248, 0.15), transparent 60%); }
  .mf-card:hover { border-color: rgba(129, 140, 248, 0.4); transform: translateY(-3px); }
  .mf-card:hover::before { opacity: 1; }
  .mf-c3 { grid-column: span 3; } .mf-c2 { grid-column: span 2; } .mf-c4 { grid-column: span 4; }
  .mf-ico { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 12px; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; margin-bottom: 18px; }
  .mf-page .mf-card h3 { font-size: 22px; margin-bottom: 8px; }
  .mf-card > p { color: var(--muted); font-size: 15px; max-width: 46ch; }
  .mf-demo { margin-top: 22px; position: relative; }
  .mf-track { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; font-weight: 600; }
  .mf-track span:first-child { width: 52px; }
  .mf-rail { flex: 1; height: 8px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
  .mf-rail i { display: block; height: 100%; border-radius: 99px; background: var(--grad); transition: width .6s cubic-bezier(.3,1.4,.5,1); }
  .mf-chip { padding: 8px 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--text); font: 600 13px var(--font-body); cursor: pointer; transition: all .15s; }
  .mf-chip:hover { background: var(--surface-hover); }
  .mf-chip.mf-sel { background: var(--accent); color: #fff; border-color: var(--accent); }
  .mf-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .mf-switch { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.03); border: 1px solid var(--line); font-weight: 600; font-size: 14px; cursor: pointer; width: 100%; color: var(--text); font-family: var(--font-body); }
  .mf-tog { width: 44px; height: 26px; border-radius: 99px; background: rgba(255,255,255,.15); position: relative; transition: background .2s; flex: none; }
  .mf-tog::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform .2s; }
  .mf-switch[aria-checked=true] .mf-tog { background: #34d399; } .mf-switch[aria-checked=true] .mf-tog::after { transform: translateX(18px); }
  .mf-field { display: flex; gap: 8px; padding: 6px; border-radius: 14px; border: 1px solid var(--line); background: rgba(255,255,255,.03); align-items: center; }
  .mf-field span { flex: 1; min-width: 0; padding: 0 10px; font-size: 14px; color: #cbd5e1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mf-field button { height: 38px; padding: 0 16px; border-radius: 10px; border: 0; background: var(--accent); color: #fff; font: 700 13px var(--font-head); cursor: pointer; }

  /* Device Preview Switcher Extra Feature */
  .mf-dev-switch { display: flex; gap: 8px; margin-bottom: 24px; justify-content: center; }
  .mf-dev-btn { padding: 6px 16px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--muted); font-size: 13px; font-weight: 600; cursor: pointer; }
  .mf-dev-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  .mf-how { background: linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.05), transparent); }
  .mf-tabs { display: grid; grid-template-columns: .9fr 1.1fr; gap: clamp(24px, 4vw, 64px); align-items: center; }
  .mf-tab { display: block; width: 100%; text-align: left; padding: 22px 24px; border-radius: 18px; border: 1px solid transparent; background: transparent; color: inherit; font: inherit; cursor: pointer; transition: all .2s; }
  .mf-tab + .mf-tab { margin-top: 8px; }
  .mf-tab h3 { font-size: 20px; display: flex; gap: 14px; align-items: center; }
  .mf-tab h3 i { font-style: normal; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 14px; background: var(--surface-hover); }
  .mf-tab p { margin-top: 0; max-height: 0; overflow: hidden; opacity: 0; color: var(--muted); font-size: 15px; transition: all .3s; padding-left: 44px; }
  .mf-tab:hover { background: var(--surface); }
  .mf-tab.mf-sel { background: var(--surface); border-color: var(--line); }
  .mf-tab.mf-sel p { max-height: 80px; opacity: 1; margin-top: 8px; }
  .mf-tab.mf-sel h3 i { background: var(--accent); color: #fff; }
  .mf-pane { min-height: 320px; display: grid; place-items: center; padding: 32px; border-radius: 24px; border: 1px solid var(--line); background: linear-gradient(145deg, rgba(99,102,241,.12), rgba(45,212,191,.04)); }
  .mf-pane-in { width: 100%; max-width: 420px; padding: 24px; border-radius: 18px; background: rgba(14, 18, 34, 0.85); border: 1px solid var(--line); backdrop-filter: blur(12px); }
  .mf-pane-in h4 { margin: 0 0 14px; font-size: 16px; }
  .mf-big { display: flex; align-items: center; gap: 14px; }
  .mf-big .mf-av::after { display: none; }

  .mf-faq { display: grid; grid-template-columns: .8fr 1.2fr; gap: clamp(28px, 6vw, 96px); align-items: start; }
  .mf-faq .mf-head { text-align: left; align-items: flex-start; margin: 0; }
  .mf-q { border-bottom: 1px solid var(--line); }
  .mf-q button { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 18px; padding: 24px 0; border: 0; background: none; color: var(--text); text-align: left; font: 700 17px var(--font-head); cursor: pointer; }
  .mf-q button span:last-child { flex: none; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; border: 1px solid var(--line); transition: transform .25s, background .2s; }
  .mf-q.mf-o button span:last-child { transform: rotate(45deg); background: var(--accent); color: #fff; }
  .mf-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .3s; }
  .mf-q.mf-o .mf-a { grid-template-rows: 1fr; }
  .mf-a > div { overflow: hidden; } .mf-a p { padding: 0 48px 24px 0; color: var(--muted); }

  .mf-final { position: relative; overflow: hidden; text-align: center; padding: clamp(56px, 8vw, 104px) 24px; border-radius: 28px; border: 1px solid var(--line); background: radial-gradient(ellipse 60% 80% at 50% 0%, rgba(99,102,241,.28), transparent 70%), var(--bg-2); }
  .mf-page .mf-final h2 { font-size: clamp(34px, 5.4vw, 68px); max-width: 16ch; margin: 0 auto 18px; }
  .mf-final .mf-lead { margin: 0 auto 32px; }
  .mf-foot { margin-top: clamp(64px, 8vw, 104px); border-top: 1px solid var(--line); padding: 48px 0 32px; }
  .mf-foot-grid { display: grid; grid-template-columns: 1.4fr repeat(2, 1fr); gap: 32px; }
  .mf-foot h4 { margin: 0 0 14px; font-size: 14px; font-family: var(--font-head); }
  .mf-foot a { display: block; padding: 4px 0; font-size: 14px; color: var(--muted); } .mf-foot a:hover { color: var(--text); }
  .mf-foot p { color: var(--muted); font-size: 14px; max-width: 32ch; margin-top: 14px; }
  .mf-copy { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
  .mf-toast { position: fixed; z-index: 100; right: 22px; bottom: 22px; padding: 13px 18px; border-radius: 12px; background: #fff; color: #030712; font-weight: 700; font-size: 14px; box-shadow: 0 16px 40px rgba(0,0,0,.4); }

  .mf-nav { border-bottom-color: rgba(255, 255, 255, 0.08); }
  .mf-nav.mf-s { border-color: rgba(255, 255, 255, 0.1); }
  .mf-hero { position: relative; }
  .mf-hero .mf-wrap { z-index: 1; }
  .mf-hero::after { content: ""; position: absolute; z-index: 0; left: -25%; right: -25%; bottom: 0; height: 460px; pointer-events: none;
    background: linear-gradient(rgba(99, 102, 241, 0.4) 1px, transparent 1px) 0 0 / 72px 72px, linear-gradient(90deg, rgba(99, 102, 241, 0.4) 1px, transparent 1px) 0 0 / 72px 72px;
    transform: perspective(420px) rotateX(64deg); transform-origin: 50% 100%;
    -webkit-mask-image: linear-gradient(to top, #000 5%, transparent 85%); mask-image: linear-gradient(to top, #000 5%, transparent 85%); }

  @media (max-width: 1060px) {
    .mf-app { grid-template-columns: minmax(0, 1fr) 280px; } .mf-side { display: none; }
    .mf-c3, .mf-c4 { grid-column: span 6; } .mf-c2 { grid-column: span 3; }
    .mf-tabs, .mf-faq { grid-template-columns: 1fr; }
    .mf-stats-bar { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 768px) {
    .mf-nav-in { height: 64px; flex-wrap: wrap; gap: 10px; }
    .mf-burger { display: grid; place-items: center; } .mf-login { display: none; }
    .mf-links { display: none; order: 3; width: 100%; flex-direction: column; margin: 0; padding-bottom: 12px; }
    .mf-links.mf-o { display: flex; }
    .mf-app { grid-template-columns: 1fr; } .mf-chatcol { border-left: 0; border-top: 1px solid var(--line); }
    .mf-c2 { grid-column: span 6; } .mf-card { padding: 22px; }
    .mf-cta .mf-btn { flex: 1 1 100%; } .mf-foot-grid { grid-template-columns: 1fr 1fr; } .mf-foot-grid > :first-child { grid-column: span 2; }
    .mf-a p { padding-right: 0; }
    .mf-stats-bar { grid-template-columns: 1fr; }
  }
  @media (prefers-reduced-motion: reduce) { .mf-page *, .mf-page *::before, .mf-page *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
`;

export default function Landing() {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(1840);
  const [muted, setMuted] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'tv'>('desktop');
  const [chat, setChat] = useState([
    { who: 'Jamie', text: 'Okay, that plot twist! 😭' },
    { who: 'Alex', text: 'I did NOT see that coming.' },
  ]);
  const [draft, setDraft] = useState('');
  const [floats, setFloats] = useState<{ id: number; e: string; l: number }[]>([]);
  const [lag, setLag] = useState(false);
  const [priv, setPriv] = useState(true);
  const [genres, setGenres] = useState<string[]>(['Thriller']);
  const [tab, setTab] = useState(0);
  const [faq, setFaq] = useState<number | null>(0);
  const [toast, setToast] = useState('');
  const msgs = useRef<HTMLDivElement>(null);
  const uid = useRef(0);

  useEffect(() => {
    document.title = 'MovieFlex — Movie nights, together';
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setTime((v) => (v >= TOTAL ? 0 : v + 25)), 250);
    return () => window.clearInterval(t);
  }, [playing]);

  useEffect(() => {
    msgs.current?.scrollTo({ top: msgs.current.scrollHeight, behavior: 'smooth' });
  }, [chat]);

  const react = (e: string) => {
    const id = ++uid.current;
    setFloats((f) => [...f, { id, e, l: 20 + Math.random() * 60 }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2000);
  };

  const send = (ev: FormEvent) => {
    ev.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setChat((c) => [...c, { who: 'You', text }]);
    setDraft('');
    window.setTimeout(() => setChat((c) => [...c, { who: 'Maya', text: 'Haha, same 😂' }]), 1000);
  };

  const copy = async () => {
    try { 
      await navigator.clipboard.writeText(DEMO_INVITE); 
      setToast('Invite link copied to clipboard!'); 
    } catch { 
      setToast(DEMO_INVITE); 
    }
    window.setTimeout(() => setToast(''), 2800);
  };

  const glow = (e: MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`);
  };

  const color = (w: string) => FRIENDS.find((f) => f.name === w)?.color ?? '#a5b4fc';
  const icon = (n: IconName) => <div className="mf-ico"><Icon name={n} /></div>;
  const close = () => setMenu(false);
  const pct = (time / TOTAL) * 100;

  return (
    <div className="mf-page">
      <style>{styles}</style>

      {/* HEADER NAV */}
      <header className={`mf-nav ${scrolled ? 'mf-s' : ''}`}>
        <div className="mf-wrap mf-nav-in">
          <Link to="/" aria-label="MovieFlex home" onClick={close}><Logo /></Link>
          <nav className={`mf-links ${menu ? 'mf-o' : ''}`} aria-label="Main navigation">
            <a href="#features" onClick={close}>Features</a>
            <a href="#how-it-works" onClick={close}>How it works</a>
            <a href="#faq" onClick={close}>FAQ</a>
          </nav>
          <div className="mf-actions">
            <Link to="/login" className="mf-login">Log in</Link>
            <Link to="/signup" className="mf-btn mf-btn-primary">Get started</Link>
            <button type="button" className="mf-burger" aria-label={menu ? 'Close menu' : 'Open menu'} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? '×' : '☰'}</button>
          </div>
        </div>
      </header>

      <main>
        {/* HERO SECTION */}
        <section className="mf-hero">
          <div className="mf-wrap">
            <span className="mf-pill"><b>New</b> Watch rooms with live reactions</span>
            <h1>Movie night, <span className="mf-grad">together</span> from anywhere.</h1>
            <p className="mf-lead">Create a private room, invite your people, and watch in perfect sync. Chat and react as it happens, with zero lag or manual countdowns.</p>
            <div className="mf-cta">
              <Link to="/signup" className="mf-btn mf-btn-primary">Start a watch party</Link>
              <button type="button" className="mf-btn mf-btn-ghost" onClick={copy}>Copy demo invite</button>
            </div>
            <p className="mf-note">The room below is live. Press play, react, or say hi.</p>

            {/* LIVE STATS BANNER */}
            <div className="mf-stats-bar">
              {STATS.map((s) => (
                <div key={s.label} className="mf-stat-item">
                  <b>{s.value}</b>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>

            {/* INTERACTIVE APP WATCH ROOM DEMO */}
            <div className="mf-app-wrap">
              <div className="mf-app" aria-label="Interactive watch room demo">
                <aside className="mf-side">
                  <div className="mf-cap">In the room</div>
                  {[{ name: 'You', color: '#a5b4fc' }, ...FRIENDS].map((f) => (
                    <div className="mf-person" key={f.name}>
                      <span className="mf-av" style={{ background: f.color }}>{f.name[0]}</span>
                      {f.name}
                    </div>
                  ))}
                </aside>

                <div className="mf-main">
                  <div className="mf-bar">
                    <div>Friday movie night<small>Room DEMO26</small></div>
                    <span className="mf-badge"><i /> {playing ? 'Playing in sync' : 'Paused for all'}</span>
                  </div>

                  <div className={`mf-screen ${playing ? 'mf-on' : ''}`}>
                    <div className="mf-screen-top">
                      <button type="button" className="mf-vol-btn" onClick={() => setMuted(!muted)}>
                        {muted ? '🔇 Muted' : '🔊 Audio On'}
                      </button>
                    </div>
                    <div className="mf-title"><b>The Last Reel</b><span>Now showing</span></div>
                    <button type="button" className="mf-play" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
                      {playing ? '❚❚' : '▶'}
                    </button>
                    {floats.map((f) => <span key={f.id} className="mf-float" style={{ left: `${f.l}%` }}>{f.e}</span>)}
                  </div>

                  <div className="mf-scrub">
                    <span>{fmt(time)}</span>
                    <input type="range" min={0} max={TOTAL} value={time} aria-label="Seek" onChange={(e) => setTime(Number(e.target.value))} />
                    <span>{fmt(TOTAL)}</span>
                  </div>

                  <div className="mf-reacts">
                    {REACTIONS.map((r) => <button type="button" key={r} className="mf-react" aria-label={`React ${r}`} onClick={() => react(r)}>{r}</button>)}
                  </div>
                </div>

                <aside className="mf-chatcol">
                  <div className="mf-cap">Room chat</div>
                  <div className="mf-msgs" ref={msgs} aria-live="polite">
                    {chat.map((m, i) => (
                      <div className="mf-msg" key={i}>
                        <span className="mf-av" style={{ background: color(m.who) }}>{m.who[0]}</span>
                        <div><b>{m.who}</b>{m.text}</div>
                      </div>
                    ))}
                  </div>
                  <form className="mf-send" onSubmit={send}>
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message the room" aria-label="Chat message" />
                    <button type="submit" aria-label="Send">↑</button>
                  </form>
                </aside>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES BENTO GRID SECTION */}
        <section className="mf-section" id="features">
          <div className="mf-wrap">
            <div className="mf-head">
              <span className="mf-pill">Features</span>
              <h2>Everything a movie night needs. Nothing it doesn't.</h2>
              <p className="mf-lead">Try the controls in each card. They work the way the real thing does.</p>
            </div>
            
            <div className="mf-bento">
              <article className="mf-card mf-c4" onMouseMove={glow}>
                {icon('sync')}
                <h3>Perfect synchronization</h3>
                <p>Everyone sees the same frame at the same time. If someone lags, they snap back to the room automatically.</p>
                <div className="mf-demo">
                  {FRIENDS.map((f, i) => (
                    <div className="mf-track" key={f.name}>
                      <span>{f.name}</span>
                      <div className="mf-rail">
                        <i style={{ width: `${lag && i === 2 ? pct - 14 : pct}%` }} />
                      </div>
                    </div>
                  ))}
                  <button type="button" className="mf-chip" style={{ marginTop: 16 }} onClick={() => setLag(!lag)}>
                    {lag ? 'Resync Maya' : 'Simulate lag'}
                  </button>
                </div>
              </article>

              <article className="mf-card mf-c2" onMouseMove={glow}>
                {icon('shield')}
                <h3>Private rooms</h3>
                <p>Only people with your link get in.</p>
                <div className="mf-demo">
                  <button type="button" role="switch" aria-checked={priv} className="mf-switch" onClick={() => setPriv(!priv)}>
                    {priv ? 'Invite only' : 'Open to anyone'}
                    <span className="mf-tog" />
                  </button>
                </div>
              </article>

              <article className="mf-card mf-c2" onMouseMove={glow}>
                {icon('link')}
                <h3>One-tap invites</h3>
                <p>Copy a link, send it, done.</p>
                <div className="mf-demo">
                  <div className="mf-field">
                    <span>{DEMO_INVITE.replace('https://', '')}</span>
                    <button type="button" onClick={copy}>Copy</button>
                  </div>
                </div>
              </article>

              <article className="mf-card mf-c2" onMouseMove={glow}>
                {icon('compass')}
                <h3>Pick together</h3>
                <p>Choose genres and find a movie everyone agrees on.</p>
                <div className="mf-demo mf-chips">
                  {GENRES.map((g) => (
                    <button 
                      type="button" 
                      key={g} 
                      className={`mf-chip ${genres.includes(g) ? 'mf-sel' : ''}`} 
                      aria-pressed={genres.includes(g)} 
                      onClick={() => setGenres((x) => x.includes(g) ? x.filter((y) => y !== g) : [...x, g])}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </article>

              <article className="mf-card mf-c2" onMouseMove={glow}>
                {icon('message')}
                <h3>Live reactions</h3>
                <p>Express emotions without speaking over the movie audio.</p>
                <div className="mf-demo mf-chips">
                  {REACTIONS.map((r) => (
                    <button type="button" key={r} className="mf-chip" aria-label={`React ${r}`} onClick={() => react(r)}>
                      {r}
                    </button>
                  ))}
                </div>
              </article>

              <article className="mf-card mf-c2" onMouseMove={glow}>
                {icon('history')}
                <h3>Zero friction</h3>
                <p>No extra extensions required. Works straight in your modern browser.</p>
              </article>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS SECTION WITH DEVICE SWITCHER */}
        <section className="mf-section mf-how" id="how-it-works">
          <div className="mf-wrap">
            <div className="mf-head">
              <span className="mf-pill">How it works</span>
              <h2>From "what should we watch?" to movie time.</h2>
            </div>

            <div className="mf-dev-switch">
              {(['desktop', 'mobile', 'tv'] as const).map((d) => (
                <button 
                  type="button" 
                  key={d} 
                  className={`mf-dev-btn ${device === d ? 'active' : ''}`}
                  onClick={() => setDevice(d)}
                >
                  {d.toUpperCase()} View
                </button>
              ))}
            </div>

            <div className="mf-tabs">
              <div role="tablist" aria-label="Steps">
                {STEPS.map((s, i) => (
                  <button type="button" role="tab" aria-selected={tab === i} key={s.title} className={`mf-tab ${tab === i ? 'mf-sel' : ''}`} onClick={() => setTab(i)}>
                    <h3><i>{i + 1}</i>{s.title}</h3><p>{s.text}</p>
                  </button>
                ))}
              </div>

              <div className="mf-pane" role="tabpanel">
                <div className="mf-pane-in">
                  {tab === 0 && (
                    <>
                      <h4>New watch room</h4>
                      <div className="mf-field">
                        <span>Friday movie night</span>
                        <button type="button" onClick={() => setTab(1)}>Create</button>
                      </div>
                    </>
                  )}
                  {tab === 1 && (
                    <>
                      <h4>Invite friends ({device})</h4>
                      <div className="mf-field">
                        <span>{DEMO_INVITE.replace('https://', '')}</span>
                        <button type="button" onClick={copy}>Copy</button>
                      </div>
                    </>
                  )}
                  {tab === 2 && (
                    <>
                      <h4>Everyone's synced up</h4>
                      <div className="mf-big">
                        {FRIENDS.map((f) => (
                          <span className="mf-av" key={f.name} style={{ background: f.color, width: 44, height: 44, fontSize: 16 }}>
                            {f.name[0]}
                          </span>
                        ))}
                        <button type="button" className="mf-btn mf-btn-primary" style={{ marginLeft: 'auto', minHeight: 44 }} onClick={() => { setPlaying(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                          Press play
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ SECTION */}
        <section className="mf-section" id="faq">
          <div className="mf-wrap mf-faq">
            <div className="mf-head">
              <span className="mf-pill">FAQ</span>
              <h2>Questions before movie night?</h2>
              <p className="mf-lead">Quick answers to what people ask first.</p>
            </div>
            <div>
              {FAQS.map((f, i) => (
                <div className={`mf-q ${faq === i ? 'mf-o' : ''}`} key={f.q}>
                  <button type="button" aria-expanded={faq === i} onClick={() => setFaq(faq === i ? null : i)}>
                    <span>{f.q}</span>
                    <span aria-hidden="true">+</span>
                  </button>
                  <div className="mf-a">
                    <div><p>{f.a}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="mf-wrap">
          <div className="mf-final">
            <h2>The best part of a movie is <span className="mf-grad">sharing it.</span></h2>
            <p className="mf-lead">Get your people together, pick a movie, and make a memory.</p>
            <Link to="/signup" className="mf-btn mf-btn-primary">Get started for free</Link>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="mf-foot">
        <div className="mf-wrap">
          <div className="mf-foot-grid">
            <div>
              <Logo />
              <p>Movie nights for people who are miles apart.</p>
            </div>
            <div>
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#how-it-works">How it works</a>
              <a href="#faq">FAQ</a>
            </div>
            <div>
              <h4>Account</h4>
              <Link to="/login">Log in</Link>
              <Link to="/signup">Sign up</Link>
            </div>
          </div>
          <div className="mf-copy">© {new Date().getFullYear()} MovieFlex. Made for shared moments.</div>
        </div>
      </footer>

      {/* TOAST NOTIFICATION */}
      {toast && <div className="mf-toast" role="status">{toast}</div>}
    </div>
  );
}