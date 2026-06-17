import { db, emailNotificationsTable, ordersTable } from "@workspace/db";
import { and, count, eq, gte } from "drizzle-orm";

// First instant of the current month, in UTC. Usage windows reset on the 1st.
function startOfMonthUTC(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

// How many status emails this business has actually sent this calendar month.
// Only rows with status "sent" count — failed and limit-blocked attempts do
// not consume the allowance. email_notifications has no businessId column, so
// we reach it through the owning order.
export async function getMonthlyEmailUsage(businessId: string): Promise<number> {
  const rows = await db
    .select({ value: count() })
    .from(emailNotificationsTable)
    .innerJoin(ordersTable, eq(emailNotificationsTable.orderId, ordersTable.id))
    .where(
      and(
        eq(ordersTable.businessId, businessId),
        eq(emailNotificationsTable.status, "sent"),
        gte(emailNotificationsTable.createdAt, startOfMonthUTC()),
      ),
    );
  return rows[0]?.value ?? 0;
}
