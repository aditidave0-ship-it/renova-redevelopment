CREATE TYPE "public"."professional_specialization" AS ENUM('ADVOCATE_LEGAL', 'ARCHITECT', 'STRUCTURAL_CONSULTANT', 'VALUATION_FINANCE', 'OTHER');--> statement-breakpoint
CREATE TABLE "professional_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"specialization" "professional_specialization" NOT NULL,
	"description" text,
	"public_email" varchar(320),
	"public_phone" varchar(40),
	"website" varchar(500),
	"services" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"credentials" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"marketplace_visible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professional_profiles_organization_id_unique" UNIQUE("organization_id")
);
--> statement-breakpoint
ALTER TABLE "organization_members" ADD COLUMN "role" "account_role";--> statement-breakpoint
ALTER TABLE "professional_profiles" ADD CONSTRAINT "professional_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;