import { useEffect, useRef, useState } from 'react';
import { Icon } from '../ui/Icon';
import { loadYouTubeApi } from '../../lib/ytApi';
import { targetTime } from '../../lib/format';
import type { VideoPayload } from '../../lib/types';

const YT_PLAYING = 1, YT_PAUSED = 2, YT_BUFFERING = 3;
const ERROR_TEXT: Record<number, string> = {
  2: 'This video link looks invalid.',
  5: 'The player hit an error loading this video.',
  100: 'This video was removed or is private.',
  101: 'The owner of this video does not allow it to be played here.',
  150: 'The owner of this video does not allow it to be played here.',
};

interface Props {
  video: VideoPayload | null;
  canControl: boolean;
  serverNow: () => number;
  onPlay: (t: number) => void; onPause: (t: number) => void; onSeek: (t: number) => void;
  onHeartbeat: (t: number, playing: boolean) => void;
  children?: React.ReactNode;       // overlay slot (floating reactions)
}

/**
 * Keeps one YouTube player in step with the room's authoritative playback clock.
 *
 * Feedback-loop protection: whenever *we* drive the player (play/pause/seek/load) we
 * record the state we expect YouTube to report back (`expected`) or open a short
 * suppression window; matching onStateChange events are swallowed so remote changes
 * are never re-broadcast. Only genuine local user actions reach the server.
 */
