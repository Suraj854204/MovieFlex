import type { Server } from 'socket.io';

// Module-level handle so REST routes/services can broadcast without importing the server.
let ioRef: Server | null = null;
export const setIO = (io: Server) => { ioRef = io; };
export const getIO = (): Server | null => ioRef;

export const roomChannel = (code: string) => `room:${code}`;
export const userChannel = (userId: string) => `user:${userId}`;

export function emitToRoom(code: string, event: string, payload?: unknown) {
  ioRef?.to(roomChannel(code)).emit(event, payload);
}
export function emitToUser(userId: string, event: string, payload?: unknown) {
  ioRef?.to(userChannel(userId)).emit(event, payload);
}
