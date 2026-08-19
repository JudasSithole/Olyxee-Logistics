-- Finance workspace: actual delivery timestamp + freight job costs.

-- Actual delivered/collected time on a job (distinct from the free-text ETA).
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivered_at" timestamp;

-- Best-effort backfill for jobs already in a terminal state, using updated_at as
-- an approximation of when delivery happened. Covers the new AIR/SEA terminal
-- code and the legacy "Delivered" string; never guesses for non-terminal jobs.
UPDATE "orders"
SET "delivered_at" = "updated_at"
WHERE "delivered_at" IS NULL
  AND "current_status" IN ('DELIVERED_COLLECTED', 'DELIVERED');

-- Freight-specific job costs (one row per cost line, many per job). Amount is a
-- real numeric, unlike the legacy text invoice money columns. No FK on order_id
-- to avoid the orders<->invoices circular-FK class of delete issues; the app
-- scopes every read/write by business_id.
CREATE TABLE IF NOT EXISTS "job_costs" (
  "id" text PRIMARY KEY NOT NULL,
  "business_id" text NOT NULL,
  "order_id" text NOT NULL,
  "category" text NOT NULL DEFAULT 'OTHER',
  "amount" numeric(14, 2) NOT NULL,
  "currency" text NOT NULL DEFAULT 'ZAR',
  "note" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "job_costs_business_order_idx"
  ON "job_costs" ("business_id", "order_id");
