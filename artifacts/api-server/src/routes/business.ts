import { Router } from "express";
import {
  db,
  businessesTable,
  auditLogsTable,
  customersTable,
  ordersTable,
  trackingEventsTable,
  emailNotificationsTable,
  usersTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { UpdateBusinessBody } from "@workspace/api-zod";
import { requireAuth } from "../lib/auth";
import { generateId } from "../lib/id";
import { DEMO_BUSINESS_ID } from "./auth";
import { SESSION_COOKIE, sessionCookieOptions } from "../lib/session";

const DEMO_BUSINESS = {
  id: DEMO_BUSINESS_ID,
  name: "Demo Business",
  slug: "demo-business",
  websiteUrl: "",
  supportEmail: "demo@demo.com",
  industry: null,
  employeeCount: null,
  location: null,
  phone: null,
  emailGreeting: null,
  emailSignature: null,
  emailFooterNote: null,
  trackingIdPrefix: "TRK",
  allowedOrigins: null,
  onboardingCompleted: true,
  createdAt: new Date("2024-01-01").toISOString(),
};

const router = Router();

function serialize(business: typeof businessesTable.$inferSelect) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    websiteUrl: business.websiteUrl,
    supportEmail: business.supportEmail,
    industry: business.industry,
    employeeCount: business.employeeCount,
    location: business.location,
    phone: business.phone,
    emailGreeting: business.emailGreeting,
    emailSignature: business.emailSignature,
    emailFooterNote: business.emailFooterNote,
    trackingIdPrefix: business.trackingIdPrefix,
    allowedOrigins: business.allowedOrigins,
    onboardingCompleted: business.onboardingCompleted,
    createdAt: business.createdAt.toISOString(),
  };
}

router.get("/business", requireAuth, async (req, res) => {
  const businessId = (req as any).businessId;

  // Demo session — return hardcoded data, no DB needed.
  if (businessId === DEMO_BUSINESS_ID) {
    res.json(DEMO_BUSINESS);
    return;
  }

  try {
    const business = await db.query.businessesTable.findFirst({
      where: eq(businessesTable.id, businessId),
    });

    if (!business) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    res.json(serialize(business));
  } catch (err) {
    req.log.error({ err }, "Failed to get business");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/business", requireAuth, async (req, res) => {
  try {
    const businessId = (req as any).businessId;
    const userId = (req as any).userId;
    const parse = UpdateBusinessBody.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: "Invalid input", details: parse.error.issues });
      return;
    }

    const updated = await db.transaction(async (tx) => {
      const existing = await tx.query.businessesTable.findFirst({
        where: eq(businessesTable.id, businessId),
      });
      if (!existing) return null;

      // Email customization fields use `in` to distinguish "explicitly cleared
      // by the admin" (null/empty → fall back to defaults in the template) from
      // "not in payload" (keep existing value).
      const next = {
        name: parse.data.name ?? existing.name,
        industry: parse.data.industry ?? existing.industry,
        employeeCount: parse.data.employeeCount ?? existing.employeeCount,
        location: parse.data.location ?? existing.location,
        phone: parse.data.phone ?? existing.phone,
        websiteUrl: parse.data.websiteUrl ?? existing.websiteUrl,
        supportEmail: parse.data.supportEmail ?? existing.supportEmail,
        emailGreeting: "emailGreeting" in parse.data
          ? parse.data.emailGreeting ?? null : existing.emailGreeting,
        emailSignature: "emailSignature" in parse.data
          ? parse.data.emailSignature ?? null : existing.emailSignature,
        emailFooterNote: "emailFooterNote" in parse.data
          ? parse.data.emailFooterNote ?? null : existing.emailFooterNote,
        // Tracking prefix: normalize to A–Z and clamp to 3–5 chars before
        // persisting so the DB never holds malformed values regardless of
        // what the client sends. Empty/invalid input clears the column,
        // which makes order creation fall back to the "OLY" default.
        trackingIdPrefix: "trackingIdPrefix" in parse.data
          ? (() => {
              const raw = parse.data.trackingIdPrefix ?? "";
              const cleaned = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5);
              return cleaned.length >= 3 ? cleaned : null;
            })()
          : existing.trackingIdPrefix,
        allowedOrigins: "allowedOrigins" in parse.data
          ? (() => {
              const raw = parse.data.allowedOrigins ?? "";
              // Trim, drop trailing slashes, drop empties, dedupe — same
              // shape the admin UI normalizes to, applied server-side as a
              // defense in depth.
              const list = Array.from(
                new Set(
                  raw
                    .split(",")
                    .map((s) => s.trim().replace(/\/+$/, ""))
                    .filter(Boolean),
                ),
              );
              return list.length > 0 ? list.join(",") : null;
            })()
          : existing.allowedOrigins,
        onboardingCompleted:
          parse.data.onboardingCompleted ?? existing.onboardingCompleted,
      };

      const rows = await tx
        .update(businessesTable)
        .set(next)
        .where(eq(businessesTable.id, businessId))
        .returning();

      await tx.insert(auditLogsTable).values({
        id: generateId(),
        businessId,
        userId,
        action: "UPDATE_BUSINESS",
        entityType: "business",
        entityId: businessId,
        metadata: { changes: parse.data },
      });

      return rows[0]!;
    });

    if (!updated) {
      res.status(404).json({ error: "Business not found" });
      return;
    }

    res.json(serialize(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update business");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Hard-delete the current user's business and every row that belongs to it.
// Irreversible. We block the demo account so the public demo can't be wiped.
router.delete("/business", requireAuth, async (req, res) => {
  const businessId = (req as any).businessId as string;

  if (businessId === DEMO_BUSINESS_ID) {
    res.status(403).json({ error: "Demo accounts cannot be deleted" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      // Order matters — no ON DELETE CASCADE in the schema, so we peel from
      // the leaves of the FK graph upward.
      const orderIds = (
        await tx
          .select({ id: ordersTable.id })
          .from(ordersTable)
          .where(eq(ordersTable.businessId, businessId))
      ).map((r) => r.id);

      if (orderIds.length > 0) {
        await tx
          .delete(trackingEventsTable)
          .where(inArray(trackingEventsTable.orderId, orderIds));
        await tx
          .delete(emailNotificationsTable)
          .where(inArray(emailNotificationsTable.orderId, orderIds));
      }

      await tx.delete(ordersTable).where(eq(ordersTable.businessId, businessId));
      await tx.delete(customersTable).where(eq(customersTable.businessId, businessId));
      await tx.delete(auditLogsTable).where(eq(auditLogsTable.businessId, businessId));
      await tx.delete(usersTable).where(eq(usersTable.businessId, businessId));
      await tx.delete(businessesTable).where(eq(businessesTable.id, businessId));
    });

    res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(), maxAge: 0 });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete business");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
