import { useId } from 'react';

export function LogoMark({ size = 32 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
          <stop stopColor="#c9e4ff" /><stop offset=".5" stopColor="#6ea8ff" /><stop offset="1" stopColor="#6c63ff" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="#0b1226" />
      <rect x="7" y="11" width="34" height="26" rx="6" stroke={`url(#${id})`} strokeWidth="2.8" />
      <path d="M20 17.5v13l11-6.5-11-6.5z" fill={`url(#${id})`} />
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="logo">
      <LogoMark />
      {!compact && <span className="logo-text">MovieFlex<span className="logo-sub">Watch Party</span></span>}
    </span>
  );
}
