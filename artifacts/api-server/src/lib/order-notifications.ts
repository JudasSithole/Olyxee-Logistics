import { db, smsNotificationsTable } from "@workspace/db";
import { generateId } from "./id";
import { sendSms, isSmsConfigured } from "./sms";
import { buildSmsBody } from "./sms-templates";
import { getMonthlySmsUsage } from "./sms-usage";
import { getPlan, type PlanId } from "@workspace/plans";

export type SendOrderSmsResult = {
  smsStatus: "sent" | "failed" | "skipped" | "limit_reached";
  smsNotificationId: string | undefined;
  smsUsage: number | undefined;
  smsLimit: number | null | undefined;
};

export async function sendOrderSms(params: {
  orderId: string;
  customerPhone: string | undefined;
  businessName: string;
  trackingId: string;
  status: string;
  statusMessage: string | null;
  trackingLink: string;
  businessPlan: PlanId;
  businessId: string;
}): Promise<SendOrderSmsResult> {
  const {
    orderId,
    customerPhone,
    businessName,
    trackingId,
    status,
    statusMessage,
    trackingLink,
    businessPlan,
    businessId,
  } = params;

  let smsStatus: SendOrderSmsResult["smsStatus"] = "skipped";
  let smsNotificationId: string | undefined;
  let smsUsage: number | undefined;
  let smsLimit: number | null | undefined;

  if (customerPhone && isSmsConfigured()) {
    const smsBody = buildSmsBody({
      businessName,
      trackingId,
      status,
      statusMessage,
      trackingLink,
      customerPhone,
    });

    smsLimit = getPlan(businessPlan).smsLimit ?? null;
    smsUsage = await getMonthlySmsUsage(businessId);

    if (smsLimit !== null && smsUsage >= smsLimit) {
      smsStatus = "limit_reached";
      const notif = await db
        .insert(smsNotificationsTable)
        .values({
          id: generateId(),
          orderId,
          customerPhone,
          body: smsBody,
          status: "limit_reached",
          providerMessageId: null,
        })
        .returning();
      smsNotificationId = notif[0]?.id;
    } else {
      const smsResult = await sendSms({ to: customerPhone, body: smsBody });
      const smsProviderMessageId = smsResult.success ? smsResult.providerMessageId : null;
      smsStatus = smsResult.success ? "sent" : "failed";
      if (smsStatus === "sent") smsUsage = (smsUsage ?? 0) + 1;

      const notif = await db
        .insert(smsNotificationsTable)
        .values({
          id: generateId(),
          orderId,
          customerPhone,
          body: smsBody,
          status: smsStatus,
          providerMessageId: smsProviderMessageId,
        })
        .returning();
      smsNotificationId = notif[0]?.id;
    }
  }

  return { smsStatus, smsNotificationId, smsUsage, smsLimit };
}
