---
name: Transport-aware logistics flows
description: How AIR/SEA order tracking flows work and the invariants every order-mutating endpoint must uphold.
---

# Transport-aware logistics tracking

- Flow definitions, labels, validation helpers, and email copy live ONLY in `lib/order-statuses/src/logistics.ts` (exported from the package index). Never redefine flows in routes or UI.
- Logistics detection: `businesses.industry` contains "logistics" (UI stores the label "Logistics Company" — NOT lowercase "logistics"). Use `isLogisticsBusiness()` exported from the orders route.
- Invariants EVERY endpoint that creates or mutates orders must uphold (dashboard `/orders`, public API `/v1/orders`, status updates, resend paths):
  - Logistics business ⇒ `transportMode` (AIR|SEA) required at creation; initial status `ORDER_CONFIRMED`.
  - Non-logistics business ⇒ transportMode rejected.
  - Order with `transport_mode` ⇒ status must be in that mode's flow; `DELIVERED` terminal (409 after).
  - Order with NULL `transport_mode` (incl. legacy logistics orders) ⇒ generic flow only; logistics codes rejected. Never auto-assign a mode.
- Customer-facing surfaces (email, SMS, public track page, badges) must show friendly labels via `logisticsStatusLabel()` — raw enum codes must never leak. `statusCopy()` resolves logistics copy by both code and label.
- **Why:** a code-review round caught three bypasses on first implementation: `/v1/orders`, resend-email, and SMS all skipped the new rules. Any new order-mutating endpoint will repeat this unless checked against the list above.
- API contract is generated from `lib/api-spec/openapi.yaml` via `pnpm --filter @workspace/api-spec run codegen` (orval). Status enum in `OrderStatusUpdate` includes logistics codes.
- Prod note: dev uses drizzle push; prod (Supabase) needs a manual `ALTER TABLE orders ADD COLUMN transport_mode text;` before deploying this feature (see prod-schema-drift topic).
