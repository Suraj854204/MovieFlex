import type { MemberRole, Privacy } from '../db/schema';

export interface Profile { userId: string; username: string; displayName: string; avatarColor: string }
export interface Participant extends Profile { role: MemberRole; online: boolean }

export interface VideoState {
  videoId: string | null;
  title: string | null;
  thumbnail: string | null;
  playing: boolean;
  position: number;       // seconds, valid at `updatedAt`
  updatedAt: number;      // epoch ms the position was anchored
  rev: number;            // bumps on every authoritative change (guards stale heartbeats)
}

export interface VideoPayload {
  videoId: string | null; title: string | null; thumbnail: string | null;
  playing: boolean; time: number; updatedAt: number; serverNow: number; rev: number;
  by?: string | null;
}

interface PresenceEntry { sockets: Set<string>; joinedAt: number }

/**
 * In-memory state for one active room: who is connected, their durable roles
 * (cached from room_members) and the authoritative playback clock.
 * Single-process by design — see README "Known limitations".
 */
export class LiveRoom {
  readonly id: string;
  readonly code: string;
  name: string;
  description: string;
  privacy: Privacy;
  locked: boolean;
  hasPassword: boolean;
  maxParticipants: number;
  hostId: string | null;
  createdAt: Date;

  /** userId → role for every non-banned member */
  readonly roles = new Map<string, MemberRole>();
  readonly banned = new Set<string>();
  readonly profiles = new Map<string, Profile>();
  readonly presence = new Map<string, PresenceEntry>();
  readonly graceTimers = new Map<string, NodeJS.Timeout>();

  video: VideoState;

  hostTimer?: NodeJS.Timeout;
  evictTimer?: NodeJS.Timeout;
  persistTimer?: NodeJS.Timeout;

  constructor(init: {
    id: string; code: string; name: string; description: string; privacy: Privacy;
    locked: boolean; hasPassword: boolean; maxParticipants: number; hostId: string | null;
    createdAt: Date; video: Omit<VideoState, 'rev'>;
  }) {
    Object.assign(this, init);
    this.id = init.id; this.code = init.code; this.name = init.name;
    this.description = init.description; this.privacy = init.privacy; this.locked = init.locked;
    this.hasPassword = init.hasPassword; this.maxParticipants = init.maxParticipants;
    this.hostId = init.hostId; this.createdAt = init.createdAt;
    this.video = { ...init.video, rev: 1 };
  }

  // ── Presence ────────────────────────────────────────────────────────────────
  isOnline(userId: string) { return this.presence.has(userId); }
  /** true while at least one person is connected */
  live() { return this.presence.size > 0; }
  onlineCount() { return this.presence.size; }

  /** @returns true when this is the user's first connection to the room */
  addSocket(userId: string, socketId: string): boolean {
    let entry = this.presence.get(userId);
    const first = !entry;
    if (!entry) { entry = { sockets: new Set(), joinedAt: Date.now() }; this.presence.set(userId, entry); }
    entry.sockets.add(socketId);
    return first;
  }

  /**
   * Detaches one socket. The presence entry is kept (with zero sockets) so a quick
   * refresh/reconnect doesn't flicker — the lifecycle code drops it after a grace period.
   * @returns true when the user has no sockets left in the room
   */
  removeSocket(userId: string, socketId: string): boolean {
    const entry = this.presence.get(userId);
    if (!entry) return false;
    entry.sockets.delete(socketId);
    return entry.sockets.size === 0;
  }

  dropPresence(userId: string) { this.presence.delete(userId); }

  socketsOf(userId: string): string[] { return [...(this.presence.get(userId)?.sockets ?? [])]; }

  // ── Roles ───────────────────────────────────────────────────────────────────
  roleOf(userId: string): MemberRole | undefined { return this.roles.get(userId); }
  canControl(userId: string) { const r = this.roles.get(userId); return r === 'host' || r === 'moderator'; }
  isHost(userId: string) { return this.roles.get(userId) === 'host'; }

