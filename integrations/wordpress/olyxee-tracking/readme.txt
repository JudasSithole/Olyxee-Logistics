=== Olyxee Tracking ===
Contributors: olyxee
Tags: tracking, shipment, logistics, freight, order tracking
Requires at least: 5.8
Requires PHP: 7.2
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Show live shipment tracking from Olyxee Logistics on your own website. No API keys, no setup.

== Description ==

Add live shipment tracking to any page with the shortcode:

`[olyxee_tracking]`

Or insert the **Olyxee Tracking** block in the block editor.

Your customers enter a tracking number (or arrive via a link that already
contains it, e.g. `https://yoursite.com/track/?code=OLY-K7M-9X2A`) and see the
live status and timeline of their shipment — styled with your business name,
logo and colour.

**How it works / privacy**

* The customer's browser only ever talks to YOUR WordPress site. WordPress
  fetches the status from Olyxee server-side, so there is no CORS to configure
  and no API key to manage.
* A shipment's tracking number is globally unique, so the correct business is
  resolved automatically. Nothing to connect.
* Only customer-safe shipment status is shown — never pricing, customer
  personal data, invoices or internal notes.

== Installation ==

1. In WordPress, go to **Plugins → Add New → Upload Plugin**.
2. Upload `olyxee-tracking.zip` and click **Install Now**, then **Activate**.
3. Create or edit your "Track Shipment" page and add the shortcode
   `[olyxee_tracking]` (or the "Olyxee Tracking" block).
4. Done. Link customers to that page with `?code=<tracking number>`.

== Frequently Asked Questions ==

= Do I need an API key? =
No. There is nothing to configure.

= Do I need to set up CORS or allowed origins? =
No. Requests are made server-side by WordPress.

== Changelog ==

= 1.0.0 =
* Initial release: `[olyxee_tracking]` shortcode, Gutenberg block, server-side
  proxy, automatic `?code=` lookup, mobile layout.
