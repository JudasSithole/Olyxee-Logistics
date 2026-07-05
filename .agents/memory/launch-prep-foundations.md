---
name: Launch-prep feature-flag foundations
description: How the disabled launch-prep foundations (billing, SMS, branding, public API, call centre, enforcement) are gated so they can't leak while off.
---

The launch-prep release ships DISABLED foundations. Central config is `@workspace/plans` (`lib/plans/src/index.ts`): plan catalog, `featureFlags` (all false), `orderLoopLaunch` dates, `computeCountdown`.

**Rule:** every new capability must self-gate and no-op / return 503 / fall back to defaults while its flag is false. Never let credentials alone activate a feature.

**Why:** the release must not change current product behaviour or move real money; flags are the single kill-switch.

**How to apply:**
- Backend service modules live in `artifacts/api-server/src/lib/` (sms, notifications, branding, paystack, call-centre, plan-enforcement). Each checks `isFeatureEnabled(...)` and returns an inert result when off.
- Route-level gates must be PATH-SCOPED: use `router.use("/v1", gate)` not `router.use(gate)`. An unscoped `router.use` gate mounted via `router.use(childRouter)` becomes a catch-all for ALL unmatched routes (once caused `/api/nope` → 503 instead of 404).
- Billing is TEST-ONLY and intentionally gated by env, NOT the `subscriptionBilling` flag: `isTestBillingEnabled()` requires `ENABLE_TEST_BILLING=1` AND a `sk_test_` key. A live key is refused, so production (env unset) is safe. This is the deliberate "dev test control"; the frontend enables the checkout button only when `import.meta.env.DEV && !subscriptionBilling`.
- Paystack webhook verifies HMAC-SHA512 over the RAW body — `express.json({ verify })` stashes `req.rawBody` for this.
- Plan activation (verify + webhook) must validate `amountMinor === planAmountMinor(plan)` before activating, and `activatePlan` idempotency must only swallow Postgres unique violations (`err.code === "23505"`) — rethrow other DB errors.
- Notification service (`lib/notifications.ts`) is wired into the order-status handler ADDITIVELY and best-effort (never throws into the request path); the legacy `email_notifications` write stays the source of truth for existing UI.
