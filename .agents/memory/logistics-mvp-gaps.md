---
name: Logistics MVP corrected workflow
description: The agreed MVP has no quotes; invoices + payment gating + China-warehouse matching are the planned commercial layer on top of existing shipping primitives.
---

The corrected Order Loop logistics MVP works like this: quotes happen outside the platform; staff create an order at the agreed price, which auto-creates and emails an invoice; the order waits in AWAITING_PAYMENT until staff manually confirm offline payment; only then can it enter the air/sea shipping flow. The supplier tracking number arrives later (when the China warehouse receives cargo) so it must be nullable, unique per business, and never a primary key — it is distinct from the internal order ID, public tracking ID, and order reference.

**Why:** an earlier draft assumed in-platform quotes and a payment gateway; both were explicitly dropped. No quote code was ever built — do not hunt for quote functionality to remove.

**How to apply:** build invoices/payment gating/warehouse matching by extending the existing order, status-flow, notification, and audit primitives rather than adding parallel ones; keep the public tracking payload free of invoice, payment, and warehouse-internal data.
