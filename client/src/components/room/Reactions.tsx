import { useCallback, useEffect, useRef, useState } from 'react';
import { REACTIONS } from '../../lib/types';
import type { Reaction } from '../../hooks/useRoomSession';

interface Floating extends Reaction { left: number }

/** Floating emoji overlay; entries remove themselves, nothing is stored. */
export function useFloatingReactions() {
  const [items, setItems] = useState<Floating[]>([]);
  const timers = useRef<number[]>([]);
  const add = useCallback((r: Reaction) => {
    setItems((l) => [...l.slice(-24), { ...r, left: 8 + Math.random() * 84 }]);
    const t = window.setTimeout(() => setItems((l) => l.filter((x) => x.id !== r.id)), 2600);
    timers.current.push(t);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return { items, add };
}

export function FloatingLayer({ items }: { items: Floating[] }) {
  return <>{items.map((r) => <span key={r.id} className="floater" style={{ left: `${r.left}%` }}><span>{r.emoji}</span><small>{r.displayName.split(' ')[0]}</small></span>)}</>;
}

export function ReactionBar({ onReact, disabled }: { onReact: (emoji: string) => void; disabled: boolean }) {
  return (
    <div className="reaction-bar" role="group" aria-label="Send a reaction">
      {REACTIONS.map((e) => <button key={e} className="reaction-btn" disabled={disabled} onClick={() => onReact(e)} aria-label={`React ${e}`}>{e}</button>)}
    </div>
  );
}
