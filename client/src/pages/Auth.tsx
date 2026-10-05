import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../context/AuthContext';
import { ApiError, errMsg } from '../lib/api';

const authStyles = `
  .ap-root, .ap-root *, .ap-root *::before, .ap-root *::after { box-sizing: border-box; }
  .ap-root {
    min-height: 100dvh;
    width: 100%;
    display: grid;
    grid-template-columns: 1fr;
    background: var(--bg);
    color: var(--text);
  }

  /* ───────── Brand panel (laptop only) ───────── */
  .ap-aside {
    display: none;
    position: relative;
    overflow: hidden;
    padding: 56px 64px;
    background:
      radial-gradient(90% 70% at 0% 0%, rgba(110,168,255,.22) 0%, transparent 60%),
      radial-gradient(80% 70% at 100% 100%, rgba(108,99,255,.2) 0%, transparent 60%),
      var(--bg-elev);
    border-right: 1px solid var(--line);
  }
  .ap-aside-inner {
    position: relative;
    height: 100%;
    max-width: 560px;
    margin-inline: auto;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 40px;
  }
  .ap-aside a { text-decoration: none; }
  .ap-eyebrow {
    margin: 0 0 14px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .ap-headline {
    margin: 0 0 16px;
    font-size: clamp(2.2rem, 3.4vw, 3.2rem);
    line-height: 1.08;
    letter-spacing: -.03em;
    font-weight: 800;
  }
  .ap-lead {
    margin: 0;
    max-width: 46ch;
    font-size: 1.05rem;
    line-height: 1.6;
    color: var(--text-2);
  }
  .ap-points {
    display: grid;
    gap: 14px;
    margin: 32px 0 0;
    padding: 0;
    list-style: none;
  }
  .ap-points li {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px 16px;
    border-radius: var(--r-md);
    background: rgba(255,255,255,.03);
    border: 1px solid var(--line);
  }
  .ap-check {
    flex: none;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 13px;
    font-weight: 800;
  }
  .ap-points b { display: block; font-size: .95rem; margin-bottom: 2px; }
  .ap-points span { font-size: .85rem; color: var(--text-3); line-height: 1.45; }
  .ap-foot-note { font-size: .8rem; color: var(--text-3); }

  /* ───────── Form side ───────── */
  .ap-main {
    min-width: 0;
    display: grid;
    place-items: center;
    padding: 24px 16px;
    background:
      radial-gradient(700px 360px at 50% -10%, rgba(110,168,255,.12), transparent),
      var(--bg);
  }
  .ap-card {
    width: 100%;
    max-width: 440px;
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: var(--shadow);
  }
  .ap-card h1 { font-size: clamp(1.5rem, 4vw, 1.9rem); }
  .ap-card form { margin-top: 18px; }
  .ap-card .input { min-height: 46px; }
  .ap-card .btn-primary { min-height: 48px; font-size: 1rem; margin-top: 4px; }
  .ap-logo-mobile { margin-bottom: 14px; align-self: flex-start; }
  .ap-foot {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid var(--line);
    text-align: center;
    font-size: .9rem;
  }

  /* ───────── Tablet ───────── */
  @media (min-width: 640px) {
    .ap-main { padding: 40px 24px; }
    .ap-card { padding: 36px 36px; }
  }

  /* ───────── Laptop / Desktop: split screen ───────── */
  @media (min-width: 960px) {
    .ap-root { grid-template-columns: minmax(0, 1.05fr) minmax(420px, .95fr); }
    .ap-aside { display: block; }
    .ap-logo-mobile { display: none; }
    .ap-main { padding: 48px; }
    .ap-card {
      max-width: 460px;
      padding: 40px;
      background: transparent;
      border: 0;
      box-shadow: none;
    }
  }

  @media (min-width: 1440px) {
    .ap-aside { padding: 72px 96px; }
    .ap-card { max-width: 480px; }
  }

  @media (max-width: 380px) {
    .ap-card { padding: 24px 18px; }
  }
`;

