import {
  db,
  notificationEventsTable,
  notificationDeliveriesTable,
} from "@workspace/db";
import { isFeatureEnabled } from "@workspace/plans";
import { generateId } from "./id";
import { logger } from "./logger";

// ─── Shared notification service ─────────────────────────────────────────────
// One order event (a status change) fans out to one delivery row per channel.
// This is the forward-looking abstraction: today it records the email delivery
// that the order route already performed, and — once SMS is enabled — it will
// own the SMS fan-out too. It writes to the NEW notification_events /
// notification_deliveries tables and NEVER touches the legacy
// email_notifications table, which the order route keeps writing as before.
//
// Every write here is best-effort: this function must never throw into the
// order-status request path. A failure to record notification history must not
// fail (or roll back) the status update itself.

export type DeliveryChannel = "email" | "sms";
export type DeliveryStatus =
  | "pending"
  | "queued"
  | "sent"
  | "delivered"
  | "failed";

export interface ChannelOutcome {
  channel: DeliveryChannel;
  recipient: string;
  status: DeliveryStatus;
  providerMessageId?: string | null;
  failureReason?: string | null;
}

export interface RecordNotificationParams {
  orderId: string;
  businessId: string;
  status: string;
  message?: string | null;
  outcomes: ChannelOutcome[];
}

// Records a notification event and its per-channel deliveries. Returns the new
// event id on success, or null if recording failed (already logged). Callers
// should treat a null result as "history not recorded" and carry on.
export async function recordNotification(
  params: RecordNotificationParams,
): Promise<string | null> {
  const { orderId, businessId, status, message, outcomes } = params;
  try {
    const eventId = generateId();
    await db.transaction(async (tx) => {
      await tx.insert(notificationEventsTable).values({
        id: eventId,
        orderId,
        businessId,
        status,
        message: message ?? null,
      });
      for (const o of outcomes) {
        await tx.insert(notificationDeliveriesTable).values({
          id: generateId(),
          eventId,
          channel: o.channel,
          status: o.status,
          recipient: o.recipient,
          providerMessageId: o.providerMessageId ?? null,
          failureReason: o.failureReason ?? null,
          sentAt: o.status === "sent" || o.status === "delivered" ? new Date() : null,
        });
      }
    });
    return eventId;
  } catch (err) {
    logger.warn({ err, orderId }, "Failed to record notification history (non-fatal)");
    return null;
  }
}

// Which channels are active for outbound notifications. Email is always on;
// SMS only when its flag AND provider config are present.
export function activeChannels(): DeliveryChannel[] {
  const channels: DeliveryChannel[] = ["email"];
  if (isFeatureEnabled("smsNotifications")) channels.push("sms");
  return channels;
}
