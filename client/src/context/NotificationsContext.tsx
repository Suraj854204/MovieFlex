import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../lib/api';
import type { NotificationItem } from '../lib/types';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface Value {
  items: NotificationItem[]; unread: number; loading: boolean; error: string;
  reload: () => Promise<void>;
  markAllRead: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
const Ctx = createContext<Value>(null as never);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const uid = user?.id;

  const reload = useCallback(async () => {
    try {
      const d = await api.get<{ items: NotificationItem[]; unread: number }>('/notifications');
      setItems(d.items); setUnread(d.unread); setError('');
    } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { if (uid) void reload(); else { setItems([]); setUnread(0); } }, [uid, reload]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (n: NotificationItem) => {
      setItems((l) => [n, ...l.filter((x) => x.id !== n.id)].slice(0, 50));
      setUnread((c) => c + 1);
      toast.info(n.title);
    };
    socket.on('notification:new', onNew);
    return () => { socket.off('notification:new', onNew); };
  }, [socket, toast]);

  const value = useMemo<Value>(() => ({
    items, unread, loading, error, reload,
    async markAllRead() {
      setItems((l) => l.map((n) => ({ ...n, read: true }))); setUnread(0);
      try { await api.post('/notifications/read', {}); } catch { void reload(); }
    },
    async markRead(id) {
      setItems((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((c) => Math.max(0, c - (items.find((n) => n.id === id && !n.read) ? 1 : 0)));
      try { await api.post('/notifications/read', { ids: [id] }); } catch { void reload(); }
    },
    async remove(id) {
      const was = items.find((n) => n.id === id);
      setItems((l) => l.filter((n) => n.id !== id));
      if (was && !was.read) setUnread((c) => Math.max(0, c - 1));
      try { await api.del(`/notifications/${id}`); } catch { void reload(); }
    },
  }), [items, unread, loading, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export const useNotifications = () => useContext(Ctx);
