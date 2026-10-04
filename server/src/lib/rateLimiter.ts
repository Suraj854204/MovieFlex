// Tiny in-memory sliding-window limiter for socket events and per-user actions.
// (HTTP routes use express-rate-limit.)
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private sweeper: NodeJS.Timeout;

  constructor(private readonly max: number, private readonly windowMs: number) {
    this.sweeper = setInterval(() => this.sweep(), Math.max(windowMs, 30_000));
    this.sweeper.unref();
  }

  /** Returns true if the action is allowed (and records it). */
  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length >= this.max) { this.hits.set(key, list); return false; }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }

  reset(key: string) { this.hits.delete(key); }

  private sweep() {
    const cutoff = Date.now() - this.windowMs;
    for (const [k, list] of this.hits) {
      const kept = list.filter((t) => t > cutoff);
      if (kept.length) this.hits.set(k, kept); else this.hits.delete(k);
    }
  }
  dispose() { clearInterval(this.sweeper); }
}
