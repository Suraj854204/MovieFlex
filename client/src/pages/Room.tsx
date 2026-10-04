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

export default function RoomPage() {
  const { code = '' } = useParams();
  const c = code.toUpperCase();
  return <RoomInner key={c} code={c} />;
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return <div className="room-center"><ConnectionBanner /><div className="card pad center-card"><Logo compact />{children}</div></div>;
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

  useEffect(() => { setReactionHandler(floating.add); return () => setReactionHandler(null); }, [setReactionHandler, floating.add]);
  useEffect(() => { document.title = s.room ? `${s.room.name} · MovieFlex` : 'Watch room · MovieFlex'; }, [s.room?.name]);   // eslint-disable-line react-hooks/exhaustive-deps

  const guard = async <T,>(fn: () => Promise<T>) => { try { return await fn(); } catch (e) { toast.error(errMsg(e)); } };

  // ── pre-ready states ─────────────────────────────────────────────────────────
  if (s.phase === 'password') {
    const submit = (e: FormEvent) => { e.preventDefault(); if (pw) s.submitPassword(pw); };
    return (
      <CenterCard>
        <h1>This room is password protected</h1>
        <p className="muted-2">Ask the host for the password to join room <code>{code}</code>.</p>
        <form onSubmit={submit} className="stack" noValidate>
          <label className="field"><span>Password</span><input className="input" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!s.passwordError} />
            {s.passwordError && <small className="field-error" role="alert">{s.passwordError}</small>}</label>
          <button className="btn btn-primary btn-block" disabled={!pw}>Join room</button>
          <Link to="/home" className="btn btn-ghost btn-block">Back to home</Link>
        </form>
      </CenterCard>
    );
  }
  if (s.phase === 'error' && s.error) {
    return (
      <CenterCard>
        <span className="empty-icon danger"><Icon name="alert" size={26} /></span>
        <h1>{s.error.title}</h1><p className="muted-2">{s.error.message}</p>
        <div className="row gap-8 wrap center-row">
          {s.error.retryable && <button className="btn btn-primary" onClick={s.retry}><Icon name="refresh" size={16} /> Try again</button>}
          <Link to="/home" className="btn btn-secondary">Back to home</Link>
          <Link to="/discover" className="btn btn-ghost">Browse Discover</Link>
        </div>
      </CenterCard>
    );
  }
  if (s.phase === 'joining' || !s.room) {
    return (
      <div className="room-page" aria-busy="true">
        <ConnectionBanner />
        <div className="room-head"><Skeleton style={{ height: 32, width: 220 }} /></div>
        <div className="room-grid"><div className="room-main"><Skeleton style={{ aspectRatio: '16/9', width: '100%' }} /></div><div className="room-side"><Skeleton style={{ height: '100%', minHeight: 300 }} /></div></div>
        <p className="center muted" role="status">{connected ? 'Joining room…' : 'Connecting…'}</p>
      </div>
    );
  }

  // ── ready ────────────────────────────────────────────────────────────────────
  const { room, actions, canControl, isHost } = s;

  const loadVideo = async (e: FormEvent) => {
    e.preventDefault();
    if (!extractVideoId(videoUrl)) { setVideoErr('Paste a valid YouTube link or 11-character video ID.'); return; }
    setVideoErr(''); setLoadingVideo(true);
    try { await actions.changeVideo(videoUrl.trim()); setVideoUrl(''); }
    catch (err) { setVideoErr(errMsg(err)); } finally { setLoadingVideo(false); }
  };

  const leave = async () => {
    const others = s.participants.filter((p) => p.userId !== s.meId).length;
    const ok = await confirm({
      title: 'Leave this room?', danger: true, confirmLabel: 'Leave room',
      message: isHost && others ? 'You are the host. The host role will pass to another member, and you will need the code to join again.'
        : isHost ? 'You are the only member, so the room stays in My Rooms. You can come back any time.' : 'You will need the room code (or a public listing) to join again.',
    });
    if (!ok) return;
    try {
      const r = connected ? await actions.leave() : await api.post<{ left: boolean }>(`/rooms/${code}/leave`);
      toast[r.left ? 'success' : 'info'](r.left ? 'You left the room' : 'The room stays in your list');
      navigate('/home');
    } catch (e) { toast.error(errMsg(e)); }
  };

  const kick = async (p: Participant) => {
    if (await confirm({ title: `Remove ${p.displayName}?`, message: 'They will be disconnected and cannot rejoin this room.', confirmLabel: 'Remove', danger: true })) await guard(() => actions.kick(p.userId));
  };
  const transfer = async (p: Participant) => {
    if (await confirm({ title: `Make ${p.displayName} the host?`, message: 'They will control the room and settings. You will become a moderator.', confirmLabel: 'Transfer host' })) await guard(() => actions.transferHost(p.userId));
  };
  const clearChat = async () => {
    if (await confirm({ title: 'Clear the chat?', message: 'All messages are removed for everyone.', confirmLabel: 'Clear chat', danger: true })) await guard(() => actions.clearChat());
  };
  const copyCode = async () => { if (await copyText(room.code)) toast.success('Room code copied'); else toast.error('Could not copy the code'); };

  const online = s.participants.filter((p) => p.online).length;

  return (
    <div className="room-page">
      <ConnectionBanner />
      <header className="room-head">
        <Link to="/home" className="btn btn-ghost btn-icon" aria-label="Back to home"><Icon name="back" /></Link>
        <div className="room-title min0">
          <h1 className="line-1">{room.name}</h1>
          <span className="muted row gap-6 wrap">
            <span className="row gap-6"><Icon name={room.privacy === 'public' ? 'globe' : 'lock'} size={13} /> {room.privacy === 'public' ? 'Public' : 'Private'}{room.locked ? ' · Locked' : ''}</span>
            <span className="row gap-6"><span className="dot live-dot" /> {online} watching</span>
          </span>
        </div>
        <button className="code-chip" onClick={copyCode} aria-label={`Room code ${room.code}. Click to copy`}><code>{room.code}</code><Icon name="copy" size={14} /></button>
        <div className="room-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShare(true)}><Icon name="share" size={15} /> <span className="hide-sm">Invite</span></button>
          {isHost && <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setSettings(true)} aria-label="Room settings"><Icon name="sliders" size={15} /></button>}
          <button className="btn btn-danger-ghost btn-sm" onClick={leave}><Icon name="logout" size={15} /> <span className="hide-sm">Leave</span></button>
        </div>
      </header>

      <div className="room-grid">
        <section className="room-main" aria-label="Video">
          <SyncPlayer video={s.video} canControl={canControl} serverNow={s.serverNow}
            onPlay={(t) => void actions.play(t).catch(() => {})} onPause={(t) => void actions.pause(t).catch(() => {})}
            onSeek={(t) => void actions.seek(t).catch(() => {})} onHeartbeat={(t, p) => void actions.heartbeat(t, p).catch(() => {})}>
            <FloatingLayer items={floating.items} />
          </SyncPlayer>

          <div className="now-playing">
            <div className="min0"><span className="muted">Now playing</span><h2 className="line-2">{s.video?.title || (s.video?.videoId ? 'YouTube video' : 'Nothing yet')}</h2></div>
            <ReactionBar onReact={(e) => void actions.react(e).catch((err) => toast.error(errMsg(err)))} disabled={!connected} />
          </div>

          {canControl ? (
            <form className="load-video" onSubmit={loadVideo} noValidate>
              <div className="join-row">
                <div className="input-icon"><Icon name="link" size={16} /><input className="input" value={videoUrl} aria-label="YouTube link" placeholder="Paste a YouTube link to play for everyone" onChange={(e) => { setVideoUrl(e.target.value); setVideoErr(''); }} aria-invalid={!!videoErr} /></div>
                <button className="btn btn-primary" disabled={!videoUrl.trim() || loadingVideo || !connected}>{loadingVideo ? 'Loading…' : 'Play'}</button>
              </div>
              {videoErr && <small className="field-error" role="alert">{videoErr}</small>}
              <small className="muted">Use the player controls to play, pause and seek for everyone.</small>
            </form>
          ) : <p className="muted viewer-note"><Icon name="info" size={14} /> You can chat and react. Ask the host for moderator rights to control the video.</p>}
        </section>

        <aside className="room-side" aria-label="Chat and people">
          <div className="tabs" role="tablist">
            <button role="tab" id="tab-chat" aria-selected={tab === 'chat'} aria-controls="panel-chat" className={`tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}><Icon name="message" size={15} /> Chat</button>
            <button role="tab" id="tab-people" aria-selected={tab === 'people'} aria-controls="panel-people" className={`tab ${tab === 'people' ? 'active' : ''}`} onClick={() => setTab('people')}><Icon name="users" size={15} /> People <span className="count-pill">{online}</span></button>
          </div>
          <div className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'chat'
              ? <Chat messages={s.messages} meId={s.meId} myRole={s.myRole} connected={connected} onSend={actions.sendChat} onDelete={(id) => void guard(() => actions.deleteMessage(id))} onClear={clearChat} />
              : <People participants={s.participants} meId={s.meId} myRole={s.myRole} onKick={kick} onTransfer={transfer} onRole={(p, role) => void guard(() => actions.setRole(p.userId, role))} />}
          </div>
        </aside>
      </div>

      {share && <ShareModal code={room.code} name={room.name} onClose={() => setShare(false)} />}
      {settings && <SettingsModal code={room.code} room={room} onClose={() => setSettings(false)} onDeleted={() => navigate('/home')} />}
    </div>
  );
}
