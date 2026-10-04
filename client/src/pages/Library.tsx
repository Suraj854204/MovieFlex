import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../lib/api';
import { useFetch } from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useCreateRoom } from '../components/CreateRoom';
import { RoomCard, Thumb } from '../components/RoomCard';
import { CardGridSkeleton, EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { Icon } from '../components/ui/Icon';
import { copyText } from '../lib/clipboard';
import { formatClock, timeAgo } from '../lib/format';
import { watchUrl } from '../lib/youtube';
import { useNotifications } from '../context/NotificationsContext';
import type { HistoryItem, RoomCardData } from '../lib/types';

export function MyRooms() {
  const { data, loading, error, reload } = useFetch<{ rooms: RoomCardData[] }>('/rooms/mine');
  const openCreate = useCreateRoom();
  const toast = useToast();
  const confirm = useConfirm();
  useEffect(() => { document.title = 'My Rooms · MovieFlex Watch Party'; }, []);

  const leave = async (r: RoomCardData) => {
    const ok = await confirm({
      title: `Leave “${r.name}”?`, danger: true, confirmLabel: 'Leave room',
      message: r.myRole === 'host' ? 'You are the host. The host role passes to another member (if there is one) and you will need the code to rejoin.' : 'You will need the room code (or a public listing) to join again.',
    });
    if (!ok) return;
    try {
      const res = await api.post<{ left: boolean }>(`/rooms/${r.code}/leave`);
      toast[res.left ? 'success' : 'info'](res.left ? 'You left the room' : 'You are the only member, so the room stays in your list.');
      reload();
    } catch (e) { toast.error(errMsg(e)); }
  };
  const copy = async (r: RoomCardData) => toast[(await copyText(`${location.origin}/room/${r.code}`)) ? 'success' : 'error']('Invite link copied');

  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1>My Rooms</h1><p className="muted-2">Rooms you host or have joined. Rejoin any time.</p></div>
        <button className="btn btn-primary" onClick={() => openCreate()}><Icon name="plus" size={16} /> New room</button></div>
      {loading ? <CardGridSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> :
        data!.rooms.length ? (
          <div className="grid">{data!.rooms.map((r) => (
            <RoomCard key={r.id} room={r} action={
              <span className="row gap-6">
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Copy invite link for ${r.name}`} title="Copy invite link" onClick={() => copy(r)}><Icon name="link" size={16} /></button>
                <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Leave ${r.name}`} title="Leave room" onClick={() => leave(r)}><Icon name="logout" size={16} /></button>
                <Link to={`/room/${r.code}`} className="btn btn-primary btn-sm">Open</Link>
              </span>} />
          ))}</div>
        ) : <EmptyState icon="users" title="No rooms yet" text="Rooms you create or join will be listed here." action={<button className="btn btn-primary" onClick={() => openCreate()}>Create a room</button>} />}
    </div>
  );
}

export function History() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const toast = useToast(); const confirm = useConfirm(); const openCreate = useCreateRoom();
  useEffect(() => { document.title = 'History · MovieFlex Watch Party'; }, []);

  const load = async (offset = 0) => {
    setError('');
    try {
      const d = await api.get<{ items: HistoryItem[]; hasMore: boolean }>(`/history?limit=18&offset=${offset}`);
      setItems((c) => (offset ? [...c, ...d.items] : d.items)); setHasMore(d.hasMore);
    } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
  };
  useEffect(() => { void load(0); }, []);

  const remove = async (h: HistoryItem) => {
    setItems((c) => c.filter((x) => x.id !== h.id));
    try { await api.del(`/history/${h.id}`); } catch (e) { toast.error(errMsg(e)); void load(0); }
  };
  const clearAll = async () => {
    if (!(await confirm({ title: 'Clear watch history?', message: 'This removes every video from your history. It cannot be undone.', confirmLabel: 'Clear history', danger: true }))) return;
    try { await api.del('/history'); setItems([]); setHasMore(false); toast.success('History cleared'); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="stack-lg">
      <div className="page-head"><div><h1>History</h1><p className="muted-2">Videos you've watched in rooms. Watch again with one click.</p></div>
        {items.length > 0 && <button className="btn btn-secondary" onClick={clearAll}><Icon name="trash" size={16} /> Clear all</button>}</div>
      {loading ? <CardGridSkeleton /> : error && !items.length ? <ErrorState message={error} onRetry={() => load(0)} /> :
        items.length ? (
          <>
            <div className="grid">{items.map((h) => (
              <article className="card room-card" key={h.id}>
                <div className="thumb-wrap"><Thumb src={h.thumbnail} />
                  {h.lastPosition > 5 && <span className="thumb-badges"><span className="badge badge-dark">Stopped at {formatClock(h.lastPosition)}</span></span>}</div>
                <div className="room-card-body"><h3 className="line-2">{h.title}</h3><p className="muted">{timeAgo(h.lastWatchedAt)}</p></div>
                <div className="room-card-foot">
                  <button className="btn btn-ghost btn-icon btn-sm" aria-label={`Remove ${h.title} from history`} onClick={() => remove(h)}><Icon name="trash" size={16} /></button>
                  <button className="btn btn-primary btn-sm" onClick={() => openCreate({ name: h.title, videoUrl: watchUrl(h.videoId) })}><Icon name="play" size={14} /> Watch again</button>
                </div>
              </article>
            ))}</div>
            {hasMore && <div className="center"><button className="btn btn-secondary" onClick={() => load(items.length)}>Load more</button></div>}
          </>
        ) : <EmptyState icon="history" title="Your history is empty" text="Videos you watch in rooms will show up here." />}
    </div>
  );
}

export function Notifications() {
  const { items, loading, error, reload, unread, markAllRead, markRead, remove } = useNotifications();
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Notifications · MovieFlex Watch Party'; }, []);
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack-lg narrow">
      <div className="page-head"><div><h1>Notifications</h1><p className="muted-2">{unread ? `${unread} unread` : 'You are all caught up.'}</p></div>
        {unread > 0 && <button className="btn btn-secondary" disabled={busy} onClick={async () => { setBusy(true); await markAllRead(); setBusy(false); }}><Icon name="check" size={16} /> Mark all read</button>}</div>
      {loading ? <div className="stack">{[0, 1, 2].map((i) => <Skeleton key={i} style={{ height: 68 }} />)}</div> : error ? <ErrorState message={error} onRetry={reload} /> :
        items.length ? (
          <ul className="list card">{items.map((n) => (
            <li key={n.id} className={`list-item ${n.read ? '' : 'unread'}`}>
              <button className="list-main" onClick={() => { void markRead(n.id); if (n.link) navigate(n.link); }}>
                {!n.read && <span className="unread-dot" aria-label="Unread" />}
                <span className="min0"><strong className="line-1">{n.title}</strong>{n.body && <span className="muted line-1">{n.body}</span>}<span className="muted">{timeAgo(n.createdAt)}</span></span>
              </button>
              <button className="btn btn-ghost btn-icon" aria-label="Delete notification" onClick={() => remove(n.id)}><Icon name="x" size={16} /></button>
            </li>
          ))}</ul>
        ) : <EmptyState icon="bell" title="No notifications" text="Invites, role changes and room updates will appear here." action={<Link to="/discover" className="btn btn-secondary">Explore Discover</Link>} />}
    </div>
  );
}
