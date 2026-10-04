import crypto from 'crypto';

// No 0/O/1/I/L — easy to read aloud and type on a phone.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateRoomCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) out += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return out;
}

export const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;
export function normaliseCode(input: string): string {
  return String(input ?? '').trim().toUpperCase();
}

const AVATAR_COLORS = ['#6ea8ff', '#8b7bff', '#2dd4bf', '#f472b6', '#fb923c', '#facc15', '#4ade80', '#38bdf8'];
export function randomAvatarColor(): string {
  return AVATAR_COLORS[crypto.randomInt(AVATAR_COLORS.length)];
}
export const AVATAR_PALETTE = AVATAR_COLORS;
