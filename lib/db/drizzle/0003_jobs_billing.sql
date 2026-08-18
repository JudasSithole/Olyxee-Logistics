-- Jobs + flexible billing.
-- Adds a company-defined Job Number (manual, unique per tenant) and a per-Job
-- billing type. Additive and idempotent so it is safe to run against an
-- existing production database without stranding legacy orders.

-- Company-defined operational reference (e.g. CFS-0024). Nullable so legacy
-- orders that predate this column stay valid; new Jobs require it at the app
-- layer. Uniqueness is enforced per business by the partial index below.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "job_number" text;--> statement-breakpoint

-- Per-Job billing model. Defaults to PREPAID so every existing order keeps the
-- current payment-first behaviour (invoice -> pay -> ship).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "billing_type" text NOT NULL DEFAULT 'PREPAID';--> statement-breakpoint

-- Job Number is unique within a business, never across businesses. Partial
-- index (WHERE job_number IS NOT NULL) lets the many legacy rows keep a NULL
-- job_number without colliding.
CREATE UNIQUE INDEX IF NOT EXISTS "orders_business_job_number_unique"
  ON "orders" ("business_id", "job_number")
  WHERE "job_number" IS NOT NULL;
