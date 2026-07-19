# Order Loop — AI Call Centre (Retell) Roadmap & Implementation Plan

## Context

Order Loop is a multi-tenant order-tracking / customer-notification SaaS for SMBs
(Express 5 + Postgres/Drizzle + React SPA, deployed on Vercel serverless). A
**Retell AI-powered voice agent** answering inbound customer calls *about their
orders* is already scaffolded but disabled. It is sold as a **Business/Scale-plan**
feature ("Orgni-powered AI Call Agent", "limited AI call minutes included").

Today the scaffolding is inert: `businesses.retellAgentId / retellPhoneNumber /
retellKnowledgeBaseId / callCentreEnabled` columns, a `call_records` table
(`status ∈ {received, in_progress, completed, escalated, failed}`, `escalated`,
`transcript`, `summary`, `orderId`), a `handleRetellEvent` webhook stub that
returns `CallCentreOutcome`, `featureFlags.automatedCallCentre`, and
`RETELL_API_KEY` in `.env.example`. Nothing provisions agents, processes
webhooks, meters minutes, or renders a UI.

This plan turns the scaffold into a shippable feature, reusing existing patterns
(notifications, audit, plan-enforcement, public-tracking serializer, multi-tenant
isolation via composite FK).

## Locked decisions (from interview)

1. **Provider:** Retell AI (keep existing scaffolding; no provider abstraction
   needed — single vendor behind a thin `call-centre.ts` module).
2. **Data fetch:** Live **custom function** (Retell "tool") for order-specific
   queries (status, deliveries, delays, collections) + a **static per-business
   knowledge base** for general business info (hours, policies, address).
3. **Escalation target (launch):** Async — graceful call end, `call_records`
   written with `status:"escalated"`, vendor notified via existing notification
   path. No live human required. (Warm transfer = later opt-in, see Fast-follows.)
4. **Escalation trigger:** Hybrid — LLM intent (`call_analysis`: intent, outcome,
   sentiment) for clean cases + **deterministic guardrails** in the agent system
   prompt that force escalation via an in-call `request_human` function on:
   explicit "speak to a human", repeated order lookup failure (N tries), detected
   complaint/anger (negative sentiment), legal/billing dispute, out-of-scope.
5. **Provisioning:** Self-serve, idempotent, audit-logged per Business-plan
   vendor via a "Connect Call Centre" flow. Reverses/disable on off.
6. **Metering/billing:** Per-call metering via Retell webhook → new `call_usage`
   ledger + per-business monthly `aiCallMinutesUsed`; enforce included cap by
   extending `plan-enforcement.ts` (`LimitKind: "call_minutes"`); overage via
   existing Paystack webhook (`billing_events.dedupe_key`, HMAC-verified).
7. **Dashboard (launch):** Three surfaces reusing existing patterns —
   (a) Settings → Connect Call Centre, (b) Calls list, (c) Call detail drawer —
   plus an escalation badge/count on the existing dashboard KPIs.

## Architecture & Tech Stack

- **Voice/telephony/NLU/TTS/STT:** Retell AI (managed). It owns SIP/PSTN
  termination, streaming STT, LLM turn-taking, TTS, transcript + summary + end-of-call
  analysis, transfer, and webhooks. We run no voice infra — fits Vercel serverless.
- **Webhooks:** Retell POSTs to `POST /api/webhooks/retell` (new route). Authenticated
  by Retell webhook signature (HMAC over raw body — reuse the `rawBody` capture already
  in `app.ts` express.json `verify`).
- **Reverse function call:** Retell calls `POST /api/internal/voice/order-lookup`
  (new internal endpoint) during a call. Authenticated by a shared Retell bearer/secret,
  NOT the admin cookie session.
- **DB:** Postgres/Drizzle; new `call_usage` table; extend `businesses` with
  `aiCallMinutesUsed`, `usagePeriodStart/End` (mirror `smsNotificationsUsed`).
- **Frontend:** React SPA (existing `artifacts/olyxee-admin`), TanStack Query, Tailwind.
- **Existing infra reused:** `recordNotification`+`notification_events/deliveries`,
  `auditLogsTable`, `plan-enforcement.ts` `checkLimit`/`enforceLimits`,
  `public-tracking.ts` serializer (safe-field discipline), composite-FK tenant isolation.

## Implementation phases (ordered task list)

### Phase 0 — Provider module hardening
- Expand `artifacts/api-server/src/lib/call-centre.ts`: real `isCallCentreEnabled`,
  Retell client init from `RETELL_API_KEY`, `verifyRetellSignature(rawBody, sig)`,
  and typed webhook event union (call_started, call_ended, call_analyzed, tool_call).
- Add `RETELL_WEBHOOK_SECRET`, `RETELL_INTERNAL_TOKEN` to `.env.example`.

### Phase 1 — Live order-lookup function (decision 2)
- New internal endpoint `POST /api/internal/voice/order-lookup` (in a new
  `routes/internal-voice.ts`, mounted with adminCors-free strict bearer auth).
- Resolve `businessId` from the called Retell number/agent → `businesses.retellPhoneNumber`.
- Look up order by `trackingId` (netizen-scoped) or `fromNumber`→customer; return
  ONLY safe fields (status, ETA, latest 1–3 tracking events) — mirror
  `public-tracking.ts` serialization. Never return PII/internal notes.
- Register the function + JSON schema in the agent config (Phase 3).

### Phase 2 — Call record lifecycle (decision 3/4)
- Webhook handler writes/updates `call_records`: create on `call_started`
  (`status:"received"`), update on `call_analyzed` (transcript, summary, duration),
  finalize on `call_ended` (status `completed`/`escalated`/`failed`).
