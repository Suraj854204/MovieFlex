import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useFetch } from '../hooks/useFetch';
import { useCreateRoom } from '../components/CreateRoom';
import { JoinByCode } from '../components/JoinByCode';
import { RoomCard, Thumb } from '../components/RoomCard';
import { CardGridSkeleton, EmptyState, ErrorState } from '../components/ui/Feedback';
import { Avatar } from '../components/ui/Avatar';
import { Icon } from '../components/ui/Icon';
import { formatClock, timeAgo } from '../lib/format';
import { watchUrl } from '../lib/youtube';
import type { HistoryItem, PublicUser, RoomCardData } from '../lib/types';

function Section({ title, to, children, action }: { title: string; to?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="block">
      <div className="block-head"><h2>{title}</h2>{action ?? (to && <Link to={to} className="link">See all</Link>)}</div>
      {children}
    </section>
  );
}

export default function Home() {
  const { user } = useAuth();
  const openCreate = useCreateRoom();
  useEffect(() => { document.title = 'Home · MovieFlex Watch Party'; }, []);

  const live = useFetch<{ items: RoomCardData[] }>('/rooms/discover?filter=live&limit=6');
  const mine = useFetch<{ rooms: RoomCardData[] }>('/rooms/mine');
  const hist = useFetch<{ items: HistoryItem[] }>('/history?limit=6');
  const friends = useFetch<{ friends: (PublicUser & { sharedRooms: number })[] }>('/users/friends');

  return (
    <div className="stack-lg">
      <section className="welcome card">
        <div>
          <h1>Hey {user?.displayName.split(' ')[0]} 👋</h1>
          <p className="muted-2">Start a party or jump into one that's already going.</p>
        </div>
        <div className="welcome-actions">
          <button className="btn btn-primary btn-lg" onClick={() => openCreate()}><Icon name="plus" size={18} /> Create watch party</button>
          <div className="welcome-join"><span className="muted">or join with a code</span><JoinByCode /></div>
        </div>
      </section>

      <Section title="Live now" to="/discover?filter=live">
        {live.loading ? <CardGridSkeleton count={3} /> : live.error ? <ErrorState message={live.error} onRetry={live.reload} /> :
          live.data!.items.length ? <div className="grid">{live.data!.items.map((r) => <RoomCard key={r.id} room={r} />)}</div> :
            <EmptyState icon="compass" title="No public rooms are live right now" text="Be the first — create a public room and others can discover it." action={<Link to="/discover" className="btn btn-secondary">Browse Discover</Link>} />}
      </Section>

      <Section title="My rooms" to="/rooms">
        {mine.loading ? <CardGridSkeleton count={3} /> : mine.error ? <ErrorState message={mine.error} onRetry={mine.reload} /> :
          mine.data!.rooms.length ? <div className="grid">{mine.data!.rooms.slice(0, 3).map((r) => <RoomCard key={r.id} room={r} />)}</div> :
            <EmptyState icon="users" title="You haven't joined any rooms yet" text="Create one, or join with a code from a friend." action={<button className="btn btn-primary" onClick={() => openCreate()}>Create a room</button>} />}
      </Section>

      <Section title="Recently watched" to="/history">
        {hist.loading ? <CardGridSkeleton count={3} /> : hist.error ? <ErrorState message={hist.error} onRetry={hist.reload} /> :
          hist.data!.items.length ? (
            <div className="grid">
              {hist.data!.items.slice(0, 3).map((h) => (
                <article className="card room-card" key={h.id}>
                  <div className="thumb-wrap"><Thumb src={h.thumbnail} /></div>
                  <div className="room-card-body"><h3 className="line-2">{h.title}</h3><p className="muted">{timeAgo(h.lastWatchedAt)}{h.lastPosition > 5 ? ` · stopped at ${formatClock(h.lastPosition)}` : ''}</p></div>
                  <div className="room-card-foot"><span />
                    <button className="btn btn-secondary btn-sm" onClick={() => openCreate({ name: h.title, videoUrl: watchUrl(h.videoId) })}>Watch again</button></div>
                </article>
              ))}
            </div>
          ) : <EmptyState icon="history" title="Nothing watched yet" text="Videos you watch in a room show up here so you can watch them again." />}
      </Section>

      <Section title="Watched with">
        {friends.loading ? <div className="people-row"><div className="skeleton" style={{ height: 56, flex: 1 }} /></div> : friends.error ? <ErrorState message={friends.error} onRetry={friends.reload} /> :
          friends.data!.friends.length ? (
            <div className="people-row">
              {friends.data!.friends.slice(0, 8).map((f) => (
                <div className="person" key={f.id}>
                  <Avatar name={f.displayName} color={f.avatarColor} size={40} online={!!f.online} />
                  <div className="min0"><strong className="line-1">{f.displayName}</strong><span className="muted line-1">{f.online ? 'Online' : `@${f.username}`} · {f.sharedRooms} room{f.sharedRooms > 1 ? 's' : ''}</span></div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon="userPlus" title="No watch buddies yet" text="People you share a room with will appear here." />}
      </Section>
    </div>
  );
}