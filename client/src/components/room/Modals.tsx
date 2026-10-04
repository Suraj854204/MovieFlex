import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Icon } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { api, ApiError, errMsg } from '../../lib/api';
import { copyText } from '../../lib/clipboard';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import type { Privacy, PublicUser, RoomSettings } from '../../lib/types';

export function ShareModal({ code, name, onClose }: { code: string; name: string; onClose: () => void }) {
  const toast = useToast();
  const link = `${window.location.origin}/room/${code}`;
  const [q, setQ] = useState('');
  const [results, setResults] = useState<(PublicUser & { online?: boolean })[]>([]);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const copy = async (text: string, label: string) => { if (await copyText(text)) toast.success(`${label} copied`); else toast.error('Could not copy — select and copy it manually.'); };
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.get<{ users: typeof results }>(`/users/search?q=${encodeURIComponent(q.trim())}`, { signal: ctrl.signal }).then((d) => setResults(d.users)).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  const invite = async (u: PublicUser) => {
    try { await api.post(`/rooms/${code}/invite`, { username: u.username }); setInvited((s) => new Set(s).add(u.id)); toast.success(`Invited ${u.displayName}`); }
    catch (e) { toast.error(errMsg(e)); }
  };
  const nativeShare = typeof navigator.share === 'function'
    ? () => navigator.share({ title: name, text: `Join my watch party “${name}” on MovieFlex`, url: link }).catch(() => {}) : null;

  return (
    <Modal title="Invite people" description={`Share “${name}”`} onClose={onClose}>
      <div className="stack">
        <div className="field"><span>Room code</span>
          <div className="copy-row"><code className="code-big" aria-label={`Room code ${code.split('').join(' ')}`}>{code}</code>
            <button className="btn btn-secondary" onClick={() => copy(code, 'Room code')}><Icon name="copy" size={16} /> Copy code</button></div></div>
        <div className="field"><span>Invite link</span>
          <div className="copy-row"><input className="input" readOnly value={link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <button className="btn btn-secondary" onClick={() => copy(link, 'Invite link')}><Icon name="link" size={16} /> Copy</button></div></div>
        {nativeShare && <button className="btn btn-secondary" onClick={nativeShare}><Icon name="share" size={16} /> Share…</button>}
        <div className="field"><span>Invite by username</span>
          <input className="input" value={q} placeholder="Search people" onChange={(e) => setQ(e.target.value)} />
          {q.trim().length >= 2 && (
            <ul className="result-list">
              {results.length === 0 && <li className="muted pad-sm">No people found.</li>}
              {results.map((u) => (
                <li key={u.id}><Avatar name={u.displayName} color={u.avatarColor} size={30} online={!!u.online} />
                  <div className="min0 grow"><strong className="line-1">{u.displayName}</strong><span className="muted line-1">@{u.username}</span></div>
                  <button className="btn btn-secondary btn-sm" disabled={invited.has(u.id)} onClick={() => invite(u)}>{invited.has(u.id) ? 'Invited' : 'Invite'}</button></li>
              ))}
            </ul>)}
        </div>
      </div>
    </Modal>
  );
}

export function SettingsModal({ code, room, onClose, onDeleted }: { code: string; room: RoomSettings; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast(); const confirm = useConfirm();
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description);
  const [privacy, setPrivacy] = useState<Privacy>(room.privacy);
  const [locked, setLocked] = useState(room.locked);
  const [max, setMax] = useState(String(room.maxParticipants));
  const [password, setPassword] = useState('');
  const [removePw, setRemovePw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const n = Number(max);
    const v: Record<string, string> = {};
    if (!name.trim()) v.name = 'Room name is required.';
    if (!Number.isInteger(n) || n < 2 || n > 100) v.maxParticipants = 'Enter a number from 2 to 100.';
    if (password && password.length < 4) v.password = 'Password must be at least 4 characters.';
    setErrors(v); if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await api.patch(`/rooms/${code}`, {
        name: name.trim(), description: description.trim(), privacy, locked, maxParticipants: n,
        ...(privacy === 'private' ? (password ? { password } : removePw ? { password: null } : {}) : {}),
      });
      toast.success('Room settings saved'); onClose();
    } catch (err) { if (err instanceof ApiError && err.details) setErrors(err.details); else toast.error(errMsg(err)); setBusy(false); }
  };

  const del = async () => {
    if (!(await confirm({ title: 'Delete this room?', message: 'Everyone will be disconnected and the room, its chat and codes are permanently removed.', confirmLabel: 'Delete room', danger: true }))) return;
    try { await api.del(`/rooms/${code}`); toast.success('Room deleted'); onDeleted(); } catch (err) { toast.error(errMsg(err)); }
  };

  return (
    <Modal title="Room settings" onClose={onClose}
      footer={<><button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button><button className="btn btn-primary" form="settings-form" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      <form id="settings-form" className="stack" onSubmit={save} noValidate>
        <label className="field"><span>Name</span><input className="input" data-autofocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />{errors.name && <small className="field-error">{errors.name}</small>}</label>
        <label className="field"><span>Description</span><input className="input" maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <fieldset className="field"><legend>Privacy</legend>
          <div className="choice-row">
            {(['public', 'private'] as const).map((p) => (
              <label key={p} className={`choice ${privacy === p ? 'active' : ''}`}><input type="radio" name="s-privacy" checked={privacy === p} onChange={() => setPrivacy(p)} />
                <Icon name={p === 'public' ? 'globe' : 'lock'} size={18} /><strong>{p === 'public' ? 'Public' : 'Private'}</strong>
                <small>{p === 'public' ? 'Shown on Discover' : 'Code or link only'}</small></label>
            ))}
          </div></fieldset>
        {privacy === 'private' && (
          <div className="field"><span>Password {room.hasPassword && <em>(currently set)</em>}</span>
            <input className="input" type="password" autoComplete="new-password" maxLength={64} value={password} placeholder={room.hasPassword ? 'Enter a new password to replace it' : 'Optional'} onChange={(e) => { setPassword(e.target.value); setRemovePw(false); }} aria-invalid={!!errors.password} />
            {errors.password && <small className="field-error">{errors.password}</small>}
            {room.hasPassword && <label className="check"><input type="checkbox" checked={removePw} onChange={(e) => { setRemovePw(e.target.checked); if (e.target.checked) setPassword(''); }} /> Remove password</label>}</div>
        )}
        <label className="check switch"><input type="checkbox" checked={locked} onChange={(e) => setLocked(e.target.checked)} /> <span><strong>Lock room</strong><small className="muted"> — nobody new can join (current members can rejoin)</small></span></label>
        <label className="field"><span>Max people online</span><input className="input narrow-input" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} aria-invalid={!!errors.maxParticipants} />{errors.maxParticipants && <small className="field-error">{errors.maxParticipants}</small>}</label>
        <div className="danger-zone"><div><strong>Delete room</strong><p className="muted">Permanently removes the room for everyone.</p></div>
          <button type="button" className="btn btn-danger" onClick={del}><Icon name="trash" size={16} /> Delete</button></div>
      </form>
    </Modal>
  );
}
