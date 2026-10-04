import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ui/Icon';

/** Accepts a bare code or a full invite link. */
export function parseRoomCode(input: string): string | null {
  const m = input.trim().toUpperCase().match(/(?:ROOM\/)?([A-Z0-9]{6})\/?$/);
  return m ? m[1] : null;
}

export function JoinByCode({ autoFocus = false }: { autoFocus?: boolean }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = parseRoomCode(value);
    if (!code) { setError('Enter a 6-character room code or an invite link.'); return; }
    navigate(`/room/${code}`);
  };
  return (
    <form onSubmit={submit} className="join-form" noValidate>
      <div className="join-row">
        <input className="input input-code" value={value} autoFocus={autoFocus} aria-label="Room code or invite link" aria-invalid={!!error}
          placeholder="Room code or link" onChange={(e) => { setValue(e.target.value); setError(''); }} />
        <button className="btn btn-secondary" type="submit"><Icon name="play" size={14} /> Join</button>
      </div>
      {error && <small className="field-error">{error}</small>}
    </form>
  );
}
