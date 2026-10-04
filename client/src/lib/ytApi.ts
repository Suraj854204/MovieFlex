declare global {
  interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void }
}

let pending: Promise<any> | null = null;

/** Loads the YouTube IFrame API once. Rejects after 15s so the UI can offer a retry. */
export function loadYouTubeApi(): Promise<any> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    const timer = setTimeout(() => { pending = null; reject(new Error('timeout')); }, 15_000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timer); prev?.(); resolve(window.YT); };
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api'; s.async = true; s.dataset.ytApi = '1';
      s.onerror = () => { clearTimeout(timer); pending = null; document.querySelector('script[data-yt-api]')?.remove(); reject(new Error('blocked')); };
      document.head.appendChild(s);
    }
  });
  return pending;
}
