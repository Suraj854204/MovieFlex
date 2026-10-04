export type Role = 'host' | 'moderator' | 'member';
export type Privacy = 'public' | 'private';

export interface User {
  id: string; username: string; displayName: string; avatarColor: string;
  email: string; createdAt: string; online: boolean;
}
export interface PublicUser { id: string; username: string; displayName: string; avatarColor: string; online?: boolean }

export interface RoomCardData {
  id: string; code: string; name: string; description: string; privacy: Privacy;
  locked: boolean; hasPassword: boolean; maxParticipants: number;
  host: PublicUser | null;
  video: { videoId: string; title: string; thumbnail: string; playing: boolean } | null;
  participantCount: number; live: boolean; createdAt: string; lastActiveAt: string;
  myRole?: Role | null;
}

export interface Participant {
  userId: string; username: string; displayName: string; avatarColor: string; role: Role; online: boolean;
}

export interface VideoPayload {
  videoId: string | null; title: string | null; thumbnail: string | null;
  playing: boolean; time: number; updatedAt: number; serverNow: number; rev: number; by?: string | null;
}

export interface RoomSettings {
  name: string; description: string; privacy: Privacy; locked: boolean;
  hasPassword: boolean; maxParticipants: number; hostId: string | null;
}

export interface ChatMessage {
  id: string; type: 'user' | 'system'; userId: string | null; username: string | null;
  displayName: string | null; avatarColor: string | null; role: string | null; text: string; createdAt: number;
}

export interface NotificationItem {
  id: string; type: string; title: string; body: string; link: string | null; read: boolean; createdAt: string;
}
export interface HistoryItem {
  id: string; videoId: string; title: string; thumbnail: string; lastPosition: number; lastWatchedAt: string;
}

export const REACTIONS = ['❤️', '😂', '🔥', '😮', '👏', '👍'] as const;