  participants(): Participant[] {
    const out: Participant[] = [];
    for (const [userId, role] of this.roles) {
      const online = this.presence.has(userId);
      if (!online && role === 'member') continue;       // hide offline plain members
      const p = this.profiles.get(userId);
      if (!p) continue;
      out.push({ ...p, role, online });
    }
    const rank = { host: 0, moderator: 1, member: 2 } as const;
    return out.sort((a, b) =>
      rank[a.role] - rank[b.role] || Number(b.online) - Number(a.online) ||
      a.displayName.localeCompare(b.displayName));
  }

  /** Earliest-joined online moderator, else earliest-joined online member. */
  pickSuccessor(excludeUserId?: string): string | null {
    const online = [...this.presence.entries()]
      .filter(([id]) => id !== excludeUserId && this.roles.has(id))
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    return online.find(([id]) => this.roles.get(id) === 'moderator')?.[0] ?? online[0]?.[0] ?? null;
  }

  // ── Playback clock ──────────────────────────────────────────────────────────
  currentTime(now = Date.now()): number {
    const v = this.video;
    return v.playing ? v.position + Math.max(0, now - v.updatedAt) / 1000 : v.position;
  }

  private anchor(patch: Partial<Pick<VideoState, 'playing' | 'position'>>) {
    this.video = { ...this.video, ...patch, updatedAt: Date.now(), rev: this.video.rev + 1 };
  }

  /** Each returns false when the command is a no-op (same state) so we don't re-broadcast. */
  play(time: number): boolean {
    if (!this.video.videoId) return false;
    if (this.video.playing && Math.abs(this.currentTime() - time) < 1) return false;
    this.anchor({ playing: true, position: time }); return true;
  }
  pause(time: number): boolean {
    if (!this.video.videoId) return false;
    if (!this.video.playing && Math.abs(this.video.position - time) < 0.75) return false;
    this.anchor({ playing: false, position: time }); return true;
  }
  seek(time: number): boolean {
    if (!this.video.videoId) return false;
    if (Math.abs(this.currentTime() - time) < 0.75) return false;
    this.anchor({ position: time }); return true;
  }
  changeVideo(meta: { videoId: string; title: string; thumbnail: string }) {
    this.video = { ...meta, playing: true, position: 0, updatedAt: Date.now(), rev: this.video.rev + 1 };
  }

  /**
   * Periodic report from a controller's actual player. Ignored if it refers to a
   * stale revision (someone else changed state meanwhile) or disagrees on play/pause.
   */
  heartbeat(rev: number, time: number, playing: boolean): 'ignored' | 'ok' | 'corrected' {
    const v = this.video;
    if (!v.videoId || rev !== v.rev || playing !== v.playing) return 'ignored';
    if (Math.abs(this.currentTime() - time) <= 1.5) {
      v.position = time; v.updatedAt = Date.now();    // quietly track the host's real position
      return 'ok';
    }
    this.anchor({ position: time });
    return 'corrected';
  }

  payload(by?: string | null): VideoPayload {
    const v = this.video;
    return {
      videoId: v.videoId, title: v.title, thumbnail: v.thumbnail, playing: v.playing,
      time: v.position, updatedAt: v.updatedAt, serverNow: Date.now(), rev: v.rev, by: by ?? null,
    };
  }

  settings() {
    return {
      name: this.name, description: this.description, privacy: this.privacy, locked: this.locked,
      hasPassword: this.hasPassword, maxParticipants: this.maxParticipants, hostId: this.hostId,
    };
  }

  clearTimers() {
    for (const t of this.graceTimers.values()) clearTimeout(t);
    this.graceTimers.clear();
    clearTimeout(this.hostTimer); clearTimeout(this.evictTimer); clearTimeout(this.persistTimer);
  }
}