- Escalation branch: on `request_human` tool call or guardrail-matching
  `call_analysis`, set `escalated:true`, `status:"escalated"`, persist reason.
- Async escalation end: agent says "flagged with our team"; Order Loop notifies
  vendor via `recordNotification` (email channel, reusing `notification_events/
  deliveries`) + surface count on dashboard.
- All writes best-effort/non-fatal (match `notifications.ts` pattern). Every
  provisioning/escalation action appended to `auditLogsTable`.

### Phase 3 — Self-serve provisioning (decision 5)
- New `routes/call-centre.ts` (admin-authed): `POST /enable`, `POST /disable`,
  `GET /status`.
- `enable`: require Business/Scale plan + `featureFlags.automatedCallCentre`;
  idempotent — if `retellAgentId` already set, reuse; else create Retell agent
  (system prompt with guardrails from decision 4, register order-lookup function,
  attach KB), allocate/assign phone number, create KB seeded from business info
  (hours/address/policies from `businesses`), write IDs back. Wrap in audit log.
- `disable`: pause/teardown Retell agent, clear `callCentreEnabled`.
- Gate behind plan check using `plan-enforcement` + `isFeatureEnabled`.

### Phase 4 — Metering & billing (decision 6)
- New `call_usage` table (`id, businessId, callId, minutes, createdAt`).
- On `call_ended`, compute billable minutes, insert ledger row, increment
  `businesses.aiCallMinutesUsed`.
- Extend `LimitKind` in `plan-enforcement.ts` with `"call_minutes"`; add
  `callMinutesLimit` to `PlanConfig` (e.g. Scale: 100 included). `checkLimit`
  returns blocked at cap; provisioning/calls refuse when exceeded (warn + cap).
- Overage → Paystack `billing_events` (reuse existing HMAC-verified webhook +
  `dedupe_key` idempotency).

### Phase 5 — Dashboard (decision 7)
- `Settings → Connect Call Centre` page: enable/disable, show number, status,
  KB status, included-vs-used minutes (reuse settings page conventions).
- `Calls` list page: `call_records` filtered by business, columns = caller,
  status, escalated badge, duration, time, link to detail.
- `Call detail` drawer: full transcript, Retell summary, escalation reason,
  linked `orderId` (reuse order-detail surface), "follow up with customer"
  action (reuse email/notification + customer surface).
- Dashboard KPI strip: escalation inbox count + calls-today (extend `dashboard` route).

### Phase 6 — Feature-flag rollout & validation
- Flip `featureFlags.automatedCallCentre` true only after Phases 0–5 pass in test.
- Test gate: `RETELL_API_KEY` + `RETELL_WEBHOOK_SECRET` + Business plan; `503`
  while flag false (keep parity with `v1.ts` gating).

## Risks / edge cases (validate against these)
- **Tenant isolation:** function-call lookup MUST scope to resolved businessId; a
  caller quoting another vendor's tracking ID must not leak data. Reuse composite-FK
  discipline; assert businessId match before any read.
- **Webhook replay/spoofing:** verify Retell signature over raw body; ignore
  unknown `call_id`; make writes idempotent on `call_id`.
- **Agent provisioning failure midway:** idempotent + audit-logged; partial state
  must be recoverable by re-running `enable`.
- **Minute metering drift:** compute from Retell `call_duration` (server truth),
  not client guess; ledger is source of truth, counter is cache (recomputable).
- **Out-of-scope requests:** guardrail prompt + `request_human` must trip before
  the agent invents answers. Test with adversarial prompts.

## Fast-follows (explicitly out of scope for launch)
- **Warm transfer** to a configured, available human number (presence/availability
  state + fallback to async when no one is online).
- **Structured escalation inbox/ticket** surface (vs bare notification).
- **Analytics suite:** sentiment trends, resolution-rate, per-agent metrics.
- **SMSPortal/voice to field agent** on escalation (multi-tenant branding in text).

## Validation plan
1. Unit: `validateTransition`-style guardrail decision logic for escalation
   (extracted pure function) — cover all 5 guardrail cases + clean resolve.
2. Integration (test env, flag on): Retell test number → call about a known
   order → assert live function returns current status, transcript + summary
   persisted, `call_records.status:"completed"`.
3. Escalation: call requesting "speak to a human" / adversarial → assert
   `escalated:true`, vendor notification sent, dashboard count increments.
4. Metering: assert `call_usage` rows + `aiCallMinutesUsed` increment; at cap,
   new enable/call refused.
5. Tenant test: vendor B calls quoting vendor A's tracking ID → 404/empty, no leak.
6. Webhook security: unsigned/replayed payload rejected (403/ignored).
7. `pnpm run typecheck` + `pnpm run build` green; lint clean.

## Affected boundaries (existing files)
- `artifacts/api-server/src/lib/call-centre.ts` (expand)
- `artifacts/api-server/src/routes/` (new `internal-voice.ts`, `call-centre.ts`,
  `webhooks/retell.ts`; mount points in `routes/index.ts`)
- `artifacts/api-server/src/lib/plan-enforcement.ts` (add `call_minutes`)
- `lib/db/src/schema/{businesses,call_records}.ts` (extend) + new `call_usage.ts`
- `lib/plans/src/index.ts` (add `callMinutesLimit` to PlanConfig; flip flag at rollout)
- `artifacts/olyxee-admin/src/pages/` (new `call-centre-settings.tsx`,
  `calls.tsx`, `call-detail` drawer; extend `dashboard.tsx`, `settings.tsx`)
- `.env.example` (Retell webhook secret + internal token)
