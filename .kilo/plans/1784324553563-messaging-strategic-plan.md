# Order Loop — Messaging Feature Strategic Plan

## Executive Summary

Order Loop is a multi-tenant order-tracking SaaS where the core value loop is:
businesses manage orders → status changes → customers are notified → tracking keeps customers informed.

Today, **notifications are push-only and outbound**: email via Resend, planned SMS, and the
new Retell voice channel. There is **no bidirectional messaging** between any two actors
(staff ↔ customer, staff ↔ staff, system ↔ user).

This plan audits the existing notification substrate and recommends a staged messaging
capability that fits the project's current architecture, multi-tenant isolation model,
and Vercel-serverless constraints.

---

## 1. Audit Findings

### 1.1 Existing messaging/noficiation infrastructure

| Component | What it does | Gap |
|---|---|---|
| `email_notifications` table | Legacy per-order email audit (subject, body, status, providerMessageId) | No in-app equivalent; body is stored but never rendered in-admin |
| `notification_events` + `notification_deliveries` | Newer multi-channel abstraction: one event fans out to N deliveries (email, sms) | Strong foundation — can be extended with an `app` channel without schema churn |
| `recordNotification()` (`lib/notifications.ts`) | Best-effort, non-throwing event/delivery writer | Already the right pattern for "fire and forget" history |
| `sendStatusEmail()` + Resend | Customizable order-status emails with Reply-To to business support | No inbound reply handling; replies go to the business inbox with no ticket linkage |
| Retell voice (just built) | Inbound calls with `call_records`, escalation alerts | No post-call follow-up messaging channel |
| `users` table | Admin/staff accounts (owner, admin, staff) | No presence, no last-seen, no messaging preferences |
| `customers` table | End-customer records (name, email, phone) | No auth, no customer-facing login, no messaging opt-in tracking beyond `notify_on_status_change` |

### 1.2 Architecture constraints

- **Vercel serverless**: long-lived WebSocket connections are expensive/impossible at the
  edge. Any real-time requirement must use **polling** or an external real-time service
  (Pusher, Ably, Supabase Realtime, etc.).
- **Existing auth model**: admin/staff authenticate via httpOnly session cookies.
  Customers have **no login** — they receive tracking links via email/SMS.
- **Multi-tenant isolation**: `businessId` scoping is enforced everywhere via composite
  FKs and `eq(businessesTable.id, businessId)` guards. Any messaging feature must
  preserve this.
- **Notification fan-out**: the `notification_events` → `notification_deliveries` pattern
  is already designed for multi-channel extensibility. Adding an `app` channel type is
  additive and backward-compatible.

### 1.3 Most valuable gaps

1. **No in-app notification center for staff** — order status changes, escalations, and
   limit warnings are only visible via email or by navigating to the relevant page.
2. **No customer ↔ business messaging** — a customer who has a question about an order
   must email/call. There is no threaded conversation tied to an order context.
3. **No internal team coordination** — when a call escalates or a stuck order is flagged,
   there is no way for staff to assign/acknowledge the follow-up inside the app.

---

## 2. Proposed Messaging Features

Based on the audit, I recommend **three messaging primitives**, ordered by value-to-effort:

### 2.1 In-App Notification Center (highest ROI)

**What**: A lightweight notification inbox for logged-in staff.

**Messages**:
- Order status change (created, transitioned, stuck, delivered)
- Call centre escalation (new escalation, resolved)
- Plan/limit warnings (email quota near limit, SMS about to enable)
- System alerts (billing events, audit flags)

**Why it fits**: reuses `notification_events`/`notification_deliveries` almost verbatim.
Add a `channel: "app"` delivery row and a `GET /api/notifications` endpoint that returns
unread counts + paginated rows. No new tables required.

**Technical shape**:
- Extend `DeliveryChannel` union to include `"app"`.
- On every event that already calls `recordNotification()`, also append an `app` delivery
  with status `queued` (or `sent` if the user is currently online — see below).
- New endpoint: `GET /api/notifications` (paginated, filterable by `read/unread`).
- New endpoint: `POST /api/notifications/:id/read` (mark single).
- New endpoint: `POST /api/notifications/read-all` (bulk mark).
- Frontend: bell icon in the app shell + slide-over panel (existing shadcn/ui patterns).

**Real-time**: Vercel serverless makes persistent sockets expensive. Recommended
approach: **polling on interval** (e.g. every 30s when the tab is focused) plus
`visibilitychange` event to pause/resume. Under 100 concurrent staff per tenant, this
is negligible cost.

### 2.2 Customer ↔ Business Order Threads (medium ROI)

**What**: Threaded messaging per order, between the business's staff and the order's
customer.

**Messages**:
- Customer asks a question ("where is my order?")
- Business replies ("delayed by customs, new ETA Friday")
- System notes (auto-escalation context from Retell call)

**Why it fits**: order-centric conversations map directly onto existing `orders` and
`customers` tables. The `message` / `notes` fields on `tracking_events` already capture
admin-authored context — this elevates it to a first-class entity.

**Technical shape**:
- New `message_threads` table: `id`, `businessId`, `orderId` (FK), `customerId` (FK),
  `status` (active, closed), `createdAt`, `updatedAt`.
- New `messages` table: `id`, `threadId` (FK), `senderType` (customer, staff, system),
  `senderId` (nullable — null for system), `body` (text, max 2000), `readAt`
  (nullable), `createdAt`.
- New endpoints under `/api/messages`:
  - `GET /orders/:orderId/messages` — list thread for an order (create thread if absent)
  - `POST /orders/:orderId/messages` — send message (staff only)
  - `POST /api/messages/:id/read` — mark as read
