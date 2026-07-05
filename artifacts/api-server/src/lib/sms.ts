import { isFeatureEnabled } from "@workspace/plans";
import { logger } from "./logger";

// ─── SMS provider foundation (DISABLED) ──────────────────────────────────────
// This is a scaffold for the future SMS notification channel. It stays fully
// disabled behind featureFlags.smsNotifications for this launch-prep release:
// even if provider credentials are present, no SMS is ever sent while the flag
// is false. When the channel is enabled later, only this module needs a real
// provider implementation — the notification service already fans out to it.

export interface SendSmsParams {
  to: string;
  body: string;
}

export type SmsResult =
  | { success: true; providerMessageId?: string }
  | { success: false; error: string; skipped?: boolean };

// True only when BOTH the feature flag is on AND provider credentials exist.
// Credentials alone must never activate sending.
export function isSmsConfigured(): boolean {
  return (
    isFeatureEnabled("smsNotifications") &&
    Boolean(process.env.SMS_PROVIDER_API_KEY) &&
    Boolean(process.env.SMS_SENDER_ID)
  );
}

// Normalises to E.164-ish; a real implementation would validate per-country.
function normaliseNumber(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

export async function sendSms(params: SendSmsParams): Promise<SmsResult> {
  if (!isFeatureEnabled("smsNotifications")) {
    // Hard gate: the channel is off for this release.
    return { success: false, error: "SMS channel disabled", skipped: true };
  }
  const apiKey = process.env.SMS_PROVIDER_API_KEY;
  const senderId = process.env.SMS_SENDER_ID;
  if (!apiKey || !senderId) {
    logger.warn("SMS provider not configured - SMS not sent");
    return { success: false, error: "SMS provider not configured", skipped: true };
  }

  // Placeholder for the real provider call. Intentionally not implemented while
  // the feature is disabled; enabling the flag without wiring a provider here
  // will surface this clearly instead of silently pretending to send.
  const to = normaliseNumber(params.to);
  logger.warn({ to }, "sendSms called but no provider implementation is wired yet");
  return { success: false, error: "SMS provider implementation not wired" };
}
