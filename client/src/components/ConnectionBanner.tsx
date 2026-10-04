import { Icon } from './ui/Icon';
import { useSocket } from '../context/SocketContext';

export function ConnectionBanner() {
  const { status } = useSocket();
  if (status === 'connected') return null;
  const text = status === 'offline' ? "You're offline. We'll reconnect automatically."
    : status === 'reconnecting' ? 'Connection lost. Reconnecting…' : 'Connecting…';
  return (
    <div className={`conn-banner ${status}`} role="status" aria-live="polite">
      <Icon name={status === 'offline' ? 'wifiOff' : 'refresh'} size={15} className={status === 'offline' ? '' : 'spin'} /> {text}
    </div>
  );
}
