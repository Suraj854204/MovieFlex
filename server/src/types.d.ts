import type { User } from './db/schema';

declare module 'express-session' {
  interface SessionData { userId?: string }
}
declare module 'express-serve-static-core' {
  interface Request { user?: User }
}
