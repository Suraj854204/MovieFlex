import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';
import { Icon } from '../components/ui/Icon';
import { useAuth } from '../context/AuthContext';
import { ApiError, errMsg } from '../lib/api';

function useNext(): string {
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from;
  return from && from.startsWith('/') && !from.startsWith('//') ? from : '/home';
}

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: React.ReactNode; footer: React.ReactNode }) {
  useEffect(() => { document.title = `${title} · MovieFlex Watch Party`; }, [title]);
  return (
    <div className="auth-page">
      <div className="auth-card card">
        <Link to="/" className="auth-logo" aria-label="MovieFlex home"><Logo /></Link>
        <h1>{title}</h1>
        <p className="muted-2">{subtitle}</p>
        {children}
        <p className="auth-foot muted-2">{footer}</p>
      </div>
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
