import { db, smsNotificationsTable, ordersTable } from "@workspace/db";
import { and, count, eq, gte } from "drizzle-orm";

function startOfMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getMonthlySmsUsage(businessId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(smsNotificationsTable)
    .innerJoin(ordersTable, eq(smsNotificationsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(ordersTable.businessId, businessId),
        eq(smsNotificationsTable.status, "sent"),
        gte(smsNotificationsTable.createdAt, startOfMonthUTC()),
      ),
    );
  return rows[0]?.value ?? 0;
}
