---
name: Logistics MVP workflow
description: Agreed design + shipped state of the invoice/payment-gate/warehouse-receipt MVP
---

# Logistics MVP workflow

Shipped (Aug 2026): logistics orders start at AWAITING_PAYMENT; order+invoice created in one transaction with a client idempotency key (replay returns 200 with the existing order); invoice email is post-commit best-effort, outcome recorded on the invoice (lastSendStatus/lastSendError). Mark-paid is idempotent + server-stamped; activation to first active status requires invoice PAID (backend-enforced 409). Warehouse receipts UNMATCHED/MATCHED; matching is transactional, normalizes tracking numbers (strip whitespace, uppercase), advances to RECEIVED_FROM_SUPPLIER only from the first active status, and flags-but-allows cargo-before-payment (order stays blocked).

**Why:** no quotes, no payment gateway in MVP — invoice + manual payment confirmation is the agreed gate; supplier tracking numbers arrive late/hand-typed so they are nullable + normalized + tenant-scoped unique.

**How to apply:** any new order-mutating endpoint must respect the AWAITING_PAYMENT gate; never let clients set AWAITING_PAYMENT manually (422) or supply paidAt/paidConfirmedBy.

Known limitations (deliberate): invoice "PDF" = browser print of /invoices/:id; dashboard stuckShipments hardcoded 0; repo is drizzle-push based (no migration files) — prod schema must be updated via the documented diff-and-ALTER procedure, never push.

Test conventions: api-server routes are tested with a fully mocked `@workspace/db` (mockDb.transaction receives a fake tx with its own insert/update/query chains) and mocked ../lib/auth + ../lib/invoice-email; run tests per-package (`pnpm -r test` fails on lib/plans which has no tests). Demo login is `demo`/`demo` (non-production only); demo business needed `industry: "logistics"` set via PUT /api/business for logistics e2e.