- **Customer access**: customers have no login. Two options:
  1. **Magic-link access**: generate a time-limited signed token, email it, customer
     opens a read-only thread view at `/track/:trackingId?thread=1`.
  2. **SMS link**: short-lived URL sent via SMS (when SMS is enabled).
- Frontend:
  - Admin: inline thread panel on `order-detail.tsx` (reuse existing layout patterns).
  - Customer: minimal public thread page (no auth required, token-scoped).

**Isolation**: thread is always scoped by `businessId` + `customerId` composite FK.
Cross-tenant access is impossible.

### 2.3 Internal Staff Mentions / Assignments (lower ROI, defer)

**What**: @-mention a colleague on an order note, assign an order to a staff member.

**Why defer**: the current user base is small (SMBs, often 1-3 staff). The value is
real but not urgent. Can be layered on top of 2.2 later.

---

## 3. User Scenarios & Value Mapping

| Scenario | Feature | Impact |
|---|---|---|
| Staff sees a delivery is delayed | **2.1** in-app alert appears in bell panel | Reduces context-switching; faster response |
| Call centre escalates a call | **2.1** alert + **2.2** thread auto-created with call context | Links voice and text; no lost context |
| Customer replies to a status email asking "why delayed?" | **2.2** thread surfaces in admin order view | Turns an inbox into a structured conversation |
| Staff wants to tell a customer "out for delivery tomorrow" | **2.2** message sent from order detail | Faster than composing a custom email |
| Admin hits monthly email limit | **2.1** system alert warns before limit | Prevents silent delivery failures |
| Multiple staff share one business account | **2.1** notification center + **2.3** mentions | Coordination without leaving the app |

---

## 4. High-Level Technical Recommendations

### 4.1 Reuse the existing notification substrate

The `notification_events` / `notification_deliveries` model is already the right
abstraction. Treat **in-app notifications (2.1)** as a new delivery channel, not a new
system. This means:

- Zero new tables for feature 2.1.
- `recordNotification()` already writes best-effort; the new `app` channel follows the
  same pattern.
- The existing `DeliveryChannel` type becomes `"email" | "sms" | "app"`.

### 4.2 Keep the serverless constraint front-of-mind

- **No WebSocket servers**. Use polling + `visibilitychange` for real-time-ish UX.
- **No long-polling endpoints** that hold connections. All reads are short REST calls.
- If real-time becomes a hard requirement later, introduce **Supabase Realtime** or
  **Ably** as an optional external dependency behind a feature flag — do not bake it
  into the core architecture now.

### 4.3 Message threads should be order-scoped, not customer-scoped

A thread lives on an **order**, not on a customer. Rationale: the conversation is almost
always about a specific shipment. If the customer has a second order, they get a second
thread. This matches the mental model of "track your order" and keeps FK constraints
simple.

### 4.4 Customer identity stays ephemeral

Do NOT create customer login accounts. For thread access:

1. Admin sends a message → customer gets an email/SMS with a **signed,
   time-limited thread token**.
2. Customer clicks → public thread viewer renders the conversation (read-only
   replies from customer side can POST without auth, validated by the signed token).
3. Token expires after 30 days (configurable per business).

This preserves the current "no customer account" model while enabling the conversation.

### 4.5 Feature-flag every phase

The project already has `featureFlags` in `lib/plans`. Add:

- `inAppNotifications` — gates the notification center UI + endpoints.
- `orderMessaging` — gates message threads.

Both default `false`. Flip only after validation. This is consistent with the existing
`automatedCallCentre` discipline.

### 4.6 Schema migration pattern

Follow the existing additive-migration style in
`scripts/prod-businesses-launch-prep-columns.sql`:

```sql
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS ...;
CREATE TABLE IF NOT EXISTS public.message_threads (...);
CREATE TABLE IF NOT EXISTS public.messages (...);
```

Mirror this in Drizzle (`lib/db/src/schema/`), ship SQL for prod.

### 4.7 Audit + privacy

- Every message insert/read gets an `auditLogs` row (action: `SEND_MESSAGE`,
  `VIEW_THREAD`, `READ_MESSAGE`).
- Message bodies are **not** PII-scrubbed at rest — staff already handles customer
  emails. If compliance requires it, add a `redactOnExport` flag.
- Deletion: soft-delete threads (`deletedAt` timestamp) rather than hard-delete, so
  audit trails remain intact.

### 4.8 Rate limiting

- Thread POST: inherits the existing `apiLimiter` (300/min) — fine.
- Thread GET: inherits `apiLimiter` — fine.
- If a public customer thread endpoint is added, give it its own limiter keyed by the
  signed token to prevent enumeration.

---

## 5. Recommended Implementation Order

| Phase | Scope | Effort | Value |
|---|---|---|---|
| **P1** | In-app notification center (2.1) | 2–3 days | Highest — staff productivity |
| **P2** | Order message threads (2.2) | 3–5 days | High — closes customer communication loop |
| **P3** | Staff mentions/assignments (2.3) | 2–3 days | Medium — team coordination |
| **P4** | Real-time polling + unread badges | 1 day | Polish — improves P1 UX |

Total: ~8–12 days of engineering.

---

## 6. Open Questions (to resolve before implementation)

1. **Customer notification preferences**: should businesses be able to disable customer
   thread access per-customer or per-order? (e.g. a B2B customer who only wants emails)
2. **Thread retention**: how long should public thread tokens remain valid? 7 days?
   30 days? forever until thread is closed?
3. **SMS integration priority**: the existing `notification_deliveries` table already has
   an SMS channel enum. Is there a concrete target date for SMS going live, or should
   messaging be designed SMS-first?
4. **Third-party real-time**: if polling feels insufficient at >50 concurrent staff,
   should we pre-approve a specific real-time vendor (Supabase, Ably) or keep the
   polling primitive and revisit later?

These should be answered in a short design review before P1 starts.
