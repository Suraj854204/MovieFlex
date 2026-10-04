import {
  pgTable, pgEnum, uuid, text, timestamp, boolean, integer, doublePrecision,
  uniqueIndex, index, varchar, json,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ── Enums ─────────────────────────────────────────────────────────────────────
export const memberRoleEnum = pgEnum('member_role', ['host', 'moderator', 'member']);
export const privacyEnum    = pgEnum('room_privacy', ['public', 'private']);
export const messageTypeEnum = pgEnum('message_type', ['user', 'system']);

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  username:     varchar('username', { length: 20 }).notNull(),   // stored lower-case
  email:        varchar('email', { length: 254 }).notNull(),     // stored lower-case
  passwordHash: text('password_hash').notNull(),
  displayName:  varchar('display_name', { length: 40 }).notNull(),
  avatarColor:  varchar('avatar_color', { length: 9 }).notNull().default('#6ea8ff'),
  createdAt:    timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt:   timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  usernameUq: uniqueIndex('users_username_uq').on(t.username),
  emailUq:    uniqueIndex('users_email_uq').on(t.email),
}));

// ── Rooms ─────────────────────────────────────────────────────────────────────
// Durable room record. Live presence lives in memory (realtime/LiveRoom.ts);
// the playback snapshot is persisted so a server restart can restore it.
export const rooms = pgTable('rooms', {
  id:               uuid('id').primaryKey().defaultRandom(),
  code:             varchar('code', { length: 6 }).notNull(),
  name:             varchar('name', { length: 60 }).notNull(),
  description:      varchar('description', { length: 200 }).notNull().default(''),
  hostId:           uuid('host_id').references(() => users.id, { onDelete: 'set null' }),
  privacy:          privacyEnum('privacy').notNull().default('public'),
  passwordHash:     text('password_hash'),                    // private rooms only
  locked:           boolean('locked').notNull().default(false),
  maxParticipants:  integer('max_participants').notNull().default(50),
  videoId:          varchar('video_id', { length: 11 }),
  videoTitle:       varchar('video_title', { length: 200 }),
  videoThumbnail:   text('video_thumbnail'),
  playing:          boolean('playing').notNull().default(false),
  positionSec:      doublePrecision('position_sec').notNull().default(0),
  positionUpdatedAt: timestamp('position_updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt:     timestamp('last_active_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  codeUq:     uniqueIndex('rooms_code_uq').on(t.code),
  hostIdx:    index('rooms_host_idx').on(t.hostId),
  discoverIdx: index('rooms_discover_idx').on(t.privacy, t.lastActiveAt),
}));

// ── Room members (durable roles, enables rejoin) ──────────────────────────────
export const roomMembers = pgTable('room_members', {
  id:         uuid('id').primaryKey().defaultRandom(),
  roomId:     uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId:     uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role:       memberRoleEnum('role').notNull().default('member'),
  banned:     boolean('banned').notNull().default(false),
  joinedAt:   timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  roomUserUq: uniqueIndex('room_members_room_user_uq').on(t.roomId, t.userId),
  userIdx:    index('room_members_user_idx').on(t.userId, t.lastSeenAt),
}));

// ── Chat messages ─────────────────────────────────────────────────────────────
export const messages = pgTable('messages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  roomId:    uuid('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
  userId:    uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  type:      messageTypeEnum('type').notNull().default('user'),
  body:      varchar('body', { length: 500 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  roomTimeIdx: index('messages_room_time_idx').on(t.roomId, t.createdAt),
}));

// ── Watch history (one row per user+video) ────────────────────────────────────
export const watchHistory = pgTable('watch_history', {
  id:            uuid('id').primaryKey().defaultRandom(),
  userId:        uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId:       varchar('video_id', { length: 11 }).notNull(),
  title:         varchar('title', { length: 200 }).notNull(),
  thumbnail:     text('thumbnail').notNull(),
  lastPosition:  doublePrecision('last_position').notNull().default(0),
  roomId:        uuid('room_id').references(() => rooms.id, { onDelete: 'set null' }),
  lastWatchedAt: timestamp('last_watched_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userVideoUq: uniqueIndex('watch_history_user_video_uq').on(t.userId, t.videoId),
  userTimeIdx: index('watch_history_user_time_idx').on(t.userId, t.lastWatchedAt),
}));

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = pgTable('notifications', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 32 }).notNull(),
  title:     varchar('title', { length: 120 }).notNull(),
  body:      varchar('body', { length: 240 }).notNull().default(''),
  link:      varchar('link', { length: 120 }),
  readAt:    timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  userTimeIdx: index('notifications_user_time_idx').on(t.userId, t.createdAt),
  unreadIdx:   index('notifications_unread_idx').on(t.userId).where(sql`${t.readAt} is null`),
}));

// ── HTTP session store (connect-pg-simple) ────────────────────────────────────
export const userSessions = pgTable('user_sessions', {
  sid:    varchar('sid').primaryKey(),
  sess:   json('sess').notNull(),
  expire: timestamp('expire', { precision: 6, mode: 'date' }).notNull(),
}, (t) => ({
  expireIdx: index('user_sessions_expire_idx').on(t.expire),
}));

// ── Inferred types ────────────────────────────────────────────────────────────
export type User          = typeof users.$inferSelect;
export type Room          = typeof rooms.$inferSelect;
export type RoomMember    = typeof roomMembers.$inferSelect;
export type MemberRole    = (typeof memberRoleEnum.enumValues)[number];
export type Privacy       = (typeof privacyEnum.enumValues)[number];
