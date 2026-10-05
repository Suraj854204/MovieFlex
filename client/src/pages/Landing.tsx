// src/pages/Landing.tsx

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Icon, type IconName } from '../components/ui/Icon';

const FRIENDS = [
  { name: 'Jamie', color: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)', avatarBg: '#ff758c' },
  { name: 'Alex', color: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', avatarBg: '#f6d365' },
  { name: 'Maya', color: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)', avatarBg: '#2dd4bf' },
];

const REACTIONS = ['❤️', '😂', '😮', '🔥', '👏', '🍿', '⚡'];
const GENRES = ['Thriller', 'Sci-fi', 'Comedy', 'Action', 'Horror', 'Animation', 'Drama'];
const TOTAL_DURATION = 6200;
const DEMO_INVITE = 'https://movieflex.app/room/DEMO26';

const STATS = [
  { label: 'Active Watch Rooms', value: '24,800+' },
  { label: 'Sync Latency', value: '< 12ms' },
  { label: 'Live Streamers', value: '98.4K' },
  { label: 'Movies Streamed', value: '2.8M+' },
];

const STEPS = [
  { title: 'Create standard watch space', text: 'Spin up an encrypted room instantly with 4K stream capability.', pane: 'room' },
  { title: 'Share instant access link', text: 'One-click invite link bypasses logins for instant guest entry.', pane: 'invite' },
  { title: 'Watch seamlessly in sync', text: 'Real-time multi-threaded state syncing keeps audio and video tight.', pane: 'play' },
];

const FAQS = [
  { q: 'What makes MovieFlex different from standard watch extensions?', a: 'MovieFlex operates directly inside your modern browser without clunky extensions. It syncs video playback at under 12ms latency while offering low-overhead live video and chat.' },
  { q: 'How do friends join my private room?', a: 'Once you create a party room, click "Copy Link" and drop it into any messaging app. Guests tap the link and drop right into the playback session.' },
  { q: 'Is high resolution 4K HDR playback supported?', a: 'Yes! Pro watch rooms stream full 4K UHD with HDR color reproduction and multi-channel spatial audio pass-through.' },
  { q: 'Does MovieFlex work across mobile and smart TVs?', a: 'MovieFlex adapts natively across WebGL-enabled mobile browsers, tablets, and smart TV browsers with full cross-device synchronization.' },
];

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const ultraStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

  :root {
    --bg-base: #03050c;
    --bg-card: rgba(13, 16, 32, 0.65);
    --bg-card-hover: rgba(22, 27, 52, 0.75);
    --glass-border: rgba(255, 255, 255, 0.08);
    --glass-border-bright: rgba(129, 140, 248, 0.35);
    
    --text-primary: #f8fafc;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    
    --accent-violet: #6366f1;
    --accent-cyan: #06b6d4;
    --accent-rose: #f43f5e;
    --accent-teal: #10b981;

    --grad-primary: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%);
    --grad-glow: linear-gradient(135deg, rgba(99, 102, 241, 0.4) 0%, rgba(168, 85, 247, 0.3) 50%, rgba(6, 182, 212, 0.4) 100%);
    --grad-cyan: linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%);
    
    --font-heading: 'Sora', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    --font-body: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

    /* Fluid spacing */
    --mf-section-y: clamp(48px, 8vw, 96px);
    --mf-gap: clamp(14px, 1.8vw, 20px);
  }

  .mf-ultra-root, .mf-ultra-root * { box-sizing: border-box; }
  .mf-ultra-root {
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bg-base);
    color: var(--text-primary);
    font-family: var(--font-body);
    overflow-x: clip;
    position: relative;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    font-size: 16px;
    line-height: 1.55;
    -webkit-text-size-adjust: 100%;
  }
  .mf-ultra-root img, .mf-ultra-root svg { max-width: 100%; }

  .mf-ambient-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }
  .mf-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(140px);
    opacity: 0.35;
    animation: orbPulse 12s infinite alternate ease-in-out;
  }
  .mf-orb-1 { width: 700px; height: 700px; background: #6366f1; top: -200px; left: -100px; }
  .mf-orb-2 { width: 600px; height: 600px; background: #c084fc; top: 200px; right: -150px; animation-delay: -4s; }
  .mf-orb-3 { width: 500px; height: 500px; background: #06b6d4; top: 1100px; left: 20%; animation-delay: -8s; }

  @keyframes orbPulse {
    0% { transform: scale(1) translate(0, 0); opacity: 0.3; }
    100% { transform: scale(1.18) translate(30px, -40px); opacity: 0.45; }
  }

  .mf-grid-overlay {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, #000 70%, transparent 100%);
    -webkit-mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, #000 70%, transparent 100%);
  }

  .mf-ultra-root h1, .mf-ultra-root h2, .mf-ultra-root h3 {
    font-family: var(--font-heading);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.08;
    text-wrap: balance;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .mf-ultra-root h2 {
    font-size: clamp(26px, 4.2vw, 52px);
    letter-spacing: -0.04em;
    line-height: 1.04;
  }
  .mf-ultra-root h3 { letter-spacing: -0.02em; }
  .mf-ultra-root p { text-wrap: pretty; margin: 0; }
  .mf-gradient-text {
    background: var(--grad-primary);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .mf-container {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 clamp(16px, 4vw, 48px);
  }

  .mf-section { padding: var(--mf-section-y) 0; }
  .mf-section-head { text-align: center; margin-bottom: clamp(28px, 4vw, 40px); }

  /* ---------- Navbar ---------- */
  .mf-navbar {
    position: sticky;
    top: 0;
    z-index: 100;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    border-bottom: 1px solid transparent;
  }
  .mf-navbar.scrolled {
    background: rgba(3, 5, 12, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom-color: var(--glass-border);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  }
  .mf-nav-content {
    height: clamp(64px, 8vw, 80px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .mf-nav-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-shrink: 0;
  }
  .mf-nav-login {
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    padding: 0 12px;
  }
  .mf-nav-cta {
    height: 44px !important;
    padding: 0 20px !important;
    border-radius: 10px !important;
  }
  .mf-nav-links {
    display: flex;
    gap: 8px;
    background: rgba(255, 255, 255, 0.03);
    padding: 6px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
  }
  .mf-nav-links a {
    padding: 8px 18px;
    border-radius: 999px;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.005em;
    color: var(--text-secondary);
    transition: all 0.2s;
    white-space: nowrap;
  }
  .mf-nav-links a:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

  /* ---------- Buttons ---------- */
  .mf-btn-ultra {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 52px;
    padding: 0 28px;
    border-radius: 14px;
    font-family: var(--font-heading);
    font-weight: 700;
    font-size: 15px;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    border: 1px solid transparent;
    text-decoration: none;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
  }
  .mf-btn-primary-glow {
    background: var(--grad-primary);
    color: #fff;
    box-shadow: 0 0 30px rgba(168, 85, 247, 0.35);
  }
  .mf-btn-primary-glow:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 10px 40px rgba(168, 85, 247, 0.55);
  }
  .mf-btn-glass {
    background: rgba(255, 255, 255, 0.05);
    border-color: var(--glass-border);
    color: var(--text-primary);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .mf-btn-glass:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  /* ---------- Hero ---------- */
  .mf-hero-section {
    padding: clamp(40px, 8vw, 110px) 0 40px;
    text-align: center;
  }
  .mf-pill-tag {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 6px 16px 6px 8px;
    border-radius: 999px;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(129, 140, 248, 0.3);
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #c7d2fe;
    margin-bottom: 28px;
    max-width: 100%;
    text-align: left;
  }
  .mf-pill-badge {
    padding: 3px 10px;
    border-radius: 999px;
    background: var(--grad-primary);
    color: #fff;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .mf-hero-title {
    font-size: clamp(36px, 7vw, 88px) !important;
    font-weight: 800;
    max-width: 16ch;
    margin: 0 auto 26px !important;
    letter-spacing: -0.05em;
    line-height: 1.04 !important;
  }
  .mf-hero-desc {
    font-size: clamp(16px, 1.8vw, 21px);
    color: var(--text-secondary);
    max-width: 58ch;
    margin: 0 auto 40px !important;
    line-height: 1.65;
    font-weight: 500;
    letter-spacing: -0.005em;
  }
  .mf-hero-actions {
    display: flex;
    gap: 16px;
    justify-content: center;
    flex-wrap: wrap;
  }

  .mf-stats-container {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 20px;
    margin-top: clamp(36px, 5vw, 60px);
    padding: clamp(18px, 2.5vw, 24px) clamp(18px, 3vw, 32px);
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .mf-stat-box b {
    display: block;
    font-size: clamp(22px, 3vw, 38px);
    font-family: var(--font-heading);
    font-weight: 700;
    letter-spacing: -0.03em;
    font-variant-numeric: tabular-nums;
    color: #fff;
  }
  .mf-stat-box span {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.09em;
  }

  /* ---------- Demo app frame ---------- */
  .mf-app-frame-wrap {
    margin-top: clamp(40px, 8vw, 100px);
    position: relative;
  }
  .mf-app-frame-glow {
    position: absolute;
    inset: -20px;
    background: var(--grad-glow);
    filter: blur(80px);
    opacity: 0.6;
    border-radius: 40px;
    z-index: 0;
  }
  .mf-app-frame {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr) 320px;
    border-radius: clamp(18px, 2.5vw, 28px);
    background: var(--bg-card);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    box-shadow: 0 40px 100px rgba(0, 0, 0, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.1);
    overflow: hidden;
    text-align: left;
  }

  .mf-app-sidebar {
    padding: 24px 20px;
    border-right: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .mf-mono { font-family: var(--font-mono); letter-spacing: 0; }
  .mf-sidebar-label {
    font-size: 11px;
    font-weight: 800;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .mf-user-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid transparent;
    transition: all 0.2s;
  }
  .mf-user-item:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--glass-border);
  }
  .mf-avatar {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 14px;
    color: #000;
    flex-shrink: 0;
  }
  .mf-online-dot {
    position: absolute;
    bottom: -1px;
    right: -1px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent-teal);
    border: 2px solid #000;
  }

  .mf-app-player {
    padding: clamp(14px, 2.2vw, 24px);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-width: 0;
  }
  .mf-player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px 12px;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  .mf-sync-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #6ee7b7;
    font-size: 12px;
    font-weight: 700;
    white-space: nowrap;
  }
  .mf-sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-teal);
    box-shadow: 0 0 12px var(--accent-teal);
    flex-shrink: 0;
  }

  .mf-video-screen {
    position: relative;
    aspect-ratio: 16/9;
    border-radius: 18px;
    overflow: hidden;
    background: radial-gradient(ellipse at center, #1e1b4b 0%, #090d16 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mf-video-overlay-title {
    text-align: center;
    z-index: 2;
    padding: 0 12px;
    margin-top: clamp(60px, 9vw, 110px);
  }
  .mf-video-title-main {
    font-size: clamp(16px, 2.6vw, 28px);
    display: block;
  }
  .mf-play-center-btn {
    position: absolute;
    z-index: 10;
    width: clamp(52px, 7vw, 72px);
    height: clamp(52px, 7vw, 72px);
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: grid;
    place-items: center;
    -webkit-tap-highlight-color: transparent;
  }
  .mf-play-center-btn:hover {
    transform: scale(1.12);
    background: rgba(255, 255, 255, 0.35);
  }

  .mf-scrub-row {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 12px;
    color: var(--text-muted);
  }
  .mf-scrub-row input[type="range"] {
    flex: 1;
    min-width: 0;
    accent-color: #6366f1;
    cursor: pointer;
    height: 28px; /* easier to grab on touch */
  }
  .mf-reactions {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    flex-wrap: wrap;
  }
  .mf-reaction-btn {
    padding: 8px 14px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--glass-border);
    cursor: pointer;
    font-size: 16px;
    min-height: 40px;
  }

  .mf-app-chat {
    padding: 24px 20px;
    border-left: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .mf-chat-history {
    flex: 1;
    min-height: 220px;
    max-height: 320px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding-right: 6px;
    -webkit-overflow-scrolling: touch;
  }
  .mf-chat-bubble {
    display: flex;
    gap: 10px;
    font-size: 13px;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .mf-chat-form {
    margin-top: 16px;
    display: flex;
    gap: 8px;
  }
  .mf-chat-form input {
    flex: 1;
    min-width: 0;
    height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--glass-border);
    color: #fff;
    font-size: 16px; /* prevents iOS zoom on focus */
  }
  .mf-chat-form button {
    width: 44px;
    height: 44px;
    border-radius: 8px;
    background: var(--accent-violet);
    border: none;
    color: #fff;
    font-weight: 800;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* ---------- Bento ---------- */
  .mf-bento-grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--mf-gap);
    margin-top: clamp(32px, 4vw, 60px);
  }
  .mf-bento-card {
    position: relative;
    border-radius: clamp(18px, 2.4vw, 24px);
    padding: clamp(20px, 3vw, 32px);
    background: var(--bg-card);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
    min-width: 0;
  }
  .mf-bento-card:hover {
    border-color: var(--glass-border-bright);
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }
  .mf-col-4 { grid-column: span 4; }
  .mf-col-2 { grid-column: span 2; }
  .mf-col-3 { grid-column: span 3; }

  .mf-bento-text { color: var(--text-secondary); margin-top: 8px !important; }
  .mf-lag-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
  }
  .mf-lag-name { font-size: 13px; width: 50px; flex-shrink: 0; }
  .mf-lag-track {
    flex: 1;
    height: 6px;
    border-radius: 99px;
    background: rgba(255,255,255,0.08);
    overflow: hidden;
  }
  .mf-genre-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .mf-genre-chip {
    padding: 8px 14px;
    border-radius: 99px;
    border: 1px solid var(--glass-border);
    color: #fff;
    cursor: pointer;
    font-size: 12px;
  }

  /* ---------- Cross-platform ---------- */
  .mf-device-bar {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: clamp(28px, 4vw, 40px);
  }
  .mf-device-tab {
    padding: 10px 24px;
    border-radius: 999px;
    border: 1px solid var(--glass-border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-secondary);
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    min-height: 40px;
  }
  .mf-device-tab.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
  }
  .mf-how-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(20px, 3.5vw, 40px);
    align-items: center;
  }
  .mf-step-item {
    padding: 20px;
    border-radius: 16px;
    border: 1px solid transparent;
    cursor: pointer;
    margin-bottom: 12px;
  }
  .mf-step-item.active {
    background: rgba(255,255,255,0.05);
    border-color: var(--glass-border);
  }
  .mf-preview-panel {
    padding: clamp(16px, 3vw, 40px);
    border-radius: clamp(18px, 2.4vw, 24px);
    background: var(--bg-card);
    border: 1px solid var(--glass-border);
    min-height: 280px;
    display: grid;
    place-items: center;
    min-width: 0;
    overflow: hidden;
  }

  /* ---------- FAQ ---------- */
  .mf-faq-grid {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: clamp(28px, 5vw, 60px);
    align-items: start;
  }
  .mf-faq-item {
    border-bottom: 1px solid var(--glass-border);
  }
  .mf-faq-btn {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 24px 0;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: clamp(16px, 1.6vw, 18px);
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }
  .mf-faq-answer {
    padding-bottom: 24px;
    color: var(--text-secondary);
    font-size: 15px;
  }

  /* ---------- Final CTA / footer ---------- */
  .mf-cta-section { padding: var(--mf-section-y) 0 clamp(64px, 10vw, 120px); text-align: center; }
  .mf-cta-box {
    padding: clamp(32px, 6vw, 60px) clamp(18px, 4vw, 40px);
    border-radius: clamp(20px, 3vw, 32px);
    background: radial-gradient(ellipse at top, rgba(99,102,241,0.25) 0%, rgba(3,5,12,1) 100%);
    border: 1px solid var(--glass-border);
    text-align: center;
  }
  .mf-cta-box h2 { font-size: clamp(28px, 5vw, 64px) !important; margin-bottom: 20px !important; }
  .mf-cta-box p { color: var(--text-secondary); font-size: clamp(15px, 1.6vw, 18px); margin-bottom: 32px !important; }

  .mf-footer {
    border-top: 1px solid var(--glass-border);
    padding: 40px 0;
    font-size: 14px;
    color: var(--text-muted);
  }
  .mf-footer-inner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
  }

  .mf-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    max-width: calc(100vw - 32px);
    padding: 14px 24px;
    border-radius: 12px;
    background: #fff;
    color: #000;
    font-weight: 700;
    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    z-index: 1000;
    overflow-wrap: anywhere;
  }

  /* =====================================================
     RESPONSIVE BREAKPOINTS
     Desktop > 1180 | Laptop/small desktop ≤ 1180
     Tablet ≤ 1080 / 900 | Large phone ≤ 640 | Small phone ≤ 400
     ===================================================== */

  /* Laptop: narrower side panels so the video keeps room */
  @media (max-width: 1280px) {
    .mf-app-frame { grid-template-columns: 200px minmax(0, 1fr) 280px; }
  }
  @media (max-width: 1180px) {
    .mf-app-frame { grid-template-columns: minmax(0, 1fr) 280px; }
    .mf-app-sidebar { display: none; }
  }

  /* Tablet */
  @media (max-width: 1080px) {
    .mf-app-frame { grid-template-columns: minmax(0, 1fr); }
    .mf-app-chat {
      border-left: none;
      border-top: 1px solid var(--glass-border);
    }
    .mf-chat-history { min-height: 180px; max-height: 260px; }

    .mf-col-4 { grid-column: span 6; }
    .mf-col-3 { grid-column: span 3; }
    .mf-col-2 { grid-column: span 3; }
    .mf-bento-grid > .mf-col-3:last-child { grid-column: span 6; }

    .mf-stats-container { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (max-width: 900px) {
    .mf-faq-grid { grid-template-columns: minmax(0, 1fr); }
    .mf-faq-grid > div:first-child { text-align: center; }
    .mf-how-grid { grid-template-columns: minmax(0, 1fr); }
  }

  /* Phone */
  @media (max-width: 720px) {
    .mf-nav-links { display: none; }
  }
  @media (max-width: 640px) {
    .mf-col-4, .mf-col-3, .mf-col-2,
    .mf-bento-grid > .mf-col-3:last-child { grid-column: span 6; }

    .mf-hero-actions { flex-direction: column; align-items: stretch; gap: 12px; }
    .mf-hero-actions .mf-btn-ultra { width: 100%; }
    .mf-btn-ultra { height: 50px; padding: 0 22px; }

    .mf-pill-tag { font-size: 12px; padding-right: 12px; }
    .mf-stats-container { gap: 16px 12px; border-radius: 18px; }
    .mf-stat-box span { font-size: 10px; letter-spacing: 0.06em; }

    .mf-video-screen { border-radius: 14px; }
    .mf-reactions { gap: 6px; }
    .mf-reaction-btn { padding: 6px 10px; flex: 1 1 auto; text-align: center; }
    .mf-app-chat { padding: 18px 14px; }

    .mf-device-bar { gap: 8px; }
    .mf-device-tab { padding: 9px 16px; font-size: 12px; }
    .mf-step-item { padding: 16px; }
    .mf-faq-btn { padding: 18px 0; }

    .mf-footer-inner { flex-direction: column; text-align: center; justify-content: center; }
    .mf-toast { left: 16px; right: 16px; bottom: 16px; text-align: center; }

    .mf-nav-login { padding: 0 6px; }
    .mf-nav-cta { height: 40px !important; padding: 0 14px !important; font-size: 13px !important; }
    .mf-orb-1 { width: 420px; height: 420px; }
    .mf-orb-2 { width: 360px; height: 360px; }
    .mf-orb-3 { width: 320px; height: 320px; }
  }

  /* Small phones */
  @media (max-width: 400px) {
    .mf-stats-container { grid-template-columns: minmax(0, 1fr); }
    .mf-nav-actions { gap: 6px; }
    .mf-lag-name { width: 42px; font-size: 12px; }
    .mf-faq-btn { font-size: 15px; }
  }

  /* Touch devices: skip sticky hover effects */
  @media (hover: none) {
    .mf-btn-primary-glow:hover,
    .mf-btn-glass:hover,
    .mf-bento-card:hover,
    .mf-play-center-btn:hover { transform: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .mf-orb { animation: none; }
    .mf-btn-ultra, .mf-bento-card, .mf-navbar, .mf-play-center-btn { transition: none; }
  }
`;

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(1840);
  const [device, setDevice] = useState<'desktop' | 'mobile' | 'tv'>('desktop');
  const [chat, setChat] = useState([
    { who: 'Jamie', text: 'That plot twist at the end! 😭' },
    { who: 'Alex', text: 'Totally missed that detail!' },
  ]);
  const [draft, setDraft] = useState('');
  const [floats, setFloats] = useState<{ id: number; e: string; l: number }[]>([]);
  const [lag, setLag] = useState(false);
  const [priv, setPriv] = useState(true);
  const [genres, setGenres] = useState<string[]>(['Thriller', 'Sci-fi']);
  const [tab, setTab] = useState(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [toast, setToast] = useState('');

  const msgsRef = useRef<HTMLDivElement>(null);
  const uid = useRef(0);

  useEffect(() => {
    document.title = 'MovieFlex Ultra — Multi-threaded Sync Watch Party';
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setTime((t) => (t >= TOTAL_DURATION ? 0 : t + 25));
    }, 250);
    return () => window.clearInterval(interval);
  }, [playing]);

  useEffect(() => {
    msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight, behavior: 'smooth' });
  }, [chat]);

  const triggerReaction = (e: string) => {
    const id = ++uid.current;
    setFloats((f) => [...f, { id, e, l: 15 + Math.random() * 70 }]);
    window.setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2000);
  };

  const handleSendMessage = (ev: FormEvent) => {
    ev.preventDefault();
    if (!draft.trim()) return;
    setChat((c) => [...c, { who: 'You', text: draft.trim() }]);
    setDraft('');
    window.setTimeout(() => {
      setChat((c) => [...c, { who: 'Maya', text: '100% agree with that! 🔥' }]);
    }, 900);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(DEMO_INVITE);
      setToast('Invite link copied to clipboard!');
    } catch {
      setToast(DEMO_INVITE);
    }
    window.setTimeout(() => setToast(''), 3000);
  };

  const progressPercent = (time / TOTAL_DURATION) * 100;

  return (
    <div className="mf-ultra-root">
      <style>{ultraStyles}</style>

      {/* Ambient Engine Overlay */}
      <div className="mf-ambient-bg">
        <div className="mf-orb mf-orb-1" />
        <div className="mf-orb mf-orb-2" />
        <div className="mf-orb mf-orb-3" />
        <div className="mf-grid-overlay" />
      </div>

      {/* Top Navbar */}
      <header className={`mf-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="mf-container">
          <div className="mf-nav-content">
            <Link to="/" aria-label="MovieFlex Home"><Logo /></Link>
            
            <nav className="mf-nav-links">
              <a href="#features">Features</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#faq">FAQ</a>
            </nav>

            <div className="mf-nav-actions">
              <Link to="/login" className="mf-nav-login">Log In</Link>
              <Link to="/signup" className="mf-btn-ultra mf-btn-primary-glow mf-nav-cta">Get Started</Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mf-container">
        
        {/* Hero Section */}
        <section className="mf-hero-section">
          <div className="mf-pill-tag">
            <span className="mf-pill-badge">v2.4 Live</span>
            Ultra-low Latency Multi-Threaded Sync Engine
          </div>

          <h1 className="mf-hero-title">
            Watch together in <span className="mf-gradient-text">perfect precision</span>.
          </h1>

          <p className="mf-hero-desc">
            Sync video, low-latency spatial audio, and live reactions across web, mobile, and smart TVs with sub-12ms delay.
          </p>

          <div className="mf-hero-actions">
            <Link to="/signup" className="mf-btn-ultra mf-btn-primary-glow">Start Private Party</Link>
            <button type="button" className="mf-btn-ultra mf-btn-glass" onClick={copyInvite}>Copy Demo Link</button>
          </div>

          {/* Live Stats Showcase */}
          <div className="mf-stats-container">
            {STATS.map((s) => (
              <div key={s.label} className="mf-stat-box">
                <b>{s.value}</b>
                <span>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Interactive Watch Room Demo App Frame */}
          <div className="mf-app-frame-wrap">
            <div className="mf-app-frame-glow" />
            
            <div className="mf-app-frame">
              {/* Left Sidebar */}
              <aside className="mf-app-sidebar">
                <span className="mf-sidebar-label">Active Viewers (4)</span>
                {[{ name: 'You', color: '#818cf8', avatarBg: '#6366f1' }, ...FRIENDS].map((u) => (
                  <div key={u.name} className="mf-user-item">
                    <div className="mf-avatar" style={{ background: u.avatarBg }}>
                      {u.name[0]}
                      <div className="mf-online-dot" />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{u.name}</span>
                  </div>
                ))}
              </aside>

              {/* Main Video Stream Player */}
              <div className="mf-app-player">
                <div className="mf-player-header">
                  <div>
                    <h3 style={{ fontSize: '16px' }}>Friday Night Party</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Room Code: <span className="mf-mono">DEMO26</span></span>
                  </div>
                  <div className="mf-sync-badge">
                    <div className="mf-sync-dot" />
                    {playing ? 'STREAMING IN SYNC' : 'PAUSED FOR ALL'}
                  </div>
                </div>

                <div className="mf-video-screen">
                  <button type="button" className="mf-play-center-btn" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying(!playing)}>
                    {playing ? '❚❚' : '▶'}
                  </button>
                  
                  <div className="mf-video-overlay-title">
                    <b className="mf-video-title-main">Interstellar Ultra 4K</b>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Chapter 4 — Gargantua Encounter</span>
                  </div>

                  {floats.map((f) => (
                    <span key={f.id} style={{ position: 'absolute', bottom: '20%', left: `${f.l}%`, fontSize: '32px', animation: 'orbPulse 1.5s forwards' }}>
                      {f.e}
                    </span>
                  ))}
                </div>

                {/* Scrubber Controls */}
                <div style={{ marginTop: '16px' }}>
                  <div className="mf-scrub-row">
                    <span className="mf-mono">{fmtTime(time)}</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={TOTAL_DURATION} 
                      value={time} 
                      onChange={(e) => setTime(Number(e.target.value))}
                    />
                    <span className="mf-mono">{fmtTime(TOTAL_DURATION)}</span>
                  </div>

                  {/* Reaction Toolbar */}
                  <div className="mf-reactions">
                    {REACTIONS.map((r) => (
                      <button 
                        key={r} 
                        type="button" 
                        className="mf-reaction-btn"
                        onClick={() => triggerReaction(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Chat Sidebar Right */}
              <aside className="mf-app-chat">
                <span className="mf-sidebar-label" style={{ marginBottom: '16px' }}>Room Chat</span>
                
                <div className="mf-chat-history" ref={msgsRef}>
                  {chat.map((m, idx) => (
                    <div key={idx} className="mf-chat-bubble">
                      <div className="mf-avatar" style={{ width: '28px', height: '28px', fontSize: '12px', background: '#38bdf8' }}>
                        {m.who[0]}
                      </div>
                      <div>
                        <b style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{m.who}</b>
                        <span>{m.text}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleSendMessage} className="mf-chat-form">
                  <input 
                    type="text" 
                    value={draft} 
                    onChange={(e) => setDraft(e.target.value)} 
                    placeholder="Type message..." 
                  />
                  <button type="submit" aria-label="Send message">↑</button>
                </form>
              </aside>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" className="mf-section">
          <div className="mf-section-head">
            <span className="mf-pill-tag">Ultra Features</span>
            <h2>Designed for lossless shared moments.</h2>
          </div>

          <div className="mf-bento-grid">
            <article className="mf-bento-card mf-col-4">
              {icon('sync')}
              <h3>Sub-12ms Multi-Threaded Sync</h3>
              <p className="mf-bento-text">
                Frame-accurate synchronization prevents spoilers and drift, snapping lagging clients smoothly back in timeline.
              </p>
              
              <div style={{ marginTop: '24px' }}>
                {FRIENDS.map((f, i) => (
                  <div key={f.name} className="mf-lag-row">
                    <span className="mf-lag-name">{f.name}</span>
                    <div className="mf-lag-track">
                      <div style={{ height: '100%', width: `${lag && i === 2 ? progressPercent - 12 : progressPercent}%`, background: 'var(--grad-primary)', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
                <button type="button" className="mf-btn-ultra mf-btn-glass" style={{ height: '40px', padding: '0 16px', fontSize: '12px', marginTop: '16px' }} onClick={() => setLag(!lag)}>
                  {lag ? 'Resync Maya' : 'Simulate Network Lag'}
                </button>
              </div>
            </article>

            <article className="mf-bento-card mf-col-2">
              {icon('shield')}
              <h3>Encrypted Rooms</h3>
              <p className="mf-bento-text">End-to-end access permissions keep unauthorized users out.</p>
              <div style={{ marginTop: '20px' }}>
                <button type="button" className="mf-btn-ultra mf-btn-glass" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPriv(!priv)}>
                  <span>{priv ? 'Invite-Only Access' : 'Open Link Access'}</span>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', flexShrink: 0, background: priv ? 'var(--accent-teal)' : 'var(--accent-rose)' }} />
                </button>
              </div>
            </article>

            <article className="mf-bento-card mf-col-3">
              {icon('compass')}
              <h3>Genre Discovery Engine</h3>
              <p className="mf-bento-text">Vote on genres in real-time to decide room playlist.</p>
              <div className="mf-genre-wrap">
                {GENRES.map((g) => (
                  <button 
                    key={g} 
                    type="button" 
                    className="mf-genre-chip"
                    onClick={() => setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])}
                    style={{ background: genres.includes(g) ? 'var(--accent-violet)' : 'rgba(255,255,255,0.03)' }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </article>

            <article className="mf-bento-card mf-col-3">
              {icon('message')}
              <h3>Spatial Audio Reactions</h3>
              <p className="mf-bento-text">Drop instant audio triggers without muting main playback channel.</p>
            </article>
          </div>
        </section>

        {/* Device Switcher How It Works */}
        <section id="how-it-works" className="mf-section">
          <div className="mf-section-head">
            <span className="mf-pill-tag">Cross Platform</span>
            <h2>Seamlessly synced on all screens.</h2>
          </div>

          <div className="mf-device-bar">
            {(['desktop', 'mobile', 'tv'] as const).map((d) => (
              <button key={d} type="button" className={`mf-device-tab ${device === d ? 'active' : ''}`} onClick={() => setDevice(d)}>
                {d.toUpperCase()} VIEW
              </button>
            ))}
          </div>

          <div className="mf-how-grid">
            <div>
              {STEPS.map((s, i) => (
                <div 
                  key={s.title} 
                  onClick={() => setTab(i)}
                  className={`mf-step-item ${tab === i ? 'active' : ''}`}
                >
                  <h3 style={{ fontSize: '18px' }}>{i + 1}. {s.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>{s.text}</p>
                </div>
              ))}
            </div>

            <div className="mf-preview-panel">
              <StepPreview tab={tab} device={device} />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="mf-section">
          <div className="mf-faq-grid">
            <div>
              <span className="mf-pill-tag">FAQ</span>
              <h2>Got questions? We've got answers.</h2>
            </div>

            <div>
              {FAQS.map((f, i) => (
                <div key={f.q} className="mf-faq-item">
                  <button type="button" className="mf-faq-btn" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                    <span>{f.q}</span>
                    <span style={{ flexShrink: 0 }}>{faqOpen === i ? '−' : '+'}</span>
                  </button>
                  {faqOpen === i && (
                    <p className="mf-faq-answer">{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mf-cta-section">
          <div className="mf-cta-box">
            <h2>Ready for your next movie night?</h2>
            <p>Spin up a private room in under 10 seconds.</p>
            <Link to="/signup" className="mf-btn-ultra mf-btn-primary-glow">Start Party Free</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mf-footer">
        <div className="mf-container mf-footer-inner">
          <Logo />
          <div>© {new Date().getFullYear()} MovieFlex Ultra. All rights reserved.</div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div className="mf-toast">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── ADDED: realistic app mockups for the "Cross Platform" steps (replaces the earlier StepPreview) ── */
type Dev = 'desktop' | 'mobile' | 'tv';

function DeviceFrame({ device, children }: { device: Dev; children: React.ReactNode }) {
  const shadow = '0 24px 60px rgba(0,0,0,0.55)';
  if (device === 'mobile') {
    return (
      <div style={{ width: '100%', maxWidth: 252, margin: '0 auto', padding: 8, borderRadius: 36, background: '#0b0f1c', border: '2px solid rgba(255,255,255,0.14)', boxShadow: shadow }}>
        <div style={{ width: 64, height: 6, borderRadius: 9, background: 'rgba(255,255,255,0.18)', margin: '2px auto 8px' }} />
        <div style={{ borderRadius: 26, background: '#070a14', padding: 12, minHeight: 330, overflow: 'hidden' }}>{children}</div>
      </div>
    );
  }
  if (device === 'tv') {
    return (
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ padding: 8, borderRadius: 14, background: '#0b0f1c', border: '2px solid rgba(255,255,255,0.14)', boxShadow: shadow }}>
          <div style={{ borderRadius: 8, background: '#070a14', padding: 'clamp(12px, 3vw, 18px)', minHeight: 300, overflow: 'hidden' }}>{children}</div>
        </div>
        <div style={{ width: 110, height: 8, margin: '0 auto', background: 'rgba(255,255,255,0.14)', borderRadius: '0 0 10px 10px' }} />
      </div>
    );
  }
  return (
    <div style={{ width: '100%', maxWidth: 470, margin: '0 auto', borderRadius: 14, background: '#070a14', border: '1px solid rgba(255,255,255,0.12)', boxShadow: shadow, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
        {['#f87171', '#fbbf24', '#34d399'].map((c) => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, flexShrink: 0 }} />)}
        <span style={{ flex: 1, minWidth: 0, marginLeft: 8, padding: '4px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>movieflex / room / K7P4QX</span>
      </div>
      <div style={{ padding: 'clamp(12px, 3vw, 18px)', minHeight: 300 }}>{children}</div>
    </div>
  );
}

function StepPreview({ tab, device }: { tab: number; device: Dev }) {
  const small = device === 'mobile';
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 };
  const input: React.CSSProperties = { padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
  const primary: React.CSSProperties = { padding: '10px 14px', borderRadius: 10, background: 'var(--grad-primary)', color: '#fff', fontSize: 12, fontWeight: 800, textAlign: 'center', fontFamily: 'var(--font-heading)' };
  const avatar = (n: string, bg: string, i: number): React.ReactNode => (
    <span key={n} style={{ width: 26, height: 26, marginLeft: i ? -8 : 0, borderRadius: '50%', background: bg, border: '2px solid #070a14', display: 'inline-grid', placeItems: 'center', fontSize: 11, fontWeight: 800, color: '#000' }}>{n}</span>
  );

  let body: React.ReactNode;

  if (tab === 0) {
    body = (
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Create a watch room</div>
        <span style={lbl}>Room name</span>
        <div style={input}>Friday movie night</div>
        <span style={lbl}>YouTube link</span>
        <div style={{ ...input, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 44, height: 26, borderRadius: 6, background: 'linear-gradient(135deg,#312e81,#0f172a)', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 10, color: '#fff' }}>▶</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>youtube.com/watch?v=…</span>
        </div>
        <span style={lbl}>Visibility</span>
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.05)', marginBottom: 12 }}>
          <span style={{ flex: 1, textAlign: 'center', padding: '7px 0', borderRadius: 9, background: 'var(--accent-violet)', fontSize: 12, fontWeight: 700 }}>Public</span>
          <span style={{ flex: 1, textAlign: 'center', padding: '7px 0', fontSize: 12, color: 'var(--text-muted)' }}>Private</span>
        </div>
        <div style={primary}>Create room</div>
      </div>
    );
  } else if (tab === 1) {
    body = (
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Friday movie night</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>Invite friends to join</div>
        <span style={lbl}>Room code</span>
        <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
          {'K7P4QX'.split('').map((c, i) => (
            <span key={i} style={{ flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--glass-border)', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: small ? 14 : 17 }}>{c}</span>
          ))}
        </div>
        <span style={lbl}>Invite link</span>
        <div style={input}>movieflex.example/room/K7P4QX</div>
        <div style={primary}>Copy invite link</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, fontSize: 11, color: 'var(--text-muted)' }}>
          <span>{avatar('H', '#ff758c', 0)}{avatar('J', '#f6d365', 1)}{avatar('M', '#2dd4bf', 2)}</span>
          3 joined
        </div>
      </div>
    );
  } else {
    body = (
      <div>
        <div style={{ aspectRatio: '16/9', borderRadius: 12, background: 'radial-gradient(ellipse at center, #312e81 0%, #090d16 100%)', position: 'relative', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', display: 'grid', placeItems: 'center', fontSize: 16 }}>▶</span>
          <span style={{ position: 'absolute', left: 10, right: 10, bottom: 10, height: 4, borderRadius: 9, background: 'rgba(255,255,255,0.15)' }}>
            <span style={{ display: 'block', width: '38%', height: '100%', borderRadius: 9, background: 'var(--grad-primary)' }} />
          </span>
          <span style={{ position: 'absolute', top: 8, right: 10, fontSize: 18 }}>🔥</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '12px 0' }}>
          <span className="mf-sync-badge" style={{ padding: '4px 10px', fontSize: 11 }}><span className="mf-sync-dot" /> In sync</span>
          <span>{avatar('H', '#ff758c', 0)}{avatar('J', '#f6d365', 1)}{avatar('M', '#2dd4bf', 2)}</span>
        </div>
        {[['Jamie', 'No way, rewind that!'], ['Maya', 'Same timestamp for all of us 😂']].map(([who, msg]) => (
          <div key={who} style={{ fontSize: 11, padding: '7px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', marginBottom: 6 }}>
            <b style={{ color: '#a5b4fc' }}>{who}</b> <span style={{ color: 'var(--text-secondary)' }}>{msg}</span>
          </div>
        ))}
      </div>
    );
  }

  return <DeviceFrame device={device}>{body}</DeviceFrame>;
}

function icon(name: IconName) {
  return (
    <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'grid', placeItems: 'center', marginBottom: '16px' }}>
      <Icon name={name} />
    </div>
  );
}