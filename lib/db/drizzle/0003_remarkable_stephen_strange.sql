CREATE TYPE "public"."feasibility_document_status" AS ENUM('PENDING_UPLOAD', 'AVAILABLE', 'REMOVED');--> statement-breakpoint
CREATE TYPE "public"."feasibility_status" AS ENUM('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'MORE_INFORMATION_REQUIRED', 'ASSESSMENT_READY', 'CLOSED');--> statement-breakpoint
CREATE TABLE "feasibility_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"prepared_by_user_id" uuid NOT NULL,
	"existing_property" text,
	"plot_information" text,
	"existing_built_up_area" text,
	"applicable_planning_inputs" text,
	"potential_development_inputs" text,
	"rehabilitation_requirement" text,
	"potential_sale_component" text,
	"parking_amenity_considerations" text,
	"key_constraints" text,
	"professional_notes" text,
	"documents_reviewed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessment_date" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feasibility_assessments_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "feasibility_assumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feasibility_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"category" varchar(80) NOT NULL,
	"file_name" varchar(500) NOT NULL,
	"content_type" varchar(160) NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_provider" varchar(80) NOT NULL,
	"storage_key" varchar(1000) NOT NULL,
	"checksum_sha256" varchar(64),
	"status" "feasibility_document_status" DEFAULT 'PENDING_UPLOAD' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feasibility_documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "feasibility_property_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"plot_area" varchar(160),
	"number_buildings" integer,
	"number_wings" integer,
	"existing_floors" varchar(160),
	"residential_units" integer,
	"commercial_units" integer,
	"existing_built_up_information" text,
	"approximate_building_age" integer,
	"existing_parking" text,
	"existing_amenities" text,
	"cts_survey_information" text,
	"existing_approved_plans" text,
	"property_card_information" text,
	"conveyance_information" text,
	"existing_fsi_information" text,
	"road_width" varchar(160),
	"reservations_restrictions" text,
	"other_property_information" text,
	"unknown_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feasibility_property_data_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "feasibility_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" varchar(40) NOT NULL,
	"society_id" uuid NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"assigned_reviewer_user_id" uuid,
	"status" "feasibility_status" DEFAULT 'DRAFT' NOT NULL,
	"society_name" varchar(220) NOT NULL,
	"property_address" text NOT NULL,
	"locality" varchar(180) NOT NULL,
	"city" varchar(120) NOT NULL,
	"pin_code" varchar(12) NOT NULL,
	"contact_person" varchar(160) NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"contact_phone" varchar(40) NOT NULL,
	"missing_information" text,
	"submitted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feasibility_requests_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "feasibility_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" "feasibility_status",
	"to_status" "feasibility_status" NOT NULL,
	"changed_by_user_id" uuid NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feasibility_assessments" ADD CONSTRAINT "feasibility_assessments_request_id_feasibility_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."feasibility_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_assessments" ADD CONSTRAINT "feasibility_assessments_prepared_by_user_id_users_id_fk" FOREIGN KEY ("prepared_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_assumptions" ADD CONSTRAINT "feasibility_assumptions_assessment_id_feasibility_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."feasibility_assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_assumptions" ADD CONSTRAINT "feasibility_assumptions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_documents" ADD CONSTRAINT "feasibility_documents_request_id_feasibility_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."feasibility_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_documents" ADD CONSTRAINT "feasibility_documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_property_data" ADD CONSTRAINT "feasibility_property_data_request_id_feasibility_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."feasibility_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_requests" ADD CONSTRAINT "feasibility_requests_society_id_societies_id_fk" FOREIGN KEY ("society_id") REFERENCES "public"."societies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_requests" ADD CONSTRAINT "feasibility_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_requests" ADD CONSTRAINT "feasibility_requests_assigned_reviewer_user_id_users_id_fk" FOREIGN KEY ("assigned_reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_status_history" ADD CONSTRAINT "feasibility_status_history_request_id_feasibility_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."feasibility_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feasibility_status_history" ADD CONSTRAINT "feasibility_status_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feasibility_assumptions_assessment_idx" ON "feasibility_assumptions" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "feasibility_documents_request_idx" ON "feasibility_documents" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "feasibility_property_request_idx" ON "feasibility_property_data" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "feasibility_requests_society_idx" ON "feasibility_requests" USING btree ("society_id");--> statement-breakpoint
CREATE INDEX "feasibility_requests_status_idx" ON "feasibility_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "feasibility_status_history_request_idx" ON "feasibility_status_history" USING btree ("request_id","created_at");