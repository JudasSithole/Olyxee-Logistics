---
name: Plan catalog (@workspace/plans)
description: How Order Loop plan tiers are defined and why display names differ from internal IDs
---

# Plan catalog — @workspace/plans (`lib/plans/src/index.ts`)

Single source of truth for pricing UI, badges, and (future) enforcement. Both
`landing.tsx` (`PricingSection`) and `upgrade.tsx` render from it.

## Internal plan IDs are FROZEN; display names are separate

The `PlanId` union is `beta | free | pro | business`. These IDs are baked into
the DB enum (`businesses.plan`), the OpenAPI spec, and all generated
zod/types/react-client code. **Do not rename the IDs** to match new marketing
names — it cascades through codegen + a DB migration.

**Why:** A pricing rebrand (Free / Growth / Scale, R0 / R99 / R499) was done by
changing only `plans[id].name` and `plans[id].price`, keeping IDs `pro`/`business`.
So `plans.pro.name === "Growth"` and `plans.business.name === "Scale"`.

## August 2026 restructure: Free + Scale only, SMS removed
`pro` (Growth) is retired: `active: false`, hidden from all pricing surfaces,
and rejected by billing (`isPlanActivatable` in billing routes covers
initialize, verify AND webhook). Scale is R1,499/mo; its unreleased
capabilities live in `PlanConfig.comingSoon` and MUST render with a
"Coming Soon" marker. SMS is removed from the product: `smsNotifications`
flag is false and no pricing/marketing surface may mention SMS (dormant code
and schema deliberately kept). Scale billing starts 30 Sep 2026
(`SCALE_BILLING_START*`, `isScaleBillingLive`); before that date joining Scale
is a non-charging `POST /business/select-plan` (subscriptionStatus "trial"),
after it checkout is required. Free's 50-email cap is enforced at send time via
`effectiveEmailLimit` = min(plan.emailLimit, business.monthlyEmailLimit) —
this applies regardless of the dormant planEnforcement flag.

**How to apply:** When updating pricing copy, edit `name`/`price`/`features` in
the catalog. Never hardcode a plan's display name in JSX — reference
`plans[id].name` (e.g. the upgrade beta-trial banner uses `{plans.pro.name}`).

## Feature bullets live in `PlanConfig.features: string[]`

Marketed bullets per tier come from the `features` array, rendered verbatim by
both pricing surfaces. Earlier they were *derived* from numeric limits
(customerLimit/emailLimit/etc.); that derivation was removed so exact copy is
controlled in one place.

## Numeric limits vs enforcement

`orderLimit` (added), `customerLimit`, `emailLimit`, `smsLimit` feed
`plan-enforcement.ts` (`limitFor`/`checkLimit`). Enforcement is dormant:
`checkLimit` has no callers yet and is gated by `featureFlags.planEnforcement`
(false). Tiers are now order-based, so `orderLimit` is the enforceable field;
`customerLimit` is unset on paid tiers (treated as unlimited).
