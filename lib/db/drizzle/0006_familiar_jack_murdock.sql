ALTER TABLE "enquiries" ADD COLUMN "assigned_to_user_id" uuid;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enquiries" ADD CONSTRAINT "enquiries_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "enquiries_assignee_status_idx" ON "enquiries" USING btree ("assigned_to_user_id","status");