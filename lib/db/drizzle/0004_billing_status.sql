-- Billing status, tracked separately from shipment status.
-- Shipment status (orders.current_status) = where the cargo is.
-- Billing status (this column) = where the invoice/payment is.
-- The two are independent: paying an invoice must never move the shipment, and
-- delivering a shipment must never mark it paid.
-- Lifecycle: NOT_INVOICED -> INVOICED -> AWAITING_PAYMENT -> PAID.
-- Additive + idempotent; defaults so every existing order stays valid.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "billing_status" text NOT NULL DEFAULT 'NOT_INVOICED';--> statement-breakpoint

-- Backfill existing Jobs from their linked invoice so legacy rows read
-- truthfully (billing_status mirrors the invoice lifecycle). Jobs with no
-- invoice stay NOT_INVOICED.
UPDATE "orders" o SET "billing_status" = CASE
  WHEN i."status" = 'paid' THEN 'PAID'
  WHEN i."status" IN ('sent', 'overdue') THEN 'AWAITING_PAYMENT'
  ELSE 'INVOICED'
END
FROM "invoices" i
WHERE o."invoice_id" = i."id";

