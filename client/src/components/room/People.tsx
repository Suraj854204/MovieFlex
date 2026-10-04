import { useEffect, useRef, useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import type { Participant, Role } from '../../lib/types';

export function People({ participants, meId, myRole, onRole, onTransfer, onKick }: {
  participants: Participant[]; meId: string; myRole: Role;
  onRole: (p: Participant, role: 'moderator' | 'member') => void;
  onTransfer: (p: Participant) => void; onKick: (p: Participant) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openId) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpenId(null); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenId(null); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [openId]);

  const canKick = (p: Participant) => p.userId !== meId && p.role !== 'host' && (myRole === 'host' || (myRole === 'moderator' && p.role === 'member'));
  const hasMenu = (p: Participant) => p.userId !== meId && (myRole === 'host' ? p.role !== 'host' : canKick(p));
  const online = participants.filter((p) => p.online).length;

  return (
    <div className="people" ref={ref}>
      <p className="muted people-count">{online} online</p>
      <ul className="people-list">
        {participants.map((p) => (
          <li key={p.userId} className={`person-row ${p.online ? '' : 'away'}`}>
            <Avatar name={p.displayName} color={p.avatarColor} size={34} online={p.online} />
            <div className="min0 grow">
              <strong className="line-1">{p.displayName}{p.userId === meId && <span className="muted"> (you)</span>}</strong>
              <span className="muted line-1">@{p.username}{p.online ? '' : ' · away'}</span>
            </div>
            {p.role === 'host' && <span className="role-tag host"><Icon name="crown" size={11} /> Host</span>}
            {p.role === 'moderator' && <span className="role-tag mod"><Icon name="shield" size={11} /> Mod</span>}
            {hasMenu(p) && (
              <div className="menu-wrap">
                <button className="btn btn-ghost btn-icon btn-sm" aria-haspopup="menu" aria-expanded={openId === p.userId} aria-label={`Actions for ${p.displayName}`}
                  onClick={() => setOpenId(openId === p.userId ? null : p.userId)}><Icon name="more" size={16} /></button>
                {openId === p.userId && (
                  <div className="menu" role="menu">
                    {myRole === 'host' && p.role === 'member' && <button role="menuitem" className="menu-item" onClick={() => { setOpenId(null); onRole(p, 'moderator'); }}><Icon name="shield" size={15} /> Make moderator</button>}
                    {myRole === 'host' && p.role === 'moderator' && <button role="menuitem" className="menu-item" onClick={() => { setOpenId(null); onRole(p, 'member'); }}><Icon name="user" size={15} /> Remove moderator</button>}
                    {myRole === 'host' && <button role="menuitem" className="menu-item" onClick={() => { setOpenId(null); onTransfer(p); }}><Icon name="crown" size={15} /> Make host</button>}
                    {canKick(p) && <button role="menuitem" className="menu-item danger" onClick={() => { setOpenId(null); onKick(p); }}><Icon name="logout" size={15} /> Remove from room</button>}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
