import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Icon, type IconName } from '../components/ui/Icon';
import { Avatar } from '../components/ui/Avatar';
import { ConnectionBanner } from '../components/ConnectionBanner';
import { CreateRoomProvider, useCreateRoom } from '../components/CreateRoom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { useToast } from '../context/ToastContext';

const NAV: { to: string; label: string; icon: IconName; badge?: boolean }[] = [
  { to: '/home', label: 'Home', icon: 'home' },
  { to: '/discover', label: 'Discover', icon: 'compass' },
  { to: '/rooms', label: 'My Rooms', icon: 'users' },
  { to: '/history', label: 'History', icon: 'history' },
  { to: '/notifications', label: 'Notifications', icon: 'bell', badge: true },
  { to: '/profile', label: 'Profile', icon: 'user' },
];
const MOBILE_NAV = NAV.filter((n) => n.to !== '/notifications');

function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const loc = useLocation();
  const [q, setQ] = useState(loc.pathname === '/discover' ? params.get('q') ?? '' : '');
  useEffect(() => { if (loc.pathname === '/discover') setQ(params.get('q') ?? ''); }, [loc.pathname, params]);
  const submit = (e: FormEvent) => { e.preventDefault(); navigate(q.trim() ? `/discover?q=${encodeURIComponent(q.trim())}` : '/discover'); };
  return (
    <form className="search" role="search" onSubmit={submit}>
      <Icon name="search" size={16} />
      <input aria-label="Search public rooms" placeholder="Search rooms, videos, hosts…" value={q} maxLength={60} onChange={(e) => setQ(e.target.value)} />
    </form>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  if (!user) return null;
  return (
    <div className="menu-wrap" ref={ref}>
      <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        <Avatar name={user.displayName} color={user.avatarColor} size={34} online />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head"><strong className="line-1">{user.displayName}</strong><span className="muted line-1">@{user.username}</span></div>
          <Link role="menuitem" className="menu-item" to="/profile" onClick={() => setOpen(false)}><Icon name="user" size={16} /> Profile</Link>
          <Link role="menuitem" className="menu-item" to="/rooms" onClick={() => setOpen(false)}><Icon name="users" size={16} /> My rooms</Link>
          <button role="menuitem" className="menu-item" onClick={async () => { setOpen(false); await logout(); toast.info('Signed out'); navigate('/'); }}>
            <Icon name="logout" size={16} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { user } = useAuth();
  const { unread } = useNotifications();
  const openCreate = useCreateRoom();
  const loc = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);
  if (!user) return null;

  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className="sidebar" aria-label="Primary">
        <Link to="/home" className="sidebar-logo" aria-label="MovieFlex home"><Logo /></Link>
        <button className="btn btn-primary btn-block" onClick={() => openCreate()}><Icon name="plus" size={16} /> New watch party</button>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon name={n.icon} size={18} /><span>{n.label}</span>
              {n.badge && unread > 0 && <span className="count" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <Avatar name={user.displayName} color={user.avatarColor} size={34} online />
          <div className="min0"><strong className="line-1">{user.displayName}</strong><span className="muted line-1">@{user.username}</span></div>
        </div>
      </aside>

      <div className="content-col">
        <ConnectionBanner />
        <header className="topbar">
          <Link to="/home" className="topbar-logo" aria-label="MovieFlex home"><Logo compact /></Link>
          <SearchBox />
          <div className="topbar-actions">
            <button className="btn btn-primary btn-sm hide-lg" onClick={() => openCreate()}><Icon name="plus" size={16} /> Create</button>
            <Link to="/notifications" className="btn btn-ghost btn-icon bell" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
              <Icon name="bell" />{unread > 0 && <span className="count">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <ProfileMenu />
          </div>
        </header>
        <main id="main" className="page" tabIndex={-1}><Outlet /></main>
      </div>

      <nav className="bottom-nav" aria-label="Primary mobile">
        {MOBILE_NAV.map((n) => (
          <NavLink key={n.to} to={n.to} className={({ isActive }) => `bn-item ${isActive ? 'active' : ''}`}>
            <Icon name={n.icon} size={20} /><span>{n.label === 'My Rooms' ? 'Rooms' : n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function AppShell() {
  return <CreateRoomProvider><Shell /></CreateRoomProvider>;
}