export function SyncPlayer({ video, canControl, serverNow, onPlay, onPause, onSeek, onHeartbeat, children }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const readyRef = useRef(false);
  const expected = useRef<{ state: number; until: number } | null>(null);
  const suppressUntil = useRef(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [videoError, setVideoError] = useState('');
  const [needsTap, setNeedsTap] = useState(false);
  const [muted, setMuted] = useState(false);

  const latest = useRef({ video, canControl, serverNow, onPlay, onPause, onSeek, onHeartbeat });
  latest.current = { video, canControl, serverNow, onPlay, onPause, onSeek, onHeartbeat };

  const apply = (tolerance: number) => {
    const p = playerRef.current; const v = latest.current.video;
    if (!p || !readyRef.current || !v?.videoId) return;
    const now = Date.now();
    const target = targetTime(v, latest.current.serverNow());
    const loaded = p.getVideoData?.()?.video_id;
    if (loaded !== v.videoId) {
      suppressUntil.current = now + 2500; setVideoError('');
      if (v.playing) { expected.current = { state: YT_PLAYING, until: now + 8000 }; p.loadVideoById({ videoId: v.videoId, startSeconds: target }); armTapCheck(); }
      else p.cueVideoById({ videoId: v.videoId, startSeconds: target });
      return;
    }
    const ps = p.getPlayerState?.();
    const cur = p.getCurrentTime?.() ?? 0;
    if (Math.abs(cur - target) > tolerance) { suppressUntil.current = now + 1500; p.seekTo(target, true); }
    if (v.playing && ps !== YT_PLAYING && ps !== YT_BUFFERING) { expected.current = { state: YT_PLAYING, until: now + 3000 }; p.playVideo(); armTapCheck(); }
    else if (!v.playing && (ps === YT_PLAYING || ps === YT_BUFFERING)) { expected.current = { state: YT_PAUSED, until: now + 3000 }; p.pauseVideo(); }
  };

  // If the browser blocks autoplay, ask for one tap instead of silently staying paused.
  // Scrub-detection baseline; also refreshed on every state change so a seek right after pause/play isn't missed.
  const baseline = useRef<{ t: number; pos: number; ps: number } | null>(null);
  const tapTimer = useRef<number | undefined>(undefined);
  const armTapCheck = () => {
    window.clearTimeout(tapTimer.current);
    tapTimer.current = window.setTimeout(() => {
      const p = playerRef.current;
      if (p && latest.current.video?.playing && p.getPlayerState?.() !== YT_PLAYING && p.getPlayerState?.() !== YT_BUFFERING) setNeedsTap(true);
    }, 2500);
  };

  // ── create the player (recreated if the controls mode changes) ───────────────
  useEffect(() => {
    let cancelled = false;
    readyRef.current = false; setReady(false); setLoadFailed(false);
    loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      const el = document.createElement('div');
      mountRef.current.appendChild(el);
      playerRef.current = new YT.Player(el, {
        width: '100%', height: '100%',
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1, controls: canControl ? 1 : 0, disablekb: canControl ? 0 : 1, fs: canControl ? 1 : 0, origin: window.location.origin },
        events: {
          onReady: () => { readyRef.current = true; setReady(true); apply(0.4); },
          onStateChange: (e: { data: number }) => {
            const s = e.data;
            if (s === YT_PLAYING) setNeedsTap(false);
            if (s === YT_PLAYING || s === YT_PAUSED) baseline.current = { t: Date.now(), pos: playerRef.current?.getCurrentTime?.() ?? 0, ps: s }; else baseline.current = null;
            const exp = expected.current;
            if (exp && Date.now() < exp.until && s === exp.state) { expected.current = null; return; }   // our own command echoing back
            if (!latest.current.canControl) return;
            const t = playerRef.current?.getCurrentTime?.() ?? 0;
            if (s === YT_PLAYING) latest.current.onPlay(t);
            else if (s === YT_PAUSED) latest.current.onPause(t);
          },
          onError: (e: { data: number }) => setVideoError(ERROR_TEXT[e.data] ?? 'This video cannot be played.'),
        },
      });
    }).catch(() => { if (!cancelled) setLoadFailed(true); });

    return () => {
      cancelled = true; window.clearTimeout(tapTimer.current);
      try { playerRef.current?.destroy?.(); } catch { /* already gone */ }
      playerRef.current = null; readyRef.current = false;
      if (mountRef.current) mountRef.current.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canControl, attempt]);

  // ── apply authoritative state whenever the room's video state changes ───────
  useEffect(() => { if (ready && video?.videoId) apply(video.playing ? 1.2 : 0.4); /* eslint-disable-next-line */ }, [ready, video?.rev, video?.videoId]);

  // ── viewers: periodic drift correction ─────────────────────────────────────
  useEffect(() => {
    if (!ready || canControl) return;
    const t = setInterval(() => apply(2), 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, canControl]);

  // ── controllers: detect scrubbing + report real position ───────────────────
  useEffect(() => {
    if (!ready || !canControl) return;
    const poll = setInterval(() => {
      const p = playerRef.current; if (!p) return;
      const ps = p.getPlayerState?.(); const pos = p.getCurrentTime?.() ?? 0; const now = Date.now();
      if (ps !== YT_PLAYING && ps !== YT_PAUSED) { baseline.current = null; return; }
      const last = baseline.current;        // buffering/cued: reset baseline
      if (last && last.ps === ps && now > suppressUntil.current) {
        const expectedPos = ps === YT_PLAYING ? last.pos + (now - last.t) / 1000 : last.pos;
        if (Math.abs(pos - expectedPos) > 1.8) latest.current.onSeek(pos);
      }
      baseline.current = { t: now, pos, ps };
    }, 500);
    const beat = setInterval(() => {
      const p = playerRef.current; const ps = p?.getPlayerState?.();
      if (p && (ps === YT_PLAYING || ps === YT_PAUSED)) latest.current.onHeartbeat(p.getCurrentTime?.() ?? 0, ps === YT_PLAYING);
    }, 8000);
    return () => { clearInterval(poll); clearInterval(beat); };
  }, [ready, canControl]);

  const hasVideo = !!video?.videoId;
  const toggleMute = () => { const p = playerRef.current; if (!p) return; if (p.isMuted()) { p.unMute(); setMuted(false); } else { p.mute(); setMuted(true); } };
  const fullscreen = () => { const el = wrapRef.current; if (!el) return; if (document.fullscreenElement) void document.exitFullscreen(); else void el.requestFullscreen?.().catch(() => {}); };
  const tap = () => { setNeedsTap(false); playerRef.current?.unMute?.(); apply(0.4); };

  return (
    <div className="player-shell">
      <div className="player-wrap" ref={wrapRef}>
        <div className="player-mount" ref={mountRef} data-testid="yt-mount" />
        {!canControl && hasVideo && !videoError && <div className="player-blocker" aria-hidden="true" />}
        {!hasVideo && !loadFailed && (
          <div className="player-overlay">
            <Icon name="film" size={40} /><h3>No video yet</h3>
            <p>{canControl ? 'Paste a YouTube link below to start watching together.' : 'Waiting for the host to load a video…'}</p>
          </div>
        )}
        {loadFailed && (
          <div className="player-overlay" role="alert">
            <Icon name="alert" size={36} /><h3>The video player could not load</h3>
            <p>YouTube may be blocked on this network, or you're offline.</p>
            <button className="btn btn-secondary" onClick={() => setAttempt((a) => a + 1)}><Icon name="refresh" size={16} /> Try again</button>
          </div>
        )}
        {hasVideo && videoError && (
          <div className="player-overlay" role="alert">
            <Icon name="alert" size={36} /><h3>Video unavailable</h3><p>{videoError}{canControl ? ' Load a different video to continue.' : ' The host can load a different one.'}</p>
          </div>
        )}
        {needsTap && !videoError && (
          <button className="player-overlay tap" onClick={tap}><span className="tap-btn"><Icon name="play" size={26} /></span><strong>Tap to join the playback</strong><small>Your browser blocked autoplay</small></button>
        )}
        <div className="reaction-layer" aria-hidden="true">{children}</div>
      </div>
      {!canControl && (
        <div className="player-tools">
          <span className="muted row gap-6"><Icon name="eye" size={14} /> Playback is controlled by the host and moderators</span>
          <span className="row gap-6">
            <button className="btn btn-ghost btn-sm" onClick={toggleMute} disabled={!ready}>{muted ? 'Unmute' : 'Mute'}</button>
            <button className="btn btn-ghost btn-sm" onClick={fullscreen}>Fullscreen</button>
          </span>
        </div>
      )}
    </div>
  );
}
