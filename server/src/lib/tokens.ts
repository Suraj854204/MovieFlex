import crypto from 'crypto';
import { config } from '../config';

// Short-lived signed token that lets the browser authenticate its WebSocket
// without relying on third-party cookies (Safari blocks them cross-site).
// Format: base64url(payload).base64url(hmac-sha256)
const TTL_MS = 5 * 60 * 1000;

function sign(data: string): string {
  return crypto.createHmac('sha256', config.sessionSecret).update(`socket:${data}`).digest('base64url');
}

export function createSocketToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: Date.now() + TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySocketToken(token: unknown): string | null {
  if (typeof token !== 'string' || token.length > 400) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  const a = Buffer.from(sig); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof uid !== 'string' || typeof exp !== 'number' || exp < Date.now()) return null;
    return uid;
  } catch { return null; }
}
