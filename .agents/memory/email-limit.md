---
name: Monthly email limit
description: How the per-business monthly email-sending cap is modeled and enforced
---

# Per-business monthly email limit

Each business has a `monthlyEmailLimit` (default 500). Usage = count of `email_notifications` rows with `status="sent"` in the current UTC calendar month, scoped to a business by **joining `email_notifications -> orders`** (notifications have NO `businessId` column). When usage >= limit, the send is skipped and a notification row is recorded with `status="limit_reached"`.

**Why the join:** `email_notifications` is keyed by `orderId` only; the business is reachable solely through `orders.businessId`. Any per-business usage query must go through that join.

**Enforcement is intentionally best-effort, not atomic.** The check is count-then-send (no DB lock / reservation), so two truly-concurrent sends at the boundary could overshoot by 1. This is acceptable: the product targets ~5 businesses sending order-status emails on manual admin clicks (near-zero concurrency), and the cap only exists to stay under Resend's free tier (~3,000/mo). Do NOT add transactional locking / counter rows unless scale changes — it would be over-engineering here.

**"Upgrade" = manual.** There is no payment integration; raising a business's limit is a manual admin action on `monthlyEmailLimit`.

**Status enum lives in three places that must stay in sync:** the DB enum (`email_notifications.ts`), and the OpenAPI schemas (`EmailNotification.status` AND `StatusUpdateResult`/`EmailResendResult` emailStatus). Regenerate api-zod/api-client after any spec change.

**Demo business** is hardcoded (not in DB) and returns `monthlyEmailLimit: 500`, `emailUsageThisMonth: 0`.