function useNext(): string {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/home';
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => { document.title = `${title} · MovieFlex Watch Party`; }, [title]);
  return (
    <div className="ap-root">
      <style>{authStyles}</style>

      {/* Brand panel: visible on laptop / desktop only */}
      <aside className="ap-aside" aria-hidden="true">
        <div className="ap-aside-inner">
          <Link to="/" tabIndex={-1}><Logo /></Link>

          <div>
            <p className="ap-eyebrow">Watch Party</p>
            <h2 className="ap-headline">Watch together, in perfect sync.</h2>
            <p className="ap-lead">
              Create a private room, share the code, and enjoy videos with friends while you chat live.
            </p>
            <ul className="ap-points">
              <li>
                <span className="ap-check">✓</span>
                <div><b>Synced playback</b><span>Everyone sees the same moment, at the same time.</span></div>
              </li>
              <li>
                <span className="ap-check">✓</span>
                <div><b>Live chat and reactions</b><span>Talk and react without leaving the video.</span></div>
              </li>
              <li>
                <span className="ap-check">✓</span>
                <div><b>Join with a code</b><span>Start a room in under a minute.</span></div>
              </li>
            </ul>
          </div>

          <p className="ap-foot-note">© MovieFlex Watch Party</p>
        </div>
      </aside>

      {/* Form side */}
      <main className="ap-main">
        <div className="ap-card card">
          <Link to="/" className="ap-logo-mobile" aria-label="MovieFlex home"><Logo /></Link>
          <h1>{title}</h1>
          <p className="muted-2">{subtitle}</p>
          {children}
          <p className="ap-foot muted-2">{footer}</p>
        </div>
      </main>
    </div>
  );
}

export function LoginPage() {
  const { login, sessionExpired, clearExpired } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) { setError('Enter your email or username and password.'); return; }
    setBusy(true); setError('');
    try { await login(identifier.trim(), password); navigate(next, { replace: true }); }
    catch (err) { setError(err instanceof ApiError && err.code === 'INVALID_CREDENTIALS' ? 'Incorrect email/username or password.' : errMsg(err)); setBusy(false); }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to join your watch parties." footer={<>New here? <Link to="/signup" state={{ from: next }}>Create an account</Link></>}>
      {sessionExpired && (
        <div className="notice" role="status"><Icon name="info" size={16} /> Your session expired. Please sign in again.
          <button className="btn btn-ghost btn-icon" onClick={clearExpired} aria-label="Dismiss"><Icon name="x" size={14} /></button></div>
      )}
      <form onSubmit={submit} noValidate className="stack">
        <label className="field"><span>Email or username</span>
          <input className="input" autoComplete="username" autoFocus value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label>
        <label className="field"><span>Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {error && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {error}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [f, setF] = useState({ displayName: '', username: '', email: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); setErrors({ ...errors, [k]: '' }); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v: Record<string, string> = {};
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(f.username.trim())) v.username = '3–20 characters: letters, numbers, underscores.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) v.email = 'Enter a valid email address.';
    if (f.password.length < 8) v.password = 'Use at least 8 characters.';
    setErrors(v); setFormError('');
    if (Object.keys(v).length) return;
    setBusy(true);
    try {
      await signup({ username: f.username.trim(), email: f.email.trim(), password: f.password, displayName: f.displayName.trim() || undefined });
      navigate(next, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.details) setErrors(err.details); else setFormError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="It's free. Start a room in under a minute." footer={<>Already have an account? <Link to="/login" state={{ from: next }}>Sign in</Link></>}>
      <form onSubmit={submit} noValidate className="stack">
        <label className="field"><span>Display name <em>(optional)</em></span>
          <input className="input" autoComplete="name" autoFocus maxLength={40} value={f.displayName} onChange={set('displayName')} /></label>
        <label className="field"><span>Username</span>
          <input className="input" autoComplete="username" maxLength={20} value={f.username} onChange={set('username')} aria-invalid={!!errors.username} />
          {errors.username && <small className="field-error">{errors.username}</small>}</label>
        <label className="field"><span>Email</span>
          <input className="input" type="email" autoComplete="email" value={f.email} onChange={set('email')} aria-invalid={!!errors.email} />
          {errors.email && <small className="field-error">{errors.email}</small>}</label>
        <label className="field"><span>Password</span>
          <input className="input" type="password" autoComplete="new-password" maxLength={72} value={f.password} onChange={set('password')} aria-invalid={!!errors.password} />
          {errors.password ? <small className="field-error">{errors.password}</small> : <small className="muted">At least 8 characters.</small>}</label>
        {formError && <p className="form-error" role="alert"><Icon name="alert" size={16} /> {formError}</p>}
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthLayout>
  );
}