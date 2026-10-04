import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useRoomSession } from '../hooks/useRoomSession';
import { SyncPlayer } from '../components/room/SyncPlayer';
import { Chat } from '../components/room/Chat';
import { People } from '../components/room/People';
import { FloatingLayer, ReactionBar, useFloatingReactions } from '../components/room/Reactions';
import { SettingsModal, ShareModal } from '../components/room/Modals';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { Icon } from '../components/ui/Icon';
import { Logo } from '../components/ui/Logo';
import { Skeleton } from '../components/ui/Feedback';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api, errMsg } from '../lib/api';
import { copyText } from '../lib/clipboard';
import { extractVideoId } from '../lib/youtube';
import type { Participant } from '../lib/types';

// --- ULTRA-PRO MAX ROOM STYLES ---
const roomStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap');

  :root {
    --rm-bg: #030712;
    --rm-card: rgba(15, 23, 42, 0.7);
    --rm-border: rgba(255, 255, 255, 0.08);
    --rm-border-active: rgba(129, 140, 248, 0.4);
    
    --rm-text: #f8fafc;
    --rm-muted: #94a3b8;
    
    --rm-accent: #6366f1;
    --rm-accent-teal: #10b981;
    --rm-accent-rose: #f43f5e;
    
    --rm-grad-primary: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    --rm-font-head: 'Space Grotesk', system-ui, sans-serif;
    --rm-font-body: 'Plus Jakarta Sans', system-ui, sans-serif;
  }

  .rm-page {
    font-family: var(--rm-font-body);
    color: var(--rm-text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 40px;
  }

  .rm-center-wrapper {
    min-height: 80vh;
    display: grid;
    place-items: center;
    padding: 20px;
  }

  .rm-glass-card {
    background: var(--rm-card);
    border: 1px solid var(--rm-border);
    backdrop-filter: blur(24px);
    border-radius: 24px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  /* Header Controls */
  .rm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    gap: 16px;
    border-radius: 20px;
  }

  .rm-title-group h1 {
    font-family: var(--rm-font-head);
    font-size: 20px;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
  }

  .rm-code-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 12px;
    background: rgba(99, 102, 241, 0.12);
    border: 1px solid rgba(129, 140, 248, 0.25);
    color: #c7d2fe;
    font-family: monospace;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }
  .rm-code-badge:hover {
    background: rgba(99, 102, 241, 0.22);
    border-color: rgba(129, 140, 248, 0.45);
  }

  /* Grid Area */
  .rm-main-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 360px;
    gap: 20px;
    align-items: start;
  }

  /* Main Player Canvas */
  .rm-player-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .rm-player-wrapper {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid var(--rm-border);
    background: #000;
    box-shadow: 0 20px 40px rgba(0,0,0,0.6);
  }

  .rm-now-playing-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    gap: 20px;
  }

  /* Video Loader Input */
  .rm-load-form {
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .rm-input-row {
    display: flex;
    gap: 12px;
  }
  .rm-input-field {
    flex: 1;
    height: 46px;
    padding: 0 16px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--rm-border);
    color: #fff;
    font-size: 14px;
    transition: all 0.2s;
  }
  .rm-input-field:focus {
    outline: none;
    border-color: var(--rm-accent);
    background: rgba(255, 255, 255, 0.07);
  }

  /* Chat & Sidebar Tabs */
  .rm-sidebar {
    height: calc(100vh - 180px);
    min-height: 550px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .rm-tab-header {
    display: flex;
    border-bottom: 1px solid var(--rm-border);
    padding: 8px;
    gap: 8px;
    background: rgba(0, 0, 0, 0.2);
  }

  .rm-tab-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 40px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--rm-muted);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .rm-tab-btn.active {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    border: 1px solid var(--rm-border);
  }

  .rm-tab-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 1024px) {
    .rm-main-grid {
      grid-template-columns: 1fr;
    }
    .rm-sidebar {
      height: 500px;
    }
  }
