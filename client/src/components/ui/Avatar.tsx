import { initials } from '../../lib/format';

export function Avatar({ name, color, size = 36, online, title }: { name: string; color: string; size?: number; online?: boolean; title?: string }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: Math.max(11, size * 0.38) }} title={title ?? name} aria-hidden="true">
      {initials(name)}
      {online !== undefined && <span className={`presence-dot ${online ? 'on' : ''}`} />}
    </span>
  );
}
