CREATE EXTENSION IF NOT EXISTS "pgcrypto";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "alert_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"target" text NOT NULL,
	"status" text NOT NULL,
	"payload" text,
	"error" text,
	"sent_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"due_in_days" integer,
	"scheduled_for" timestamp with time zone NOT NULL,
	"severity" text DEFAULT 'low',
	"channel" text DEFAULT 'telegram',
	"message" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"label" text NOT NULL,
	"hostname" text NOT NULL,
	"provider" text NOT NULL,
	"expiry_date" text NOT NULL,
	"status" text DEFAULT 'healthy',
	"renewal_url" text,
	"notes" text,
	"last_checked" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"avatar" text,
	"is_admin" boolean DEFAULT false NOT NULL
);
