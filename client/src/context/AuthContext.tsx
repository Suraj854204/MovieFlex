import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, setUnauthorizedHandler, ApiError } from '../lib/api';
import type { User } from '../lib/types';

type Status = 'loading' | 'authed' | 'anon' | 'error';
interface AuthValue {
  user: User | null; status: Status; bootError: string; slowBoot: boolean; sessionExpired: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signup: (v: { username: string; email: string; password: string; displayName?: string }) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  retry: () => void;
  clearExpired: () => void;
}
const Ctx = createContext<AuthValue>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [bootError, setBootError] = useState('');
  const [slowBoot, setSlowBoot] = useState(false);
  const [sessionExpired, setExpired] = useState(false);
  const wasAuthed = useRef(false);

  const boot = useCallback(async () => {
    setStatus('loading'); setBootError('');
    const slow = setTimeout(() => setSlowBoot(true), 3500);   // free hosts can take ~30s to wake
    try {
      const d = await api.get<{ user: User }>('/auth/me', { quiet401: true });
      setUserState(d.user); wasAuthed.current = true; setStatus('authed');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setStatus('anon');
      else { setBootError(e instanceof ApiError ? e.message : 'Could not reach the server.'); setStatus('error'); }
    } finally { clearTimeout(slow); setSlowBoot(false); }
  }, []);

  useEffect(() => { void boot(); }, [boot]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!wasAuthed.current) return;
      wasAuthed.current = false; setUserState(null); setExpired(true); setStatus('anon');
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user, status, bootError, slowBoot, sessionExpired,
    async login(identifier, password) {
      const d = await api.post<{ user: User }>('/auth/login', { identifier, password }, { quiet401: true });
      wasAuthed.current = true; setExpired(false); setUserState(d.user); setStatus('authed');
    },
    async signup(v) {
      const d = await api.post<{ user: User }>('/auth/signup', v, { quiet401: true });
      wasAuthed.current = true; setExpired(false); setUserState(d.user); setStatus('authed');
    },
    async logout() {
      try { await api.post('/auth/logout', {}, { quiet401: true }); } catch { /* cookie may already be gone */ }
      wasAuthed.current = false; setUserState(null); setStatus('anon');
    },
    setUser: (u) => setUserState(u),
    retry: () => void boot(),
    clearExpired: () => setExpired(false),
  }), [user, status, bootError, slowBoot, sessionExpired, boot]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
