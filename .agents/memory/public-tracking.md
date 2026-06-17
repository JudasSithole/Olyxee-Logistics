---
name: Public order tracking
description: How customers see order status with no login, the email link fallback, and auto-CORS for tenant sites.
---

# Public order tracking

Customers track an order with no login via `GET /api/public/track/:trackingId` (unauth, no PII, no business name leaked, 30s cache). The Olyxee-hosted page that renders it lives in the SPA at `/track?code=<trackingId>` (also `/track/:trackingId`). The email "Track your order" CTA links here.

## Tracking link fallback (buildTrackingLink in api-server orders routes)
A business with its own `websiteUrl` links to *their* `/track?code=` page; a business without one falls back to the Olyxee-hosted base (`PUBLIC_TRACKING_URL` env, default `https://logistics.olyxee.com`).

**Why:** the email template's `safeTrackingLink()` only passes through valid absolute http(s) URLs and silently drops anything else. A bare domain like `example.com` is a valid stored `websiteUrl` (no URL validation on input) but produces a scheme-less, invalid link → the CTA disappears.
**How to apply:** `buildTrackingLink` must normalize `websiteUrl` (add `https://` if scheme-less, parse with `new URL`, require http/https) and fall back to the hosted base on empty/unparseable/non-http input. Never feed a raw, unvalidated `websiteUrl` into the link.

## Auto-CORS for tenant websites
The public tracking endpoint honors per-business origins (`businessesTable.allowedOrigins`, unioned in via env.ts with a 60s cache). On business update, the handler auto-derives the origin from `websiteUrl` and merges it into `allowedOrigins` so a tenant never has to hand-configure CORS to embed tracking. Org-wide origins still go through the `ALLOWED_ORIGINS` env (set per-environment, e.g. production-only — a global value overrides the dev auto-fallback and breaks local cross-origin).