`;

export default function RoomPage() {
  const { code = '' } = useParams();
  const c = code.toUpperCase();
  return <RoomInner key={c} code={c} />;
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rm-center-wrapper">
      <style>{roomStyles}</style>
      <ConnectionBanner />
      <div className="rm-glass-card" style={{ width: '100%', maxWidth: '440px', padding: '36px', textAlign: 'center' }}>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <Logo compact />
        </div>
        {children}
      </div>
    </div>
  );
}

function RoomInner({ code }: { code: string }) {
  const s = useRoomSession(code);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const floating = useFloatingReactions();
  
  const [tab, setTab] = useState<'chat' | 'people'>('chat');
  const [share, setShare] = useState(false);
  const [settings, setSettings] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoErr, setVideoErr] = useState('');
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [pw, setPw] = useState('');

  const connected = s.status === 'connected';
  const { setReactionHandler } = s;

  useEffect(() => { 
    setReactionHandler(floating.add); 
    return () => setReactionHandler(null); 
  }, [setReactionHandler, floating.add]);

  useEffect(() => { 
    document.title = s.room ? `${s.room.name} · MovieFlex` : 'Watch room · MovieFlex'; 
  }, [s.room?.name]);

  const guard = async <T,>(fn: () => Promise<T>) => { 
    try { 
      return await fn(); 
    } catch (e) { 
      toast.error(errMsg(e)); 
    } 
  };

  // ── PRE-READY STATES ─────────────────────────────────────────────────────────
  if (s.phase === 'password') {
    const submit = (e: FormEvent) => { 
      e.preventDefault(); 
      if (pw) s.submitPassword(pw); 
    };
    return (
      <CenterCard>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '8px' }}>Password Protected</h1>
        <p style={{ color: 'var(--rm-muted)', fontSize: '14px', marginBottom: '24px' }}>
          Enter password to enter room <code style={{ color: '#818cf8' }}>{code}</code>.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} noValidate>
          <input 
            className="rm-input-field" 
            type="password" 
            autoFocus 
            value={pw} 
            onChange={(e) => setPw(e.target.value)} 
            placeholder="Room Password"
          />
          {s.passwordError && <small style={{ color: 'var(--rm-accent-rose)', fontSize: '12px' }}>{s.passwordError}</small>}
          <button className="btn btn-primary" disabled={!pw} style={{ height: '46px', borderRadius: '12px', fontWeight: 700 }}>
            Join Watch Party
          </button>
          <Link to="/home" style={{ color: 'var(--rm-muted)', fontSize: '14px', textDecoration: 'none' }}>
            Back to Home
          </Link>
        </form>
      </CenterCard>
    );
  }

  if (s.phase === 'error' && s.error) {
    return (
      <CenterCard>
        <div style={{ color: 'var(--rm-accent-rose)', marginBottom: '16px' }}>
          <Icon name="alert" size={32} />
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>{s.error.title}</h1>
        <p style={{ color: 'var(--rm-muted)', fontSize: '14px', marginBottom: '24px' }}>{s.error.message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {s.error.retryable && (
            <button className="btn btn-primary" onClick={s.retry}>
              <Icon name="refresh" size={16} /> Try Again
            </button>
          )}
          <Link to="/home" className="btn btn-secondary">Home</Link>
        </div>
      </CenterCard>
    );
  }

  if (s.phase === 'joining' || !s.room) {
    return (
      <div className="rm-page" aria-busy="true">
        <style>{roomStyles}</style>
        <ConnectionBanner />
        <div style={{ padding: '20px' }}>
          <Skeleton style={{ height: 40, width: 240, borderRadius: 12 }} />
        </div>
        <div className="rm-main-grid" style={{ padding: '0 20px' }}>
          <Skeleton style={{ aspectRatio: '16/9', width: '100%', borderRadius: 20 }} />
          <Skeleton style={{ height: '500px', width: '100%', borderRadius: 20 }} />
        </div>
      </div>
    );
  }

  // ── READY STATE ──────────────────────────────────────────────────────────────
  const { room, actions, canControl, isHost } = s;

  const loadVideo = async (e: FormEvent) => {
    e.preventDefault();
    if (!extractVideoId(videoUrl)) { 
      setVideoErr('Paste a valid YouTube link or 11-character video ID.'); 
      return; 
    }
    setVideoErr(''); 
    setLoadingVideo(true);
    try { 
      await actions.changeVideo(videoUrl.trim()); 
      setVideoUrl(''); 
    } catch (err) { 
      setVideoErr(errMsg(err)); 
    } finally { 
      setLoadingVideo(false); 
    }
  };

  const leave = async () => {
    const others = s.participants.filter((p) => p.userId !== s.meId).length;
    const ok = await confirm({
      title: 'Leave this room?', 
      danger: true, 
      confirmLabel: 'Leave room',
      message: isHost && others 
        ? 'You are the host. Host control will transfer automatically to another participant.'
        : 'You will need the code to re-enter this room later.',
    });
    if (!ok) return;
    try {
      const r = connected ? await actions.leave() : await api.post<{ left: boolean }>(`/rooms/${code}/leave`);
      toast[r.left ? 'success' : 'info'](r.left ? 'You left the room' : 'Saved in My Rooms');
      navigate('/home');
    } catch (e) { 
      toast.error(errMsg(e)); 
    }
  };

  const kick = async (p: Participant) => {
    if (await confirm({ title: `Remove ${p.displayName}?`, message: 'They will be disconnected from the room.', confirmLabel: 'Remove', danger: true })) {
      await guard(() => actions.kick(p.userId));
    }
  };

  const transfer = async (p: Participant) => {
    if (await confirm({ title: `Make ${p.displayName} Host?`, message: 'Host privileges will transfer immediately.', confirmLabel: 'Transfer Host' })) {
      await guard(() => actions.transferHost(p.userId));
    }
  };

  const clearChat = async () => {
    if (await confirm({ title: 'Clear Chat?', message: 'All active chat history will be cleared.', confirmLabel: 'Clear', danger: true })) {
      await guard(() => actions.clearChat());
    }
  };

  const copyCode = async () => { 
    if (await copyText(room.code)) toast.success('Room code copied!'); 
  };

  const onlineCount = s.participants.filter((p) => p.online).length;

  return (
    <div className="rm-page">
      <style>{roomStyles}</style>
      <ConnectionBanner />

      {/* Header Bar */}
      <header className="rm-glass-card rm-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/home" className="btn btn-ghost btn-icon" aria-label="Home">
            <Icon name="back" />
          </Link>
          <div className="rm-title-group">
            <h1>{room.name}</h1>
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--rm-muted)', marginTop: '2px' }}>
              <span>{room.privacy === 'public' ? '🌐 Public' : '🔒 Private'}</span>
              <span>•</span>
              <span style={{ color: 'var(--rm-accent-teal)', fontWeight: 600 }}>● {onlineCount} Watching</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="rm-code-badge" onClick={copyCode}>
            <code>{room.code}</code>
            <Icon name="copy" size={14} />
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => setShare(true)}>
            <Icon name="share" size={15} />
            <span className="hide-sm">Invite</span>
          </button>

          {isHost && (
            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSettings(true)}>
              <Icon name="sliders" size={15} />
            </button>
          )}

          <button className="btn btn-danger-ghost btn-sm" onClick={leave}>
            <Icon name="logout" size={15} />
            <span className="hide-sm">Leave</span>
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="rm-main-grid">
        {/* Main Video Section */}
        <section className="rm-player-container">
          <div className="rm-player-wrapper">
            <SyncPlayer 
              video={s.video} 
              canControl={canControl} 
              serverNow={s.serverNow}
              onPlay={(t) => void actions.play(t).catch(() => {})} 
              onPause={(t) => void actions.pause(t).catch(() => {})}
              onSeek={(t) => void actions.seek(t).catch(() => {})} 
              onHeartbeat={(t, p) => void actions.heartbeat(t, p).catch(() => {})}
            >
              <FloatingLayer items={floating.items} />
            </SyncPlayer>
          </div>

          <div className="rm-glass-card rm-now-playing-bar">
            <div>
              <span style={{ fontSize: '11px', color: 'var(--rm-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Now Playing</span>
              <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '2px 0 0' }}>
                {s.video?.title || (s.video?.videoId ? 'YouTube Video Stream' : 'No Video Loaded Yet')}
              </h2>
            </div>
            <ReactionBar onReact={(e) => void actions.react(e).catch((err) => toast.error(errMsg(err)))} disabled={!connected} />
          </div>

          {canControl ? (
            <form className="rm-glass-card rm-load-form" onSubmit={loadVideo} noValidate>
              <div className="rm-input-row">
                <input 
                  className="rm-input-field" 
                  value={videoUrl} 
                  placeholder="Paste YouTube link or Video ID to stream..." 
                  onChange={(e) => { setVideoUrl(e.target.value); setVideoErr(''); }} 
                />
                <button className="btn btn-primary" disabled={!videoUrl.trim() || loadingVideo || !connected} style={{ padding: '0 24px', borderRadius: '12px' }}>
                  {loadingVideo ? 'Loading...' : 'Play Stream'}
                </button>
              </div>
              {videoErr && <small style={{ color: 'var(--rm-accent-rose)', fontSize: '12px' }}>{videoErr}</small>}
            </form>
          ) : (
            <div className="rm-glass-card" style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--rm-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="info" size={16} /> 
              <span>You are currently in Viewer mode. Ask the host for Moderator privileges to control video stream.</span>
            </div>
          )}
        </section>

        {/* Sidebar Panel (Chat & People) */}
        <aside className="rm-glass-card rm-sidebar">
          <div className="rm-tab-header">
            <button className={`rm-tab-btn ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
              <Icon name="message" size={15} /> Chat
            </button>
            <button className={`rm-tab-btn ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}>
              <Icon name="users" size={15} /> People ({onlineCount})
            </button>
          </div>

          <div className="rm-tab-content">
            {tab === 'chat' ? (
              <Chat 
                messages={s.messages} 
                meId={s.meId} 
                myRole={s.myRole} 
                connected={connected} 
                onSend={actions.sendChat} 
                onDelete={(id) => void guard(() => actions.deleteMessage(id))} 
                onClear={clearChat} 
              />
            ) : (
              <People 
                participants={s.participants} 
                meId={s.meId} 
                myRole={s.myRole} 
                onKick={kick} 
                onTransfer={transfer} 
                onRole={(p, role) => void guard(() => actions.setRole(p.userId, role))} 
              />
            )}
          </div>
        </aside>
      </div>

      {share && <ShareModal code={room.code} name={room.name} onClose={() => setShare(false)} />}
      {settings && <SettingsModal code={room.code} room={room} onClose={() => setSettings(false)} onDeleted={() => navigate('/home')} />}
    </div>
  );
}