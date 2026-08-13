# AI Call Centre Architecture

## Overview

An AI-powered inbound call centre built on **Retell AI** that answers customer calls, looks up orders, and escalates to humans when needed. Operates as three surfaces in the Olyxee Logistics admin panel and a set of server-to-server endpoints for Retell callbacks.

---

## Feature Flags & Plan Gating

| Flag | Scope |
|---|---|
| `featureFlags.automatedCallCentre` | Must be `true` for any call-centre route to work |
| `plan.automatedCallCentre` | Only `business` plan (R499/mo) includes call centre access |
| `process.env.RETELL_API_KEY` | Must be present or the feature is hard-disabled |

During the beta launch-prep, the feature is **hidden** behind `featureFlags.automatedCallCentre = false`. Production enables both the flag and the Retell API key.

---

## Three Admin Surfaces

| Surface | Route | Purpose |
|---|---|---|
| Call Centre Settings | `/call-centre` | Enable/disable, view config, enter forwarding number |
| Calls List | `/calls` | Browse recent inbound call records |
| Call Detail | `/calls/:id` | Transcript, AI summary, escalation status, linked order |

A live indicator on the dashboard shows `escalatedCallsToday` and `callsToday`.

---

## Database Schema

### `businesses` (existing table + new column)

```sql
callCentreEnabled          BOOLEAN DEFAULT FALSE
retellAgentId              TEXT      NULLABLE
retellPhoneNumber          TEXT      NULLABLE
retellKnowledgeBaseId      TEXT      NULLABLE
callCentreForwardingNumber TEXT      NULLABLE   -- customer's existing phone number
aiCallMinutesUsed          INTEGER   DEFAULT 0
```

### `call_records` (new table)

| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT PK | Internal record ID |
| `businessId` | TEXT FK | Owning business |
| `retellCallId` | TEXT UNIQUE | Retell's call ID for webhook correlation |
| `fromNumber` | TEXT NULL | Caller's phone number |
| `orderId` | TEXT NULL | Linked order (set by order_lookup tool) |
| `status` | TEXT | `received` / `in_progress` / `completed` / `escalated` / `failed` |
| `transcript` | TEXT NULL | Full call transcript |
| `summary` | TEXT NULL | AI-generated call summary |
| `escalated` | BOOLEAN DEFAULT FALSE | Whether call was escalated |
| `createdAt` | TIMESTAMP | When record was created |

### `call_usage` (new table)

| Column | Type | Purpose |
|---|---|---|
| `id` | TEXT PK | Usage record ID |
| `businessId` | TEXT FK | Owning business |
| `callId` | TEXT UNIQUE FK | Links to `call_records.retellCallId` |
| `minutes` | INTEGER DEFAULT 0 | Billable minutes for this call |
| `createdAt` | TIMESTAMP | When usage was recorded |

---

## Enable Flow (`POST /api/call-centre/enable`)

Idempotent. If already enabled, returns current state without re-provisioning.

```
1. Plan check → must be Business plan
2. If Retell agent missing → create agent with order_lookup + request_human tools
3. If phone number missing → search + buy + assign Retell number to agent
4. If knowledge base missing → create KB and seed business info docs
5. Set callCentreEnabled = true
6. Log ENABLE_CALL_CENTRE audit entry
7. Return agentId, phoneNumber, knowledgeBaseId, forwardingNumber
```

### Retell Agent Configuration

| Setting | Value |
|---|---|
| Response Engine | `retell-llm` |
| Voice | `11labs-Adrian` |
| Language | `en-US` |
| Begin Message | "Hi, thanks for calling. How can I help you today?" |
| End Call Phrases | ["Thank you for calling, goodbye."] |

### Custom Tools

#### `order_lookup`
- **URL:** `POST /api/internal/voice/order-lookup`
- **Auth:** Shared bearer token (`RETELL_INTERNAL_TOKEN`)
- **Parameters:** `call_id`, `from_number`, `to_number`, `tracking_id?`, `attempt`
- **Returns:** Order status, tracking events, estimated delivery

#### `request_human`
- **URL:** `POST /api/internal/voice/request-human`
- **Auth:** Shared bearer token (`RETELL_INTERNAL_TOKEN`)
- **Parameters:** `call_id`, `reason?`
- **Effect:** Marks call as escalated, sends notification email to business

---

## Disable Flow (`POST /api/call-centre/disable`)

Best-effort teardown — failures are logged but don't block:

