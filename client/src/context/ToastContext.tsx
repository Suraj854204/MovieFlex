import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/ui/Icon';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; text: string }
interface ToastApi { success: (t: string) => void; error: (t: string) => void; info: (t: string) => void }

const Ctx = createContext<ToastApi>({ success() {}, error() {}, info() {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: Kind, text: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t.filter((x) => x.text !== text).slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3800);
  }, []);

  const api = useMemo<ToastApi>(() => ({
    success: (t) => push('success', t), error: (t) => push('error', t), info: (t) => push('info', t),
  }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={t.kind === 'success' ? 'check' : t.kind === 'error' ? 'alert' : 'info'} size={16} />
            <span>{t.text}</span>
            <button className="toast-x" aria-label="Dismiss" onClick={() => setToasts((l) => l.filter((x) => x.id !== t.id))}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
export const useToast = () => useContext(Ctx);
