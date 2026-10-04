import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, ApiError, errMsg } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Icon } from '../components/ui/Icon';
import { formatDate } from '../lib/format';
import type { User } from '../lib/types';

const COLORS = ['#6ea8ff', '#8b7bff', '#2dd4bf', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#38bdf8'];

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.displayName ?? '');
  const [color, setColor] = useState(user?.avatarColor ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  useEffect(() => { document.title = 'Profile · MovieFlex Watch Party'; }, []);
  if (!user) return null;
  const dirty = name.trim() !== user.displayName || color !== user.avatarColor;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Display name cannot be empty.'); return; }
    setSaving(true);
    try { const d = await api.patch<{ user: User }>('/users/me', { displayName: name.trim(), avatarColor: color }); setUser(d.user); toast.success('Profile updated'); }
    catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  };
  const changePw = async (e: FormEvent) => {
    e.preventDefault(); setPwErr('');
    if (pw.newPassword.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    setPwBusy(true);
    try { await api.post('/auth/password', pw); setPw({ currentPassword: '', newPassword: '' }); toast.success('Password changed'); }
    catch (err) { setPwErr(err instanceof ApiError ? err.message : errMsg(err)); } finally { setPwBusy(false); }
  };

  return (
    <div className="stack-lg narrow">
      <div className="page-head"><div><h1>Profile</h1><p className="muted-2">Manage how you appear in rooms.</p></div></div>
      <section className="card pad">
        <div className="profile-head">
          <Avatar name={name || user.displayName} color={color} size={72} online />
          <div><h2>{user.displayName}</h2><p className="muted">@{user.username}</p>
            <p className="muted row gap-6"><span className="presence-dot on static" /> Online · Member since {formatDate(user.createdAt)}</p></div>
        </div>
        <form onSubmit={save} className="stack">
          <label className="field"><span>Display name</span><input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
          <div className="field"><span>Avatar colour</span>
            <div className="swatches" role="radiogroup" aria-label="Avatar colour">
              {COLORS.map((c) => <button type="button" key={c} role="radio" aria-checked={color === c} aria-label={c} className={`swatch ${color === c ? 'active' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />)}
            </div></div>
          <div className="grid-2">
            <label className="field"><span>Username</span><input className="input" value={user.username} disabled /></label>
            <label className="field"><span>Email</span><input className="input" value={user.email} disabled /></label>
          </div>
          <div><button className="btn btn-primary" disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
        </form>
      </section>

      <section className="card pad">
        <h2>Change password</h2>
        <form onSubmit={changePw} className="stack">
          <label className="field"><span>Current password</span><input className="input" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>
          <label className="field"><span>New password</span><input className="input" type="password" autoComplete="new-password" maxLength={72} value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
          {pwErr && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {pwErr}</p>}
          <div><button className="btn btn-secondary" disabled={pwBusy || !pw.currentPassword || !pw.newPassword}>{pwBusy ? 'Updating…' : 'Update password'}</button></div>
        </form>
      </section>

      <section className="card pad row between wrap gap-12">
        <div><h2>Sign out</h2><p className="muted-2">You'll need to sign in again on this device.</p></div>
        <button className="btn btn-danger" onClick={async () => { await logout(); toast.info('Signed out'); navigate('/'); }}><Icon name="logout" size={16} /> Sign out</button>
      </section>
    </div>
  );
}
