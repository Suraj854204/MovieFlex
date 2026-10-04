import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <div className="card room-card" key={i}>
          <Skeleton className="thumb" />
          <div className="room-card-body"><Skeleton style={{ height: 16, width: '70%' }} /><Skeleton style={{ height: 12, width: '45%', marginTop: 10 }} /></div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ icon = 'film', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={26} /></span>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = 'Something went wrong' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div className="empty" role="alert">
      <span className="empty-icon danger"><Icon name="alert" size={26} /></span>
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry && <button className="btn btn-secondary" onClick={onRetry}><Icon name="refresh" size={16} /> Try again</button>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner-wrap" role="status"><span className="spinner" aria-hidden="true" />{label && <span>{label}</span>}</span>;
}
