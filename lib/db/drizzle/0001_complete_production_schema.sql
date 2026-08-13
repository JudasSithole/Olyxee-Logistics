CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" text PRIMARY KEY NOT NULL,
	"dedupe_key" text NOT NULL,
	"event_type" text NOT NULL,
	"reference" text,
	"business_id" text,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_dedupe_key_key" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "business_workflows" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"template_id" text NOT NULL,
	"template_name" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "business_workflows_business_id_unique" UNIQUE("business_id")
);
--> statement-breakpoint
CREATE TABLE "call_records" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"retell_call_id" text,
	"from_number" text,
	"order_id" text,
	"status" text DEFAULT 'received' NOT NULL,
	"transcript" text,
	"summary" text,
	"escalated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "call_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"call_id" text NOT NULL,
	"minutes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "call_usage_call_id_unique" UNIQUE("call_id")
);
--> statement-breakpoint
CREATE TABLE "workflow_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"business_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflow_steps" (
	"id" text PRIMARY KEY NOT NULL,
	"template_id" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"position" integer NOT NULL,
	"color" text,
	"is_terminal" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"business_id" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"channel" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"recipient" text NOT NULL,
	"provider_message_id" text,
	"failure_reason" text,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"customer_phone" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"customer_id" text NOT NULL,
	"order_id" text NOT NULL,
	"subtotal" text NOT NULL,
	"additional_charges" text DEFAULT '0' NOT NULL,
	"total" text NOT NULL,
	"currency" text DEFAULT 'ZAR' NOT NULL,
	"due_date" timestamp,
	"status" text DEFAULT 'draft' NOT NULL,
	"sent_at" timestamp,
	"paid_at" timestamp,
	"payment_confirmed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "invoices_business_number_unique" UNIQUE("business_id","invoice_number")
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "monthly_email_limit" integer DEFAULT 500 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "plan" text DEFAULT 'beta' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "subscription_status" text DEFAULT 'beta' NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "trial_starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "trial_ends_at" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "billing_customer_code" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "billing_subscription_code" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "billing_email_token" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "current_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "current_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "email_notifications_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "sms_notifications_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "ai_call_minutes_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "usage_period_start" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "usage_period_end" timestamp;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "business_logo_url" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "email_sender_name" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "primary_brand_colour" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "remove_olyxee_branding" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "call_centre_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "retell_agent_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "retell_phone_number" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "retell_knowledge_base_id" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "call_centre_forwarding_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "transport_mode" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "supplier_tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "supplier_tracking_number_added_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "supplier_tracking_number_added_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cargo_type" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "service_required" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "origin" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "destination" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "weight" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dimensions" text;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_workflows" ADD CONSTRAINT "business_workflows_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_records" ADD CONSTRAINT "call_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "call_usage" ADD CONSTRAINT "call_usage_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_steps" ADD CONSTRAINT "workflow_steps_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_event_id_notification_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."notification_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_notifications" ADD CONSTRAINT "sms_notifications_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_business_status_idx" ON "invoices" USING btree ("business_id","status");--> statement-breakpoint
CREATE INDEX "invoices_order_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_business_order_reference_idx" ON "orders" USING btree ("business_id","order_reference");--> statement-breakpoint
CREATE INDEX "orders_business_supplier_tracking_idx" ON "orders" USING btree ("business_id","supplier_tracking_number");
--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_supplier_tracking_added_by_users_id_fk" FOREIGN KEY ("supplier_tracking_number_added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_business_supplier_tracking_unique" ON "orders" USING btree ("business_id","supplier_tracking_number") WHERE "supplier_tracking_number" IS NOT NULL;
