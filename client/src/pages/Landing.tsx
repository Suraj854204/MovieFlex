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
  }

  .mf-ultra-root, .mf-ultra-root * { box-sizing: border-box; }
  .mf-ultra-root {
    width: 100%;
    min-height: 100vh;
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
  }

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
  }
  .mf-ultra-root h2 {
    font-size: clamp(30px, 4.2vw, 52px);
    letter-spacing: -0.04em;
    line-height: 1.04;
  }
  .mf-ultra-root h3 { letter-spacing: -0.02em; }
  .mf-ultra-root p { text-wrap: pretty; }
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
    padding: 0 clamp(20px, 4vw, 48px);
  }

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
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: space-between;
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
  }
  .mf-nav-links a:hover {
    color: var(--text-primary);
    background: rgba(255, 255, 255, 0.08);
  }

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
  }
  .mf-btn-glass:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    transform: translateY(-2px);
  }

  .mf-hero-section {
    padding: clamp(60px, 8vw, 110px) 0 40px;
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
  }
  .mf-hero-title {
    font-size: clamp(42px, 7vw, 88px);
    font-weight: 800;
    max-width: 16ch;
    margin: 0 auto 26px;
    letter-spacing: -0.05em;
    line-height: 1.02;
  }
  .mf-hero-desc {
    font-size: clamp(17px, 1.8vw, 21px);
    color: var(--text-secondary);
    max-width: 58ch;
    margin: 0 auto 40px;
    line-height: 1.65;
    font-weight: 500;
    letter-spacing: -0.005em;
  }

  .mf-stats-container {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    margin-top: 60px;
    padding: 24px 32px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(20px);
  }
  .mf-stat-box b {
    display: block;
    font-size: clamp(24px, 3vw, 38px);
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

  .mf-app-frame-wrap {
    margin-top: clamp(60px, 8vw, 100px);
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
    border-radius: 28px;
    background: var(--bg-card);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(30px);
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
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .mf-player-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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
  }
  .mf-sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-teal);
    box-shadow: 0 0 12px var(--accent-teal);
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
  }
  .mf-play-center-btn {
    position: absolute;
    z-index: 10;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.4);
    backdrop-filter: blur(16px);
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    display: grid;
    place-items: center;
  }
  .mf-play-center-btn:hover {
    transform: scale(1.12);
    background: rgba(255, 255, 255, 0.35);
  }

  .mf-app-chat {
    padding: 24px 20px;
    border-left: 1px solid var(--glass-border);
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
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
  }
  .mf-chat-bubble {
    display: flex;
    gap: 10px;
    font-size: 13px;
    line-height: 1.5;
  }

  .mf-bento-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 20px;
    margin-top: 60px;
  }
  .mf-bento-card {
    position: relative;
    border-radius: 24px;
    padding: 32px;
    background: var(--bg-card);
    border: 1px solid var(--glass-border);
    backdrop-filter: blur(20px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  .mf-bento-card:hover {
    border-color: var(--glass-border-bright);
    transform: translateY(-4px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
  }
  .mf-col-4 { grid-column: span 4; }
  .mf-col-2 { grid-column: span 2; }
  .mf-col-3 { grid-column: span 3; }

  .mf-device-bar {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 40px;
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
  }
  .mf-device-tab.active {
    background: var(--grad-primary);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.4);
  }

  .mf-faq-grid {
    display: grid;
    grid-template-columns: 0.8fr 1.2fr;
    gap: 60px;
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
    padding: 24px 0;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-family: var(--font-heading);
    font-size: 18px;
    font-weight: 700;
    text-align: left;
    cursor: pointer;
  }

  @media (max-width: 1080px) {
    .mf-app-frame { grid-template-columns: 1fr; }
    .mf-app-sidebar { display: none; }
    .mf-col-4, .mf-col-3, .mf-col-2 { grid-column: span 6; }
    .mf-stats-container { grid-template-columns: repeat(2, 1fr); }
    .mf-faq-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 640px) {
    .mf-stats-container { grid-template-columns: 1fr; }
    .mf-nav-links { display: none; }
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

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Link to="/login" style={{ fontSize: '14px', fontWeight: 700, color: '#fff', padding: '0 12px' }}>Log In</Link>
              <Link to="/signup" className="mf-btn-ultra mf-btn-primary-glow" style={{ height: '44px', padding: '0 20px', borderRadius: '10px' }}>Get Started</Link>
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

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                  <button type="button" className="mf-play-center-btn" onClick={() => setPlaying(!playing)}>
                    {playing ? '❚❚' : '▶'}
                  </button>
                  
                  <div className="mf-video-overlay-title">
                    <b style={{ fontSize: '28px', display: 'block' }}>Interstellar Ultra 4K</b>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <span className="mf-mono">{fmtTime(time)}</span>
                    <input 
                      type="range" 
                      min={0} 
                      max={TOTAL_DURATION} 
                      value={time} 
                      onChange={(e) => setTime(Number(e.target.value))}
                      style={{ flex: 1, accentColor: '#6366f1', cursor: 'pointer' }} 
                    />
                    <span className="mf-mono">{fmtTime(TOTAL_DURATION)}</span>
                  </div>

                  {/* Reaction Toolbar */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                    {REACTIONS.map((r) => (
                      <button 
                        key={r} 
                        type="button" 
                        onClick={() => triggerReaction(r)}
                        style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', cursor: 'pointer', fontSize: '16px' }}
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

                <form onSubmit={handleSendMessage} style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={draft} 
                    onChange={(e) => setDraft(e.target.value)} 
                    placeholder="Type message..." 
                    style={{ flex: 1, height: '40px', padding: '0 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', color: '#fff', fontSize: '13px' }} 
                  />
                  <button type="submit" style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--accent-violet)', border: 'none', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>↑</button>
                </form>
              </aside>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section id="features" style={{ padding: '80px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <span className="mf-pill-tag">Ultra Features</span>
            <h2>Designed for lossless shared moments.</h2>
          </div>

          <div className="mf-bento-grid">
            <article className="mf-bento-card mf-col-4">
              {icon('sync')}
              <h3>Sub-12ms Multi-Threaded Sync</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                Frame-accurate synchronization prevents spoilers and drift, snapping lagging clients smoothly back in timeline.
              </p>
              
              <div style={{ marginTop: '24px' }}>
                {FRIENDS.map((f, i) => (
                  <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                    <span style={{ fontSize: '13px', width: '50px' }}>{f.name}</span>
                    <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${lag && i === 2 ? progressPercent - 12 : progressPercent}%`, background: 'var(--grad-primary)', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
                <button type="button" className="mf-btn-ultra mf-btn-glass" style={{ height: '36px', padding: '0 16px', fontSize: '12px', marginTop: '16px' }} onClick={() => setLag(!lag)}>
                  {lag ? 'Resync Maya' : 'Simulate Network Lag'}
                </button>
              </div>
            </article>

            <article className="mf-bento-card mf-col-2">
              {icon('shield')}
              <h3>Encrypted Rooms</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>End-to-end access permissions keep unauthorized users out.</p>
              <div style={{ marginTop: '20px' }}>
                <button type="button" className="mf-btn-ultra mf-btn-glass" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => setPriv(!priv)}>
                  <span>{priv ? 'Invite-Only Access' : 'Open Link Access'}</span>
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: priv ? 'var(--accent-teal)' : 'var(--accent-rose)' }} />
                </button>
              </div>
            </article>

            <article className="mf-bento-card mf-col-3">
              {icon('compass')}
              <h3>Genre Discovery Engine</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Vote on genres in real-time to decide room playlist.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                {GENRES.map((g) => (
                  <button 
                    key={g} 
                    type="button" 
                    onClick={() => setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g])}
                    style={{ padding: '6px 14px', borderRadius: '99px', border: '1px solid var(--glass-border)', background: genres.includes(g) ? 'var(--accent-violet)' : 'rgba(255,255,255,0.03)', color: '#fff', cursor: 'pointer', fontSize: '12px' }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </article>

            <article className="mf-bento-card mf-col-3">
              {icon('message')}
              <h3>Spatial Audio Reactions</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Drop instant audio triggers without muting main playback channel.</p>
            </article>
          </div>
        </section>

        {/* Device Switcher How It Works */}
        <section id="how-it-works" style={{ padding: '80px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'center' }}>
            <div>
              {STEPS.map((s, i) => (
                <div 
                  key={s.title} 
                  onClick={() => setTab(i)}
                  style={{ padding: '20px', borderRadius: '16px', background: tab === i ? 'rgba(255,255,255,0.05)' : 'transparent', border: '1px solid', borderColor: tab === i ? 'var(--glass-border)' : 'transparent', cursor: 'pointer', marginBottom: '12px' }}
                >
                  <h3 style={{ fontSize: '18px' }}>{i + 1}. {s.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>{s.text}</p>
                </div>
              ))}
            </div>

            <div style={{ padding: '40px', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--glass-border)', minHeight: '280px', display: 'grid', placeItems: 'center' }}>
              <StepPreview tab={tab} device={device} />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" style={{ padding: '80px 0' }}>
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
                    <span>{faqOpen === i ? '−' : '+'}</span>
                  </button>
                  {faqOpen === i && (
                    <p style={{ paddingBottom: '24px', color: 'var(--text-secondary)', fontSize: '15px' }}>{f.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section style={{ padding: '80px 0 120px', textAlign: 'center' }}>
          <div style={{ padding: '60px 40px', borderRadius: '32px', background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.25) 0%, rgba(3,5,12,1) 100%)', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(36px, 5vw, 64px)', marginBottom: '20px' }}>Ready for your next movie night?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '18px', marginBottom: '32px' }}>Spin up a private room in under 10 seconds.</p>
            <Link to="/signup" className="mf-btn-ultra mf-btn-primary-glow">Start Party Free</Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--glass-border)', padding: '40px 0', fontSize: '14px', color: 'var(--text-muted)' }}>
        <div className="mf-container" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <Logo />
          <div>© {new Date().getFullYear()} MovieFlex Ultra. All rights reserved.</div>
        </div>
      </footer>

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', padding: '14px 24px', borderRadius: '12px', background: '#fff', color: '#000', fontWeight: 700, boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 1000 }}>
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
      <div style={{ width: 252, margin: '0 auto', padding: 8, borderRadius: 36, background: '#0b0f1c', border: '2px solid rgba(255,255,255,0.14)', boxShadow: shadow }}>
        <div style={{ width: 64, height: 6, borderRadius: 9, background: 'rgba(255,255,255,0.18)', margin: '2px auto 8px' }} />
        <div style={{ borderRadius: 26, background: '#070a14', padding: 12, minHeight: 330, overflow: 'hidden' }}>{children}</div>
      </div>
    );
  }
  if (device === 'tv') {
    return (
      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <div style={{ padding: 8, borderRadius: 14, background: '#0b0f1c', border: '2px solid rgba(255,255,255,0.14)', boxShadow: shadow }}>
          <div style={{ borderRadius: 8, background: '#070a14', padding: 18, minHeight: 300, overflow: 'hidden' }}>{children}</div>
        </div>
        <div style={{ width: 110, height: 8, margin: '0 auto', background: 'rgba(255,255,255,0.14)', borderRadius: '0 0 10px 10px' }} />
      </div>
    );
  }
  return (
    <div style={{ width: '100%', maxWidth: 470, margin: '0 auto', borderRadius: 14, background: '#070a14', border: '1px solid rgba(255,255,255,0.12)', boxShadow: shadow, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
        {['#f87171', '#fbbf24', '#34d399'].map((c) => <span key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
        <span style={{ flex: 1, marginLeft: 8, padding: '4px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>movieflex / room / K7P4QX</span>
      </div>
      <div style={{ padding: 18, minHeight: 300 }}>{children}</div>
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