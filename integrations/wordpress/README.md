# Olyxee Tracking — WordPress plugin

A lightweight WordPress plugin that lets an Olyxee Logistics business show live
shipment tracking on their own WordPress site with a single shortcode.

```
[olyxee_tracking]
```

## What it does

- Registers the `[olyxee_tracking]` shortcode and an "Olyxee Tracking" Gutenberg block.
- Shows a tracking-number input; if the page URL already has `?code=…` it looks
  the shipment up automatically.
- Fetches status **server-side** via a WordPress REST proxy
  (`/wp-json/olyxee/v1/track?code=…`), which calls the public Olyxee endpoint
  `GET /api/public/track/{trackingId}`. Because the browser only ever talks to
  the WordPress site, there is **no CORS to configure and no API key**.
- Renders the status, the flow checklist (or event history) and the ETA, in the
  business's own name/logo/colour. Handles loading, not-found and error states.
- Forwards only customer-safe fields — never pricing, customer PII, invoices or
  internal notes.

## No configuration / no business ID

A shipment's tracking number is globally unique, so the correct business is
resolved automatically by Olyxee. The site owner never enters an API base URL,
tenant ID, CORS origin or endpoint. (Self-hosting Olyxee? Override the base with
the `olyxee_tracking_api_base` filter — not needed for the hosted service.)

## Building the installable ZIP

The admin app serves the plugin download from
`artifacts/olyxee-admin/public/olyxee-tracking.zip`. After editing any file
under `olyxee-tracking/`, regenerate it:

```
powershell -File integrations/wordpress/build-zip.ps1
```

The script builds the archive with a single top-level `olyxee-tracking/` folder
and forward-slash entry names (required by WordPress).

## Files

- `olyxee-tracking/olyxee-tracking.php` — plugin bootstrap, REST proxy, shortcode, block registration.
- `olyxee-tracking/assets/olyxee-tracking.js` — front-end widget (vanilla JS).
- `olyxee-tracking/assets/olyxee-tracking.css` — mobile-first styles.
- `olyxee-tracking/block/` — Gutenberg editor block (`block.json` + `index.js`).
- `olyxee-tracking/readme.txt` — WordPress.org-style plugin readme.
