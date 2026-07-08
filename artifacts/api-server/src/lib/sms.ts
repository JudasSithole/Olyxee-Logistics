import { isFeatureEnabled } from "@workspace/plans";
import { logger } from "./logger";

// ─── SMS provider: SMSPortal (flag-gated) ────────────────────────────────────
// Real SMSPortal (https://smsportal.com) integration. It stays fully disabled
// behind featureFlags.smsNotifications: even if provider credentials are
// present, no SMS is ever sent while the flag is false.
//
// Env:
//   SMSPORTAL_CLIENT_ID  - SMSPortal REST API Client ID
//   SMSPORTAL_API_SECRET - SMSPortal REST API Secret
//   SMS_SENDER_ID        - optional registered sender ID (branded sender name)

const SMSPORTAL_BASE = "https://rest.smsportal.com";

export interface SendSmsParams {
  to: string;
  body: string;
}

export type SmsResult =
  | { success: true; providerMessageId?: string }
  | { success: false; error: string; skipped?: boolean };

function hasCredentials(): boolean {
  return (
    Boolean(process.env.SMSPORTAL_CLIENT_ID) &&
    Boolean(process.env.SMSPORTAL_API_SECRET)
  );
}

// True only when BOTH the feature flag is on AND provider credentials exist.
// Credentials alone must never activate sending.
export function isSmsConfigured(): boolean {
  return isFeatureEnabled("smsNotifications") && hasCredentials();
}

// Normalises to E.164-ish; a real implementation would validate per-country.
function normaliseNumber(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

// ─── SMSPortal auth token cache ──────────────────────────────────────────────
// SMSPortal issues short-lived bearer tokens from Basic-auth'd /Authentication.
// Cache the token and refresh a minute before expiry.
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token;
  }
  const clientId = process.env.SMSPORTAL_CLIENT_ID ?? "";
  const secret = process.env.SMSPORTAL_API_SECRET ?? "";
  const basic = Buffer.from(`${clientId}:${secret}`).toString("base64");
  const res = await fetch(`${SMSPORTAL_BASE}/Authentication`, {
    method: "GET",
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `SMSPortal authentication failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }
  const data = (await res.json()) as {
    token?: string;
    expiresInMinutes?: number;
  };
  if (!data.token) {
    throw new Error("SMSPortal authentication response missing token");
  }
  const ttlMinutes = data.expiresInMinutes ?? 20;
  cachedToken = {
    token: data.token,
    // Refresh one minute early to avoid using a token at the expiry edge.
    expiresAt: now + Math.max(ttlMinutes - 1, 1) * 60_000,
  };
  return data.token;
}

export async function sendSms(params: SendSmsParams): Promise<SmsResult> {
  if (!isFeatureEnabled("smsNotifications")) {
    // Hard gate: the channel is off for this release.
    return { success: false, error: "SMS channel disabled", skipped: true };
  }
  if (!hasCredentials()) {
    logger.warn(
      "SMS provider not configured (SMSPORTAL_CLIENT_ID / SMSPORTAL_API_SECRET) - SMS not sent",
    );
    return { success: false, error: "SMS provider not configured", skipped: true };
  }

  const to = normaliseNumber(params.to);
  if (!to) {
    return { success: false, error: "Invalid destination number" };
  }

  try {
    const senderId = process.env.SMS_SENDER_ID;
    const message: Record<string, unknown> = {
      content: params.body,
      destination: to,
    };
    const payload: Record<string, unknown> = { messages: [message] };
    if (senderId) {
      payload.sendOptions = { senderId };
    }
    const doSend = async (): Promise<globalThis.Response> => {
      const token = await getAuthToken();
      return fetch(`${SMSPORTAL_BASE}/BulkMessages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
    };
    let res = await doSend();
    if (res.status === 401) {
      // Cached token was likely revoked/expired early - re-authenticate once
      // and retry so a stale token doesn't drop the message.
      cachedToken = null;
      res = await doSend();
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401) cachedToken = null;
      logger.error(
        { status: res.status, body: text.slice(0, 500), to },
        "SMSPortal send failed",
      );
      return { success: false, error: `SMSPortal send failed (${res.status})` };
    }
    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ messageId?: string }>;
    };
    const providerMessageId = data.messages?.[0]?.messageId;
    logger.info({ to, providerMessageId }, "SMS sent via SMSPortal");
    return { success: true, providerMessageId };
  } catch (err) {
    logger.error({ err, to }, "SMSPortal send errored");
    return {
      success: false,
      error: err instanceof Error ? err.message : "SMS send failed",
    };
  }
}
