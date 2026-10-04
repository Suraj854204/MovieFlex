import type { User } from '../db/schema';
import { presence } from '../realtime/presence';

export const publicUser = (u: Pick<User, 'id' | 'username' | 'displayName' | 'avatarColor'>) => ({
  id: u.id, username: u.username, displayName: u.displayName, avatarColor: u.avatarColor,
});

/** Shape returned to the account owner. Never includes passwordHash. */
export const selfUser = (u: User) => ({
  ...publicUser(u),
  email: u.email,
  createdAt: u.createdAt,
  online: presence.isOnline(u.id),
});
