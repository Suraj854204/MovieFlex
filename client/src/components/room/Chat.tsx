import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';
import type { ChatMessage, Role } from '../../lib/types';

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function Chat({ messages, meId, myRole, connected, onSend, onDelete, onClear }: {
  messages: ChatMessage[]; meId: string; myRole: Role; connected: boolean;
  onSend: (text: string) => Promise<unknown>; onDelete: (id: string) => void; onClear: () => void;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [unseen, setUnseen] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const prevCount = useRef(0);

  const toBottom = (smooth = false) => { const el = listRef.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' }); };
  useLayoutEffect(() => {
    const added = messages.length - prevCount.current; prevCount.current = messages.length;
    const last = messages[messages.length - 1];
    if (stick.current || last?.userId === meId) { toBottom(); setUnseen(0); }
    else if (added > 0) setUnseen((n) => n + added);
  }, [messages, meId]);
  useEffect(() => { toBottom(); }, []);

  const onScroll = () => {
    const el = listRef.current; if (!el) return;
    stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (stick.current) setUnseen(0);
  };

  const canDelete = (m: ChatMessage) => {
    if (m.type !== 'user') return false;
    if (m.userId === meId || myRole === 'host') return true;
    return myRole === 'moderator' && m.role !== 'host' && m.role !== 'moderator';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setError('');
    try { await onSend(t); setText(''); stick.current = true; }
    catch (err) { setError((err as Error).message); }
    finally { setSending(false); }
  };

  return (
    <div className="chat">
      <div className="chat-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Chat messages" tabIndex={0}>
        {messages.length === 0 && <div className="chat-empty"><Icon name="message" size={22} /><p>No messages yet. Say hi 👋</p></div>}
        {messages.map((m) => m.type === 'system' ? (
          <div className="msg-system" key={m.id}>{m.text}</div>
        ) : (
          <div className={`msg ${m.userId === meId ? 'mine' : ''}`} key={m.id}>
            <Avatar name={m.displayName ?? '?'} color={m.avatarColor ?? '#626578'} size={30} />
            <div className="msg-main">
              <div className="msg-head">
                <strong className="line-1">{m.displayName}</strong>
                {m.role === 'host' && <span className="role-tag host"><Icon name="crown" size={10} /> Host</span>}
                {m.role === 'moderator' && <span className="role-tag mod"><Icon name="shield" size={10} /> Mod</span>}
                <time className="muted">{time(m.createdAt)}</time>
                {canDelete(m) && <button className="msg-del" aria-label={`Delete message from ${m.displayName}`} onClick={() => onDelete(m.id)}><Icon name="trash" size={13} /></button>}
              </div>
              <p className="msg-text">{m.text}</p>
            </div>
          </div>
        ))}
      </div>
      {unseen > 0 && <button className="new-pill" onClick={() => { toBottom(true); setUnseen(0); }}>{unseen} new message{unseen > 1 ? 's' : ''} ↓</button>}
      <form className="chat-form" onSubmit={submit}>
        {myRole === 'host' && messages.some((m) => m.type === 'user') && (
          <button type="button" className="link-btn" onClick={onClear}>Clear chat</button>
        )}
        {error && <small className="field-error" role="alert">{error}</small>}
        <div className="chat-input-row">
          <input className="input" value={text} maxLength={500} placeholder={connected ? 'Send a message' : 'Reconnecting…'} disabled={!connected}
            aria-label="Message" onChange={(e) => { setText(e.target.value); setError(''); }} />
          <button className="btn btn-primary btn-icon" aria-label="Send message" disabled={!text.trim() || sending || !connected}><Icon name="send" size={16} /></button>
        </div>
        {text.length > 420 && <small className="muted">{500 - text.length} characters left</small>}
      </form>
    </div>
  );
}
