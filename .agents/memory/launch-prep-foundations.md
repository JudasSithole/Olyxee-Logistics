---
name: Launch-prep feature-flag foundations
description: Durable rules for the disabled launch-prep foundations (billing, SMS, branding, public API, call centre, enforcement) so they can't leak while off.
---

The launch-prep release ships DISABLED foundations. All future capabilities are gated by a central `featureFlags` map (all false) that also holds the plan catalog and launch/trial dates.

**Rule:** every new capability must self-gate and no-op / return 503 / fall back to defaults while its flag is false. Never let credentials alone activate a feature.
**Why:** the release must not change current product behaviour or move real money; flags are the single kill-switch.

Durable decisions worth keeping consistent:
- **Route gates must be path-scoped, not catch-all.** An unscoped middleware gate mounted on a parent router silently swallows ALL unmatched routes (turned a 404 into a 503 once). Always scope the gate to the feature's path prefix.
- **Billing is intentionally TEST-only and env-gated, NOT flag-gated.** It runs only with an explicit test-mode env flag AND a test-mode secret key; a live key is refused, so production (env unset) is safe. This is the deliberate "dev test control" — flipping the public billing flag is a separate future step.
- **Money integrity is non-negotiable:** activation must validate the amount actually paid against the plan's price, and idempotency logic must only treat unique-constraint violations as "already processed" — any other DB error must propagate.
- **New announcement/pricing pages are public.** Logged-out visitors get them (with public site chrome + nav tabs); authenticated users get the same pages inside the app layout. Don't wrap them auth-only.
- **The shared notification service records additively/best-effort** and must never throw into the request path; the legacy email flow stays the source of truth for existing UI.
