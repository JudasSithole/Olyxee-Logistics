# Show live shipment tracking on your own website

This guide is for an Olyxee Logistics business (and its web developer) that wants
customers to see their order status **on the business's own website** — not only
on the Olyxee-hosted tracking page.

You do **not** need a backend, an API key, or a login to do this. It's a few lines
of HTML/JavaScript that read live data from one public URL.

---

## The two ways a customer can track a shipment

Every order gets a **tracking ID** (e.g. `OLY-ABC-2345`). A customer can reach
their live status two ways, and both show the **same** data:

| Path | Where it goes | Setup |
|------|---------------|-------|
| **"Track shipment" button in the email** | The Olyxee-hosted page, branded with your logo & colour | None — works out of the box |
| **A "Track" page on your own website** | Your domain, your design | This guide |

The hosted page is the safe default (it always works, even before your site is
ready). Adding tracking to your own website simply gives customers a second,
on-brand place to check in — using the exact same live data.

---

## How it works

Your page reads the tracking ID from the link the customer clicked, asks Olyxee's
public tracking API for that shipment's status, and draws it on the page. That's it.

```mermaid
flowchart LR
    A["Customer opens<br/>yourshop.co.za/track?code=OLY-ABC-2345"] --> B["Your page reads<br/>the code from the URL"]
    B --> C["fetch() Olyxee public API<br/>GET /api/public/track/OLY-ABC-2345"]
    C --> D["JSON: status, timeline,<br/>events, ETA, your branding"]
    D --> E["Your page renders it"]
```

Key properties of the public tracking API:

- **Read-only and public** — no login, no API key, no secrets in your page.
- **No customer PII** — it never returns the customer's name, address, phone,
  email, price, or which other businesses use Olyxee. Only the parcel's status.
- **Cached ~30 seconds** — cheap to call; don't poll faster than that.

---

## Step 1 — Authorise your website (one-time)

Browsers block a website from reading another domain's API unless that API opts in
(this is called CORS). Olyxee opts your site in automatically:

> **Add your website URL in Settings** (or during onboarding). Olyxee takes the
> **origin** of that URL and allows it to read the public tracking API.

An **origin** is just `scheme + host`, e.g. `https://yourshop.co.za`. A few things
to know:

- `https://yourshop.co.za` and `https://www.yourshop.co.za` are **different**
  origins. If you use both, add both (Settings → **Allowed website origins**
  accepts a comma-separated list).
- Use `https://` in production. `http://` origins are only for local testing.
- No trailing path — `https://yourshop.co.za`, not `https://yourshop.co.za/track`.

If a page on an un-authorised origin calls the API, the browser blocks it and you'll
see a CORS / **403 Origin not allowed** error in the console. Fixing it is just
adding that origin above.

---

## Step 2 — Add a tracking page to your website

Create a page on your site at a stable path, for example:

```
https://yourshop.co.za/track
```

Your customer-facing links then carry the tracking ID as a `code` query parameter
(this matches the format Olyxee's own links use):

```
https://yourshop.co.za/track?code=OLY-ABC-2345
```

Drop the ready-made page into that route:

- **[`examples/olyxee-tracking-embed.html`](examples/olyxee-tracking-embed.html)** —
  a complete, self-contained tracking page (plain HTML + CSS + JavaScript, no build
  step, no dependencies). It reads `?code=`, calls the API, and renders the status,
  the step-by-step timeline, the event history, and the ETA, with loading / not-found
  / error states handled.

To use it:

1. Open the file and set **one** value at the top — `OLYXEE_API_BASE` — to your
   Olyxee base URL (default `https://logistics.olyxee.com`).
2. Restyle it to match your brand (it uses CSS variables at the top, or drop your
   own CSS in).
3. Publish it at your `/track` route.

If you use React/Vue/WordPress/Shopify instead of a plain HTML page, you don't need
the whole file — copy the `fetch()` call and the response-shape below into your own
component. The data is identical.

---

## Step 3 — Send customers to your page

Anywhere you'd link a customer to tracking (your website nav, a "Track my order"
button, WhatsApp, etc.), link to your own page with the tracking ID:

```
https://yourshop.co.za/track?code=<the order's tracking ID>
```

The tracking ID is shown on every order in your Olyxee dashboard and on the invoice.

> **Note on the emailed "Track shipment" button:** today that button always points
> at the Olyxee-hosted page (so the link is guaranteed to work even before your site
> is live). If you'd like the email to link to *your* website's tracking page
> instead, tell us — it's a small change we can switch on for your account once your
> page is up.

---

## The API reference

### Request

```
GET  https://logistics.olyxee.com/api/public/track/{trackingId}
```

- No authentication, no API key, no cookies.
- `{trackingId}` is the order's tracking ID, e.g. `OLY-ABC-2345`
  (letters, numbers and `-`, up to 40 chars).
- Responses are cached for ~30 seconds. Poll no more than once every 30s if you
  keep the page open.

### Successful response — `200 OK`

