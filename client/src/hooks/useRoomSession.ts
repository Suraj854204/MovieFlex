import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import type { ChatMessage, Participant, Role, RoomSettings, VideoPayload } from '../lib/types';

export type Phase = 'joining' | 'password' | 'ready' | 'error';
export interface RoomError { code: string; title: string; message: string; retryable: boolean }
export interface Reaction { id: string; emoji: string; userId: string; displayName: string }

interface Snapshot {
  room: RoomSettings & { code: string; id: string; createdAt: string };
  you: { userId: string; role: Role };
  participants: Participant[]; video: VideoPayload; messages: ChatMessage[];
}

const ERRORS: Record<string, Omit<RoomError, 'code'>> = {
  ROOM_NOT_FOUND: { title: 'Room not found', message: 'This room does not exist, or it was deleted. Check the code and try again.', retryable: false },
  ROOM_FULL: { title: 'This room is full', message: 'The room has reached its participant limit. Try again in a moment.', retryable: true },
  ROOM_LOCKED: { title: 'Room is locked', message: 'The host has locked this room, so new people cannot join right now.', retryable: true },
  BANNED: { title: 'You were removed', message: 'The host removed you from this room, so you cannot rejoin.', retryable: false },
  NETWORK: { title: "Can't connect", message: "We couldn't reach the server. Check your connection and try again.", retryable: true },
};

/** All realtime state for one room. Listeners are registered once per socket and cleaned up on unmount. */
export function useRoomSession(code: string) {
  const { socket, status, request, serverNow } = useSocket();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>('joining');
  const [error, setError] = useState<RoomError | null>(null);
  const [passwordError, setPasswordError] = useState('');
  const [room, setRoom] = useState<(RoomSettings & { code: string; id: string; createdAt: string }) | null>(null);
  const [myRole, setMyRole] = useState<Role>('member');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [video, setVideo] = useState<VideoPayload | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const restJoined = useRef(false);
  const password = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const revRef = useRef(0);
  const reactionCb = useRef<((r: Reaction) => void) | null>(null);
  const meId = user?.id ?? '';

  const fail = useCallback((e: unknown) => {
    const code = e instanceof ApiError ? e.code : 'NETWORK';
    if (code === 'PASSWORD_REQUIRED' || code === 'INVALID_PASSWORD') {
      setPasswordError(code === 'INVALID_PASSWORD' ? 'Incorrect password. Try again.' : '');
      setPhase('password'); return;
    }
    const known = ERRORS[code];
    setError({ code, ...(known ?? { title: 'Something went wrong', message: e instanceof ApiError ? e.message : 'Please try again.', retryable: true }) });
    setPhase('error');
  }, []);

  const attach = useCallback(async () => {
    const my = ++generation.current;
    try {
      if (!restJoined.current) {
        await api.post(`/rooms/${code}/join`, { password: password.current });
        restJoined.current = true;
      }
      const snap = await request<Snapshot>('room:join', { code });
      if (my !== generation.current) return;
      setRoom(snap.room); setMyRole(snap.you.role); setParticipants(snap.participants);
      setVideo(snap.video); revRef.current = snap.video.rev; setMessages(snap.messages);
      setError(null); setPhase('ready');
    } catch (e) { if (my === generation.current) fail(e); }
  }, [code, request, fail]);

  // Join (and re-join after every reconnect, which restores state from the server).
  useEffect(() => {
    if (status === 'connected') void attach();
    else if (status === 'offline' && phase === 'joining') setPhase('joining');
  }, [status, attach]);                                // eslint-disable-line react-hooks/exhaustive-deps

  // Detach (keep membership) when leaving the page.
  useEffect(() => () => { generation.current++; if (socket?.connected) socket.emit('room:detach', {}); }, [socket]);

  useEffect(() => {
    if (!socket) return;
    const onPresence = ({ participants: p }: { participants: Participant[] }) => {
      setParticipants(p);
      const me = p.find((x) => x.userId === meId); if (me) setMyRole(me.role);
    };
    const onVideo = (v: VideoPayload) => { revRef.current = v.rev; setVideo(v); };
    const onMessage = (m: ChatMessage) => setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m].slice(-200)));
    const onDeleted = ({ id }: { id: string }) => setMessages((l) => l.filter((m) => m.id !== id));
    const onCleared = () => setMessages([]);
    const onReaction = (r: Reaction) => reactionCb.current?.(r);
    const onUpdated = (s: RoomSettings) => setRoom((r) => (r ? { ...r, ...s } : r));
    const onRole = ({ role }: { role: Role }) => setMyRole(role);
    const onRemoved = () => { setError({ code: 'REMOVED', title: 'You were removed', message: 'The host or a moderator removed you from this room.', retryable: false }); setPhase('error'); };
    const onClosed = () => { setError({ code: 'CLOSED', title: 'Room closed', message: 'The host deleted this room.', retryable: false }); setPhase('error'); };

    socket.on('presence:update', onPresence); socket.on('video:state', onVideo); socket.on('chat:message', onMessage);
    socket.on('chat:deleted', onDeleted); socket.on('chat:cleared', onCleared); socket.on('reaction', onReaction);
    socket.on('room:updated', onUpdated); socket.on('role:changed', onRole); socket.on('room:removed', onRemoved); socket.on('room:closed', onClosed);
    return () => {
      socket.off('presence:update', onPresence); socket.off('video:state', onVideo); socket.off('chat:message', onMessage);
      socket.off('chat:deleted', onDeleted); socket.off('chat:cleared', onCleared); socket.off('reaction', onReaction);
      socket.off('room:updated', onUpdated); socket.off('role:changed', onRole); socket.off('room:removed', onRemoved); socket.off('room:closed', onClosed);
    };
  }, [socket, meId]);

  const submitPassword = useCallback((pw: string) => {
    password.current = pw; restJoined.current = false; setPasswordError(''); setPhase('joining'); void attach();
  }, [attach]);

  const retry = useCallback(() => { restJoined.current = false; setPhase('joining'); setError(null); void attach(); }, [attach]);

  const trackRev = (p: VideoPayload) => { revRef.current = p.rev; return p; };

  const actions = useMemo(() => ({
    play: (time: number) => request<VideoPayload>('video:play', { time }).then(trackRev),
    pause: (time: number) => request<VideoPayload>('video:pause', { time }).then(trackRev),
    seek: (time: number) => request<VideoPayload>('video:seek', { time }).then(trackRev),
    heartbeat: (time: number, playing: boolean) => request('video:heartbeat', { rev: revRef.current, time, playing }),
    changeVideo: (url: string) => request<VideoPayload>('video:change', { url }),
    sendChat: (text: string) => request('chat:send', { text }),
    deleteMessage: (id: string) => request('chat:delete', { id }),
    clearChat: () => request('chat:clear'),
    react: (emoji: string) => request('reaction:send', { emoji }),
    setRole: (userId: string, role: 'moderator' | 'member') => request('mod:role', { userId, role }),
    transferHost: (userId: string) => request('mod:transfer', { userId }),
    kick: (userId: string) => request('mod:kick', { userId }),
    leave: () => request<{ left: boolean }>('room:leave'),
  }), [request]);

  return {
    phase, error, passwordError, room, myRole, meId, participants, video, messages, status, serverNow,
    canControl: myRole === 'host' || myRole === 'moderator', isHost: myRole === 'host',
    submitPassword, retry, actions,
    setReactionHandler: (fn: ((r: Reaction) => void) | null) => { reactionCb.current = fn; },
  };
}
