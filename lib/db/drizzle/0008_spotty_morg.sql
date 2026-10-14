CREATE TABLE "enquiry_email_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enquiry_id" uuid NOT NULL,
	"kind" varchar(24) NOT NULL,
	"status" varchar(32) DEFAULT 'QUEUED' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"provider_message_id" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enquiry_email_kind_values" CHECK ("enquiry_email_jobs"."kind" IN ('ACKNOWLEDGEMENT','ADMIN')),
	CONSTRAINT "enquiry_email_status_values" CHECK ("enquiry_email_jobs"."status" IN ('QUEUED','ACCEPTED','NOT_CONFIGURED','RETRY','MANUAL_REVIEW'))
);
--> statement-breakpoint
CREATE TABLE "sandbox_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"product_code" varchar(80) NOT NULL,
	"product_name" varchar(220) NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"mode" varchar(16) DEFAULT 'SANDBOX' NOT NULL,
	"status" varchar(40) DEFAULT 'CREATING' NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"provider_order_id" varchar(100),
	"provider_payment_id" varchar(100),
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_orders_provider_order_id_unique" UNIQUE("provider_order_id"),
	CONSTRAINT "sandbox_orders_provider_payment_id_unique" UNIQUE("provider_payment_id"),
	CONSTRAINT "sandbox_order_mode_only" CHECK ("sandbox_orders"."mode" = 'SANDBOX'),
	CONSTRAINT "sandbox_order_amount_positive" CHECK ("sandbox_orders"."amount_minor" > 0),
	CONSTRAINT "sandbox_order_status_values" CHECK ("sandbox_orders"."status" IN ('CREATING','PENDING','PAID','RECONCILIATION_REQUIRED'))
);
--> statement-breakpoint
CREATE TABLE "sandbox_payment_events" (
	"event_id" varchar(160) PRIMARY KEY NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sandbox_products" (
	"code" varchar(80) PRIMARY KEY NOT NULL,
	"name" varchar(220) NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"approval_reference" varchar(220) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_product_amount_positive" CHECK ("sandbox_products"."amount_minor" > 0),
	CONSTRAINT "sandbox_product_currency_inr" CHECK ("sandbox_products"."currency" = 'INR')
);
--> statement-breakpoint
CREATE TABLE "sandbox_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"reference" varchar(60) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sandbox_receipts_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "sandbox_receipts_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
ALTER TABLE "enquiry_email_jobs" ADD CONSTRAINT "enquiry_email_jobs_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_orders" ADD CONSTRAINT "sandbox_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_orders" ADD CONSTRAINT "sandbox_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_orders" ADD CONSTRAINT "sandbox_orders_product_code_sandbox_products_code_fk" FOREIGN KEY ("product_code") REFERENCES "public"."sandbox_products"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_payment_events" ADD CONSTRAINT "sandbox_payment_events_order_id_sandbox_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sandbox_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sandbox_receipts" ADD CONSTRAINT "sandbox_receipts_order_id_sandbox_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."sandbox_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enquiry_email_kind_idx" ON "enquiry_email_jobs" USING btree ("enquiry_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "sandbox_order_user_key_idx" ON "sandbox_orders" USING btree ("user_id","idempotency_key");