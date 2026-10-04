import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, ApiError, SOCKET_URL } from '../lib/api';
import { useAuth } from './AuthContext';

export type ConnStatus = 'connecting' | 'connected' | 'reconnecting' | 'offline';

interface SocketValue {
  socket: Socket | null;
  status: ConnStatus;
  /** Server clock estimate in epoch ms (corrects for client clock skew). */
  serverNow: () => number;
  /** Emit with an acknowledgement; rejects with ApiError on `{ok:false}` or timeout. */
  request: <T = any>(event: string, payload?: unknown) => Promise<T>;
}
const Ctx = createContext<SocketValue>(null as never);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, status: authStatus, logout } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const offset = useRef(0);
  const everConnected = useRef(false);
  const tokenFetchFailed = useRef(false);
  const userId = user?.id;

  useEffect(() => {
    if (authStatus !== 'authed' || !userId) return;
    everConnected.current = false;
    const s = io(SOCKET_URL || undefined, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 5000, reconnectionAttempts: Infinity,
      // Fresh signed token on every (re)connect — avoids third-party-cookie problems on Safari.
      auth: (cb) => {
        api.get<{ token: string }>('/auth/socket-token')
          .then((d) => { tokenFetchFailed.current = false; cb({ token: d.token }); })
          .catch(() => { tokenFetchFailed.current = true; cb({ token: '' }); });   // offline etc. — not the same as a rejected session
      },
    });

    const syncClock = () => {
      const t0 = Date.now();
      s.timeout(4000).emit('clock:sync', {}, (err: Error | null, res?: { ok: boolean; data?: { serverNow: number } }) => {
        if (err || !res?.ok || !res.data) return;
        const t1 = Date.now();
        offset.current = res.data.serverNow - (t0 + (t1 - t0) / 2);
      });
    };
    const onConnect = () => { everConnected.current = true; setStatus('connected'); syncClock(); };
    const onDisconnect = (reason: string) => {
      setStatus(navigator.onLine ? 'reconnecting' : 'offline');
      if (reason === 'io server disconnect') s.connect();
    };
    const onConnectError = (err: Error) => {
      if (err.message === 'UNAUTHORIZED' && !tokenFetchFailed.current) { void logout(); return; }   // server rejected a real token → session is gone
      setStatus(navigator.onLine ? (everConnected.current ? 'reconnecting' : 'connecting') : 'offline');
    };
    // A dead link can look "connected" for the ping timeout (~45s). Drop the transport now so we reconnect promptly once back online.
    const onOffline = () => { setStatus('offline'); try { s.io.engine?.close(); } catch { /* already closed */ } };
    const onOnline = () => { setStatus('reconnecting'); if (!s.connected) s.connect(); };

    s.on('connect', onConnect); s.on('disconnect', onDisconnect); s.on('connect_error', onConnectError);
    window.addEventListener('offline', onOffline); window.addEventListener('online', onOnline);
    const clock = setInterval(() => { if (s.connected) syncClock(); }, 30_000);
    setSocket(s);

    return () => {
      clearInterval(clock);
      window.removeEventListener('offline', onOffline); window.removeEventListener('online', onOnline);
      s.off(); s.disconnect(); setSocket(null); setStatus('connecting');
    };
  }, [authStatus, userId, logout]);

  const serverNow = useCallback(() => Date.now() + offset.current, []);

  const request = useCallback(<T,>(event: string, payload: unknown = {}) => new Promise<T>((resolve, reject) => {
    if (!socket || !socket.connected) return reject(new ApiError(0, 'NETWORK', 'You are offline. Reconnecting…'));
    socket.timeout(10_000).emit(event, payload, (err: Error | null, res?: { ok: boolean; data?: T; error?: { code: string; message: string } }) => {
      if (err || !res) return reject(new ApiError(0, 'NETWORK', 'The server did not respond. Please try again.'));
      if (res.ok) return resolve(res.data as T);
      reject(new ApiError(0, res.error?.code ?? 'INTERNAL', res.error?.message ?? 'Something went wrong.'));
    });
  }), [socket]);

  const value = useMemo(() => ({ socket, status, serverNow, request }), [socket, status, serverNow, request]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useSocket = () => useContext(Ctx);
