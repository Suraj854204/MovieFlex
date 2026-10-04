import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/ui/Modal';

interface Options { title: string; message: ReactNode; confirmLabel?: string; danger?: boolean }
type ConfirmFn = (o: Options) => Promise<boolean>;
const Ctx = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve; setOpts(o);
  }), []);

  const close = (v: boolean) => { resolver.current?.(v); resolver.current = null; setOpts(null); };

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {opts && (
        <Modal title={opts.title} size="sm" onClose={() => close(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => close(false)}>Cancel</button>
            <button className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`} data-autofocus onClick={() => close(true)}>{opts.confirmLabel ?? 'Confirm'}</button>
          </>}>
          <div className="muted-2">{opts.message}</div>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
export const useConfirm = () => useContext(Ctx);
