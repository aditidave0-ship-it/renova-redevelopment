CREATE TABLE "feasibility_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "society_id" uuid NOT NULL REFERENCES "societies"("id") ON DELETE CASCADE,
  "submitted_by_user_id" uuid NOT NULL REFERENCES "users"("id"),
  "property_address" text NOT NULL,
  "site_area" varchar(80), "member_count" integer, "building_age" integer,
  "requirement" text NOT NULL, "status" varchar(40) DEFAULT 'SUBMITTED' NOT NULL,
  "assessment_notes" text, "reviewed_by_user_id" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feasibility_society_idx" ON "feasibility_requests"("society_id");
--> statement-breakpoint
CREATE INDEX "feasibility_status_idx" ON "feasibility_requests"("status");
