import { createContext, useCallback, useContext, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './ui/Modal';
import { Icon } from './ui/Icon';
import { api, ApiError, errMsg } from '../lib/api';
import { extractVideoId } from '../lib/youtube';
import type { Privacy, RoomCardData } from '../lib/types';
import { useToast } from '../context/ToastContext';

export interface CreateInitial { name?: string; videoUrl?: string }
const Ctx = createContext<(initial?: CreateInitial) => void>(() => {});
export const useCreateRoom = () => useContext(Ctx);

export function CreateRoomProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<CreateInitial | null>(null);
  const openFn = useCallback((i?: CreateInitial) => setOpen(i ?? {}), []);
  return (
    <Ctx.Provider value={openFn}>
      {children}
      {open && <CreateRoomModal initial={open} onClose={() => setOpen(null)} />}
    </Ctx.Provider>
  );
}

function CreateRoomModal({ initial, onClose }: { initial: CreateInitial; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(initial.name?.slice(0, 60) ?? '');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<Privacy>('public');
  const [password, setPassword] = useState('');
  const [videoUrl, setVideoUrl] = useState(initial.videoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = 'Give your room a name.';
    if (videoUrl.trim() && !extractVideoId(videoUrl)) next.videoUrl = 'That is not a valid YouTube link.';
    if (privacy === 'private' && password && password.length < 4) next.password = 'Password must be at least 4 characters.';
    setErrors(next); setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const d = await api.post<{ room: RoomCardData }>('/rooms', {
        name: name.trim(), description: description.trim() || undefined, privacy,
        password: privacy === 'private' && password ? password : undefined,
        videoUrl: videoUrl.trim() || undefined,
      });
      toast.success('Room created');
      onClose();
      navigate(`/room/${d.room.code}`);
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details); else setFormError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Create a watch party" description="Set up a room and invite people with a code or link." onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" form="create-room-form" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button>
      </>}>
      <form id="create-room-form" onSubmit={submit} noValidate className="stack">
        <label className="field">
          <span>Room name</span>
          <input className="input" data-autofocus value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Friday movie night" aria-invalid={!!errors.name} />
          {errors.name && <small className="field-error">{errors.name}</small>}
        </label>
        <label className="field">
          <span>Description <em>(optional)</em></span>
          <input className="input" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} placeholder="What are we watching?" />
        </label>
        <label className="field">
          <span>First video <em>(optional)</em></span>
          <input className="input" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="Paste a YouTube link" aria-invalid={!!errors.videoUrl} />
          {errors.videoUrl && <small className="field-error">{errors.videoUrl}</small>}
        </label>
        <fieldset className="field">
          <legend>Privacy</legend>
          <div className="choice-row">
            {(['public', 'private'] as const).map((p) => (
              <label key={p} className={`choice ${privacy === p ? 'active' : ''}`}>
                <input type="radio" name="privacy" checked={privacy === p} onChange={() => setPrivacy(p)} />
                <Icon name={p === 'public' ? 'globe' : 'lock'} size={18} />
                <strong>{p === 'public' ? 'Public' : 'Private'}</strong>
                <small>{p === 'public' ? 'Listed on Discover. Anyone can join.' : 'Hidden. Join only with the code or link.'}</small>
              </label>
            ))}
          </div>
        </fieldset>
        {privacy === 'private' && (
          <label className="field">
            <span>Room password <em>(optional)</em></span>
            <input className="input" type="password" autoComplete="new-password" value={password} maxLength={64} onChange={(e) => setPassword(e.target.value)} placeholder="Ask for a password to join" aria-invalid={!!errors.password} />
            {errors.password && <small className="field-error">{errors.password}</small>}
          </label>
        )}
        {formError && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {formError}</p>}
      </form>
    </Modal>
  );
}