```
1. Delete Retell agent (if exists)
2. Delete Retell phone number (if exists)
3. Clear all Retell fields on business record
4. Log DISABLE_CALL_CENTRE audit entry
```

---

## Call Flow (Inbound)

```
Customer calls business number
         │
         ▼
Carrier forwards to Retell phone number
         │
         ▼
Retell triggers webhook → POST /api/webhooks/retell
         │
         ▼
Server verifies HMAC-SHA256 signature
         │
         ▼
Server resolves businessId from called Retell number
         │
         ▼
Server sends notification email to business supportEmail
         │
         ▼
Retell AI agent answers + handles conversation
   ├─ Uses order_lookup tool to check order status
   └─ Uses request_human tool to escalate when needed
         │
         ▼
Call ends → call.ended webhook
         │
         ▼
Server persists transcript, summary, escalation status
   ├─ Writes to call_records table
   ├─ Records usage in call_usage table
   └─ Increments aiCallMinutesUsed on business
```

---

## Webhook Events

| Event | Server Action |
|---|---|
| `call.started` | Create `call_records` entry with status `received` |
| `call.ended` | Update transcript/summary, set status, record usage minutes |
| `call.analyzed` | Update summary on existing record |
| `call.tool_call` | If tool is `request_human`, mark record as escalated |

---

## Escalation Logic (Hybrid)

Escalation happens via three mechanisms:

1. **Explicit tool call** — AI uses `request_human` when customer says "speak to a human"
2. **System prompt guardrails** — Rules embedded in the agent prompt define out-of-scope topics that trigger escalation
3. **Tool-call event** — Server detects `request_human` in webhook and marks record as escalated

When escalated:
- `call_records.status` → `escalated`
- `call_records.escalated` → `true`
- Notification email sent to business `supportEmail`

---

## Usage Metering

- Per-call minutes recorded in `call_usage` table (idempotent on `callId`)
- `businesses.aiCallMinutesUsed` incremented atomically via SQL
- Plan limit: `business` plan gets 100 minutes/month (`callMinutesLimit`)
- Enforcement is disabled during beta (`featureFlags.planEnforcement = false`)
- Overage billed through existing Paystack webhook infrastructure

---

## API Endpoints

### Admin (authenticated)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/call-centre/status` | Get current config + canEnable flag |
| POST | `/api/call-centre/enable` | Provision Retell resources + enable |
| POST | `/api/call-centre/disable` | Teardown Retell resources + disable |
| GET | `/api/call-centre/calls` | List 100 most recent calls |
| GET | `/api/call-centre/calls/:callId` | Get single call record |

### Internal (Retell server-to-server)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/internal/voice/order-lookup` | Bearer token | Look up order by tracking ID or caller phone |
| POST | `/api/internal/voice/request-human` | Bearer token | Mark call as escalated + notify business |

### Webhooks (Retell → Server)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/webhooks/retell` | HMAC-SHA256 | Receive call lifecycle events |

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `RETELL_API_KEY` | Yes | Retell API authentication |
| `RETELL_WEBHOOK_SECRET` | Yes | HMAC secret for webhook signature verification |
| `RETELL_INTERNAL_TOKEN` | Yes | Bearer token for internal voice endpoints |
| `APP_BASE_URL` | Yes | Base URL for Retell server-to-server callbacks |

---

## File Inventory

| File | Role |
|---|---|
| `lib/db/src/schema/businesses.ts` | Business table schema with Retell columns |
| `lib/db/src/schema/call_usage.ts` | Call usage tracking table |
| `lib/plans/src/index.ts` | Plan catalog + feature flags |
| `artifacts/api-server/src/lib/call-centre.ts` | Retell API client + webhook types + utilities |
| `artifacts/api-server/src/routes/call-centre.ts` | Admin CRUD routes for call centre |
| `artifacts/api-server/src/routes/internal-voice.ts` | Internal endpoints for Retell tool callbacks |
| `artifacts/api-server/src/routes/webhooks/retell.ts` | Retell webhook handler |
| `artifacts/olyxee-admin/src/pages/call-centre-settings.tsx` | Admin settings page with enable/disable + forwarding number |
| `artifacts/olyxee-admin/src/pages/calls.tsx` | Call records list page |
| `artifacts/olyxee-admin/src/pages/call-detail.tsx` | Single call detail page |
| `lib/api-spec/openapi.yaml` | API specification |
