// Global "is this user connected anywhere" map (sockets per user).
const sockets = new Map<string, number>();

export const presence = {
  connect(userId: string) { sockets.set(userId, (sockets.get(userId) ?? 0) + 1); },
  disconnect(userId: string) {
    const n = (sockets.get(userId) ?? 1) - 1;
    if (n <= 0) sockets.delete(userId); else sockets.set(userId, n);
  },
  isOnline(userId: string) { return sockets.has(userId); },
  onlineCount() { return sockets.size; },
};
