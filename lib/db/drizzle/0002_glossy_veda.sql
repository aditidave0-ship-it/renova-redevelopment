CREATE TABLE "developer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"logo_url" varchar(1000),
	"description" text,
	"website" varchar(500),
	"public_email" varchar(320),
	"public_phone" varchar(40),
	"office_location" varchar(220),
	"areas_served" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specializations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"team_information" text,
	"portfolio" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"marketplace_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "developer_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
CREATE TABLE "pmc_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"logo_url" varchar(1000),
	"description" text,
	"website" varchar(500),
	"public_email" varchar(320),
	"public_phone" varchar(40),
	"office_location" varchar(220),
	"locations_served" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"specializations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"team_information" text,
	"portfolio" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"marketplace_visible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pmc_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "opportunity_interests" ADD COLUMN "review_status" varchar(32) DEFAULT 'RECEIVED' NOT NULL;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "contact_name" varchar(160);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "contact_email" varchar(320);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "contact_phone" varchar(40);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "number_buildings" integer;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "number_wings" integer;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "unit_count" integer;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "property_type" varchar(120);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "land_area" varchar(120);--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "societies" ADD COLUMN "marketplace_visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "developer_profiles" ADD CONSTRAINT "developer_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pmc_profiles" ADD CONSTRAINT "pmc_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;