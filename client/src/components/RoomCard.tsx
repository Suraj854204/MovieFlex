import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './ui/Icon';
import { Avatar } from './ui/Avatar';
import { timeAgo } from '../lib/format';
import type { RoomCardData } from '../lib/types';

export function Thumb({ src, alt = '' }: { src?: string | null; alt?: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="thumb thumb-empty" aria-hidden="true"><Icon name="film" size={28} /></div>;
  return <img className="thumb" src={src} alt={alt} loading="lazy" onError={() => setBad(true)} />;
}

export function RoomCard({ room, action }: { room: RoomCardData; action?: React.ReactNode }) {
  return (
    <article className="card room-card">
      <Link to={`/room/${room.code}`} className="room-card-link" aria-label={`Open room ${room.name}`}>
        <div className="thumb-wrap">
          <Thumb src={room.video?.thumbnail} />
          <div className="thumb-badges">
            {room.live && <span className="badge badge-live"><span className="dot" /> Live</span>}
            <span className="badge badge-dark"><Icon name="users" size={12} /> {room.participantCount}</span>
          </div>
        </div>
        <div className="room-card-body">
          <h3 className="line-1">{room.name}</h3>
          <p className="muted line-1">{room.video?.title || room.description || 'No video yet'}</p>
          <div className="room-meta">
            {room.host && <span className="row gap-6"><Avatar name={room.host.displayName} color={room.host.avatarColor} size={20} /><span className="line-1">{room.host.displayName}</span></span>}
            <span className="muted">{timeAgo(room.createdAt)}</span>
          </div>
        </div>
      </Link>
      <div className="room-card-foot">
        <span className="badges">
          <span className="badge"><Icon name={room.privacy === 'public' ? 'globe' : 'lock'} size={12} /> {room.privacy === 'public' ? 'Public' : 'Private'}</span>
          {room.locked && <span className="badge badge-warn">Locked</span>}
          {room.hasPassword && <span className="badge">Password</span>}
          {room.myRole === 'host' && <span className="badge badge-accent"><Icon name="crown" size={12} /> Host</span>}
          {room.myRole === 'moderator' && <span className="badge badge-accent"><Icon name="shield" size={12} /> Mod</span>}
        </span>
        {action ?? <Link to={`/room/${room.code}`} className="btn btn-primary btn-sm">{room.myRole ? 'Open' : 'Join'}</Link>}
      </div>
    </article>
  );
}
