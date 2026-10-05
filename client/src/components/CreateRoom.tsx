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

/* ──────────────────────────────────────────────────────────────
   DESIGN NOTES (phone-first, no new state / no new handlers)
   • 3 numbered steps → name, video, privacy. Optional description
     lives in a native <details> so the sheet stays short on phones.
   • Privacy = two big side-by-side cards (radio inputs underneath →
     keyboard & screen-reader safe). Selected card glows + checkmark.
   • Video link: leading icon, live thumbnail preview that pops in.
   • 16px text everywhere (no iOS zoom), 52px fields, 50px buttons,
     press-scale feedback on every tappable thing.
   • Footer on phone: small Cancel + large Create (thumb zone).
   • Wider screens: same layout with more breathing room.
   ────────────────────────────────────────────────────────────── */

const styles = `
  .cr-form, .cr-form *, .cr-form *::before, .cr-form *::after { box-sizing: border-box; }
  .cr-form {
    --cr-border: rgba(255,255,255,.1);
    --cr-border-hi: rgba(255,255,255,.22);
    --cr-focus: #818cf8;
    --cr-bg: rgba(255,255,255,.045);
    --cr-text: #f8fafc;
    --cr-text-2: #a8b3c7;
    --cr-text-3: #7b88a1;
    --cr-brand: #6366f1;
    --cr-grad: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
    --cr-danger: #fb7185;
    --cr-ok: #34d399;
    display: flex;
    flex-direction: column;
    gap: 22px;
    width: 100%;
    min-width: 0;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    color: var(--cr-text);
  }

  /* ── Fields & labels ── */
  .cr-field { display: flex; flex-direction: column; gap: 10px; min-width: 0; border: 0; padding: 0; margin: 0; }
  .cr-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: .005em;
    color: var(--cr-text);
  }
  .cr-label-main { display: inline-flex; align-items: center; gap: 10px; min-width: 0; }
  .cr-step {
    flex-shrink: 0;
    width: 22px; height: 22px;
    display: grid; place-items: center;
    border-radius: 50%;
    background: rgba(99,102,241,.22);
    border: 1px solid rgba(129,140,248,.4);
    color: #c7d2fe;
    font-size: 11px;
    font-weight: 800;
  }
  .cr-label em { font-style: normal; font-weight: 600; font-size: 12px; color: var(--cr-text-3); }
  .cr-count { font-size: 12px; font-weight: 600; color: var(--cr-text-3); font-variant-numeric: tabular-nums; }
  .cr-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--cr-text-3); }

  /* ── Inputs ── */
  .cr-input {
    width: 100%;
    min-height: 52px;
    padding: 0 16px;
    border-radius: 14px;
    background: var(--cr-bg);
    border: 1.5px solid var(--cr-border);
    color: var(--cr-text);
    font-family: inherit;
    font-size: 16px;
    font-weight: 500;
    line-height: 1.2;
    outline: none;
    -webkit-appearance: none;
    appearance: none;
    transition: border-color .15s, box-shadow .15s, background .15s;
  }
  .cr-input::placeholder { color: var(--cr-text-3); }
  .cr-input:hover { border-color: var(--cr-border-hi); }
  .cr-input:focus {
    border-color: var(--cr-focus);
    background: rgba(99,102,241,.09);
    box-shadow: 0 0 0 4px rgba(129,140,248,.2);
  }
  .cr-input[aria-invalid="true"] {
    border-color: var(--cr-danger);
    box-shadow: 0 0 0 4px rgba(251,113,133,.15);
  }

  .cr-input-wrap { position: relative; display: flex; align-items: center; }
  .cr-input-wrap .cr-input { padding-left: 46px; }
  .cr-lead {
    position: absolute;
    left: 16px;
    display: grid; place-items: center;
    color: var(--cr-text-3);
    pointer-events: none;
    transition: color .15s;
  }
  .cr-input-wrap:focus-within .cr-lead { color: #a5b4fc; }

  .cr-error {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--cr-danger);
    animation: crFade .18s ease-out;
  }

  /* ── Live video preview ── */
  .cr-preview {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 10px;
    border-radius: 14px;
    background: rgba(16,185,129,.08);
    border: 1px solid rgba(16,185,129,.3);
    min-width: 0;
    animation: crPop .28s cubic-bezier(.16,1,.3,1);
  }
  .cr-preview-thumb {
    position: relative;
    flex-shrink: 0;
    width: 112px;
    aspect-ratio: 16 / 9;
    border-radius: 10px;
    overflow: hidden;
    background: #0b1020;
  }
  .cr-preview-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cr-preview-thumb::after {
    content: "▶";
    position: absolute;
    inset: 0;
    display: grid; place-items: center;
    padding-left: 2px;
    font-size: 14px;
    color: #fff;
    background: linear-gradient(0deg, rgba(3,7,18,.45), rgba(3,7,18,.1));
  }
  .cr-preview b { display: flex; align-items: center; gap: 6px; font-size: 13.5px; color: #6ee7b7; }
  .cr-preview span { display: block; margin-top: 2px; font-size: 12px; line-height: 1.4; color: var(--cr-text-2); }

  /* ── Privacy cards ── */
  .cr-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .cr-choice {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    min-height: 124px;
    padding: 14px;
    border-radius: 16px;
    background: var(--cr-bg);
    border: 1.5px solid var(--cr-border);
    cursor: pointer;
    transition: border-color .18s, background .18s, box-shadow .18s, transform .12s;
    -webkit-tap-highlight-color: transparent;
  }
  .cr-choice:hover { border-color: var(--cr-border-hi); }
  .cr-choice:active { transform: scale(.97); }
  .cr-choice input {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }
  .cr-choice:focus-within { box-shadow: 0 0 0 4px rgba(129,140,248,.28); }
  .cr-choice.is-active {
    border-color: var(--cr-focus);
    background: linear-gradient(160deg, rgba(99,102,241,.22) 0%, rgba(168,85,247,.12) 100%);
    box-shadow: 0 8px 24px rgba(99,102,241,.22);
  }
  .cr-choice-ico {
    width: 38px; height: 38px;
    display: grid; place-items: center;
    margin-bottom: 6px;
    border-radius: 12px;
    background: rgba(255,255,255,.07);
    color: var(--cr-text-2);
    transition: background .18s, color .18s;
  }
  .cr-choice.is-active .cr-choice-ico { background: var(--cr-grad); color: #fff; }
  .cr-choice strong { font-size: 15px; line-height: 1.25; }
  .cr-choice small { font-size: 12px; line-height: 1.4; color: var(--cr-text-3); }
  .cr-check {
    position: absolute;
    top: 12px; right: 12px;
    width: 20px; height: 20px;
    display: grid; place-items: center;
    border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,.25);
    font-size: 11px;
    font-weight: 800;
    color: transparent;
    transition: background .18s, border-color .18s, color .18s, transform .18s;
  }
  .cr-choice.is-active .cr-check {
    background: var(--cr-brand);
    border-color: var(--cr-brand);
    color: #fff;
    transform: scale(1.08);
  }

  .cr-pw { animation: crFade .2s ease-out; }

  /* ── Optional details (native <details>, zero JS state) ── */
  .cr-more {
    border-radius: 16px;
    background: var(--cr-bg);
    border: 1.5px solid var(--cr-border);
    overflow: hidden;
    transition: border-color .15s;
  }
  .cr-more[open] { border-color: var(--cr-border-hi); }
  .cr-more summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 54px;
    padding: 0 16px;
    list-style: none;
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    -webkit-tap-highlight-color: transparent;
  }
  .cr-more summary::-webkit-details-marker { display: none; }
  .cr-more summary:active { background: rgba(255,255,255,.04); }
  .cr-more summary:focus-visible { outline: 2px solid #a5b4fc; outline-offset: -2px; border-radius: 14px; }
  .cr-more-title { display: inline-flex; align-items: center; gap: 10px; }
  .cr-more-title em { font-style: normal; font-weight: 600; font-size: 12px; color: var(--cr-text-3); }
  .cr-chev {
    width: 10px; height: 10px;
    border-right: 2px solid var(--cr-text-2);
    border-bottom: 2px solid var(--cr-text-2);
    transform: rotate(45deg) translateY(-2px);
    transition: transform .2s;
    flex-shrink: 0;
  }
  .cr-more[open] .cr-chev { transform: rotate(-135deg) translateY(-2px); }
  .cr-more-body { display: flex; flex-direction: column; gap: 10px; padding: 2px 16px 16px; animation: crFade .2s ease-out; }

  /* ── Form-level error ── */
  .cr-form-error {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin: 0;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(251,113,133,.1);
    border: 1px solid rgba(251,113,133,.38);
    color: #fecdd3;
    font-size: 13.5px;
    font-weight: 600;
    line-height: 1.45;
    animation: crFade .2s ease-out;
  }

  /* ── Footer buttons (rendered by <Modal footer>) ── */
  .cr-foot-btn {
    min-height: 50px;
    font-weight: 700;
    -webkit-tap-highlight-color: transparent;
    transition: transform .12s;
  }
  .cr-foot-btn:active { transform: scale(.97); }

  @keyframes crFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  @keyframes crPop  { from { opacity: 0; transform: scale(.96) translateY(-4px); } to { opacity: 1; transform: none; } }

  /* ── Phones ── */
  @media (max-width: 519px) {
    .cr-foot-btn { flex: 1 1 0; }
    .cr-foot-btn[type="submit"] { flex: 1.7 1 0; }
    .cr-preview-thumb { width: 96px; }
  }

  /* ── Very small phones ── */
  @media (max-width: 360px) {
    .cr-form { gap: 18px; }
    .cr-choice { padding: 12px; min-height: 118px; }
    .cr-choice small { font-size: 11.5px; }
    .cr-preview-thumb { width: 84px; }
  }

  /* ── Tablet & up: more room ── */
  @media (min-width: 640px) {
    .cr-form { gap: 26px; }
    .cr-input { min-height: 50px; }
    .cr-choice { padding: 18px; min-height: 132px; }
    .cr-choice strong { font-size: 16px; }
    .cr-choice small { font-size: 12.5px; }
  }

  /* ── Pointer devices only: subtle lift ── */
  @media (hover: hover) {
    .cr-choice:hover:not(.is-active) { background: rgba(255,255,255,.07); }
  }

  @media (prefers-reduced-motion: reduce) {
    .cr-input, .cr-choice, .cr-choice-ico, .cr-check, .cr-chev, .cr-foot-btn { transition: none; }
    .cr-preview, .cr-pw, .cr-error, .cr-more-body, .cr-form-error { animation: none; }
  }
`;

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

  // display-only (derived, not state): thumbnail preview of a valid YouTube link
  const previewId = videoUrl.trim() ? extractVideoId(videoUrl) : null;

  return (
    <Modal title="Create a watch party" description="Set up a room and invite people with a code or link." onClose={onClose}
      footer={<>
        <button type="button" className="btn btn-secondary cr-foot-btn" onClick={onClose}>Cancel</button>
        <button type="submit" form="create-room-form" className="btn btn-primary cr-foot-btn" disabled={busy}>{busy ? 'Creating…' : 'Create room'}</button>
      </>}>
      <style>{styles}</style>
      <form id="create-room-form" onSubmit={submit} noValidate className="cr-form">
        {/* 1 · Name (required) */}
        <div className="cr-field">
          <label className="cr-label" htmlFor="cr-name">
            <span className="cr-label-main"><span className="cr-step" aria-hidden="true">1</span>Room name</span>
            <span className="cr-count">{name.length}/60</span>
          </label>
          <input
            id="cr-name"
            className="cr-input"
            data-autofocus
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friday movie night"
            autoComplete="off"
            enterKeyHint="next"
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? 'cr-name-err' : undefined}
          />
          {errors.name && <p className="cr-error" id="cr-name-err" role="alert"><Icon name="alert" size={14} /> {errors.name}</p>}
        </div>

        {/* 2 · First video (optional, live preview) */}
        <div className="cr-field">
          <label className="cr-label" htmlFor="cr-video">
            <span className="cr-label-main"><span className="cr-step" aria-hidden="true">2</span>First video</span>
            <em>Optional</em>
          </label>
          <div className="cr-input-wrap">
            <span className="cr-lead" aria-hidden="true"><Icon name="film" size={18} /></span>
            <input
              id="cr-video"
              className="cr-input"
              type="url"
              inputMode="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Paste a YouTube link"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              aria-invalid={!!errors.videoUrl}
              aria-describedby={errors.videoUrl ? 'cr-video-err' : undefined}
            />
          </div>
          {errors.videoUrl && <p className="cr-error" id="cr-video-err" role="alert"><Icon name="alert" size={14} /> {errors.videoUrl}</p>}
          {previewId && !errors.videoUrl && (
            <div className="cr-preview">
              <div className="cr-preview-thumb">
                <img src={`https://i.ytimg.com/vi/${previewId}/mqdefault.jpg`} alt="" loading="lazy" />
              </div>
              <div style={{ minWidth: 0 }}>
                <b>✓ Link looks good</b>
                <span>This video will start the party.</span>
              </div>
            </div>
          )}
        </div>

        {/* 3 · Privacy */}
        <fieldset className="cr-field">
          <legend className="cr-label" style={{ marginBottom: 10 }}>
            <span className="cr-label-main"><span className="cr-step" aria-hidden="true">3</span>Who can join?</span>
          </legend>
          <div className="cr-choices" role="radiogroup" aria-label="Privacy">
            {(['public', 'private'] as const).map((p) => (
              <label key={p} className={`cr-choice ${privacy === p ? 'is-active' : ''}`}>
                <input type="radio" name="privacy" checked={privacy === p} onChange={() => setPrivacy(p)} />
                <span className="cr-choice-ico"><Icon name={p === 'public' ? 'globe' : 'lock'} size={18} /></span>
                <strong>{p === 'public' ? 'Public' : 'Private'}</strong>
                <small>{p === 'public' ? 'Listed on Discover. Anyone can join.' : 'Hidden. Join only with the code or link.'}</small>
                <span className="cr-check" aria-hidden="true">✓</span>
              </label>
            ))}
          </div>
        </fieldset>

        {privacy === 'private' && (
          <div className="cr-field cr-pw">
            <label className="cr-label" htmlFor="cr-pw">
              <span className="cr-label-main">Room password</span>
              <em>Optional</em>
            </label>
            <div className="cr-input-wrap">
              <span className="cr-lead" aria-hidden="true"><Icon name="lock" size={18} /></span>
              <input
                id="cr-pw"
                className="cr-input"
                type="password"
                autoComplete="new-password"
                value={password}
                maxLength={64}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Ask for a password to join"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'cr-pw-err' : 'cr-pw-hint'}
              />
            </div>
            {errors.password
              ? <p className="cr-error" id="cr-pw-err" role="alert"><Icon name="alert" size={14} /> {errors.password}</p>
              : <p className="cr-hint" id="cr-pw-hint">At least 4 characters. Leave empty to allow anyone with the code.</p>}
          </div>
        )}

        {/* Optional details — native disclosure, no extra state */}
        <details className="cr-more">
          <summary>
            <span className="cr-more-title">Add a description <em>Optional</em></span>
            <span className="cr-chev" aria-hidden="true" />
          </summary>
          <div className="cr-more-body">
            <label className="cr-label" htmlFor="cr-desc">
              <span className="cr-label-main">What are we watching?</span>
              <span className="cr-count">{description.length}/200</span>
            </label>
            <input
              id="cr-desc"
              className="cr-input"
              value={description}
              maxLength={200}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell people what to expect"
              autoComplete="off"
              enterKeyHint="done"
            />
          </div>
        </details>

        {formError && <p className="cr-form-error" role="alert"><Icon name="alert" size={16} /> {formError}</p>}
      </form>
    </Modal>
  );
}