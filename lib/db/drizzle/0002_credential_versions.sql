ALTER TABLE "users" ADD COLUMN "credential_version" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "credential_version" integer DEFAULT 0 NOT NULL;
