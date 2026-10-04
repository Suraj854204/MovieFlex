-- Upgrade path from the v1 schema (rooms + participants, no accounts). v1 held only
-- throw-away room codes, so it is dropped. Runs only when the old layout is detected.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'rooms')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'rooms' AND column_name = 'host_id') THEN
    DROP TABLE IF EXISTS "participants" CASCADE;
    DROP TABLE IF EXISTS "rooms" CASCADE;
    DROP TYPE IF EXISTS "role";
  END IF;
END $$;
--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('host', 'moderator', 'member');--> statement-breakpoint
CREATE TYPE "public"."message_type" AS ENUM('user', 'system');--> statement-breakpoint
CREATE TYPE "public"."room_privacy" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid,
	"type" "message_type" DEFAULT 'user' NOT NULL,
	"body" varchar(500) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" varchar(240) DEFAULT '' NOT NULL,
	"link" varchar(120),
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "room_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(6) NOT NULL,
	"name" varchar(60) NOT NULL,
	"description" varchar(200) DEFAULT '' NOT NULL,
	"host_id" uuid,
	"privacy" "room_privacy" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"locked" boolean DEFAULT false NOT NULL,
	"max_participants" integer DEFAULT 50 NOT NULL,
	"video_id" varchar(11),
	"video_title" varchar(200),
	"video_thumbnail" text,
	"playing" boolean DEFAULT false NOT NULL,
	"position_sec" double precision DEFAULT 0 NOT NULL,
	"position_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" json NOT NULL,
	"expire" timestamp (6) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(20) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(40) NOT NULL,
	"avatar_color" varchar(9) DEFAULT '#6ea8ff' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watch_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_id" varchar(11) NOT NULL,
	"title" varchar(200) NOT NULL,
	"thumbnail" text NOT NULL,
	"last_position" double precision DEFAULT 0 NOT NULL,
	"room_id" uuid,
	"last_watched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_members" ADD CONSTRAINT "room_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watch_history" ADD CONSTRAINT "watch_history_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messages_room_time_idx" ON "messages" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_time_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "room_members_room_user_uq" ON "room_members" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE INDEX "room_members_user_idx" ON "room_members" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "rooms_code_uq" ON "rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "rooms_host_idx" ON "rooms" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "rooms_discover_idx" ON "rooms" USING btree ("privacy","last_active_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_sessions_expire_idx" ON "user_sessions" USING btree ("expire");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "watch_history_user_video_uq" ON "watch_history" USING btree ("user_id","video_id");--> statement-breakpoint
CREATE INDEX "watch_history_user_time_idx" ON "watch_history" USING btree ("user_id","last_watched_at");