```json
{
  "trackingId": "OLY-ABC-2345",
  "reference": "PO-9912",
  "currentStatus": "IN_TRANSIT",
  "statusLabel": "In transit",
  "transportMode": "SEA",
  "transportModeLabel": "Sea freight",
  "estimatedDeliveryDate": "2026-09-01",
  "lastUpdated": "2026-08-19T10:22:04.000Z",
  "flow": [
    { "status": "ORDER_CONFIRMED",      "label": "Order confirmed",       "state": "completed" },
    { "status": "COLLECTED_FROM_SUPPLIER","label": "Collected from supplier","state": "completed" },
    { "status": "IN_TRANSIT",           "label": "In transit",            "state": "current" },
    { "status": "ARRIVED_AT_DESTINATION","label": "Arrived at destination","state": "upcoming" },
    { "status": "OUT_FOR_DELIVERY",     "label": "Out for delivery",      "state": "upcoming" },
    { "status": "DELIVERED_COLLECTED",  "label": "Delivered / collected", "state": "upcoming" }
  ],
  "business": {
    "name": "Your Shop (Pty) Ltd",
    "phone": "+27 11 000 0000",
    "email": "support@yourshop.co.za",
    "logoUrl": "https://.../logo.png",
    "primaryColor": "#10243e"
  },
  "selfService": { "canCancel": true, "canReschedule": true },
  "events": [
    {
      "at": "2026-08-19T10:22:04.000Z",
      "status": "IN_TRANSIT",
      "label": "In transit",
      "message": "Departed the port of origin.",
      "location": "Shanghai"
    }
  ]
}
```

**Fields you'll actually render:**

| Field | What it is |
|-------|-----------|
| `trackingId` | The tracking ID (show it so the customer knows it matched). |
| `reference` | The business's own order reference / job number, if any. |
| `statusLabel` | Human-readable current status — **render this**, not the raw code. |
| `transportModeLabel` | "Air freight" / "Sea freight" (may be `null` for older orders). |
| `estimatedDeliveryDate` | ETA (`YYYY-MM-DD`) or `null`. |
| `lastUpdated` | ISO timestamp of the last change. |
| `flow[]` | The full journey as a checklist. Each step has a human `label` and a `state` of `completed`, `current`, or `upcoming` — perfect for a ✓ / ● / ○ timeline. Present for air/sea orders; may be absent on older records (fall back to `statusLabel`). |
| `business` | Your name, contact, logo and brand colour — so the page looks like yours. |
| `events[]` | History, **newest first**. Each has `at` (ISO), `label`, optional `message` and `location`. |
| `selfService` | Whether the customer may request a cancel / reschedule (see below). |

> **Render the human text, not the codes.** Use `statusLabel` and `flow[].label`
> for what the customer sees, and `flow[].state` for the timeline. That way you
> never have to hard-code the internal status names, and new statuses just appear.
> (A few legacy aliases — `status`, `orderReference`, `events[].timestamp`,
> `events[].statusLabel`, `events[].notes` — are also included for older
> integrations; you can ignore them.)

### Error responses

| Status | Meaning | What to show the customer |
|--------|---------|---------------------------|
| `404 Not found` | No shipment with that tracking ID (or a malformed ID). | "We couldn't find that shipment — check the link from your email." |
| `403 Origin not allowed` | Your website's origin isn't authorised yet (Step 1). | Fix it in Settings; not something the customer can resolve. |
| `429 Too many requests` | You're polling too fast. | Back off; respect the 30s cache. |

---

## Optional: let customers request a change

The same public surface can accept a **cancel** or **reschedule** request, which
lands in the business's dashboard as a customer request (it does **not** change the
shipment by itself — a person confirms it).

```
POST https://logistics.olyxee.com/api/public/track/{trackingId}/requests
Content-Type: application/json

{ "type": "reschedule", "requestedDate": "2026-09-05", "note": "Morning please" }
```

- `type` is `"cancel"` or `"reschedule"` (`requestedDate` is required for reschedule).
- Only offer these when `selfService.canCancel` / `selfService.canReschedule` is
  `true` (they're closed once a shipment is delivered/cancelled).
- Rate-limited to **5 requests per 15 minutes** per customer.

---

## Quick checklist

- [ ] Website URL saved in Olyxee Settings (this authorises your origin).
- [ ] Using `https://` and every origin you serve from (`www` and non-`www`).
- [ ] A `/track` page on your site that reads `?code=`.
- [ ] `OLYXEE_API_BASE` set correctly in the page.
- [ ] Links to customers use `?code=<trackingId>`.
- [ ] Page handles loading, 404 (not found) and error states.

## Troubleshooting

- **Console shows a CORS / 403 error** → your page's origin isn't in the allow-list.
  Add it in Settings → *Allowed website origins* (and remember `www` is separate).
- **"This link is missing a tracking code"** → the link had no `?code=…`. Make sure
  your track links include the tracking ID.
- **Everything is blank / "not found"** → double-check the tracking ID exists in your
  dashboard and is spelled exactly (it's case-insensitive but must otherwise match).
- **Status looks stale** → responses cache for ~30s; wait a moment and refresh.

---

**TL;DR:** save your website URL in Settings, publish the
[example page](examples/olyxee-tracking-embed.html) at `yourshop.co.za/track`, and
link customers to `yourshop.co.za/track?code=<trackingId>`. The page pulls live
status from `GET /api/public/track/{trackingId}` and draws it in your brand.
