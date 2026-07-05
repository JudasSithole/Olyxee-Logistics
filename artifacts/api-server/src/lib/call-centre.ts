import { isFeatureEnabled } from "@workspace/plans";

// ─── Automated call centre foundation (DISABLED) ─────────────────────────────
// Scaffold for the future Retell-powered inbound call centre. It stays disabled
// behind featureFlags.automatedCallCentre for this launch-prep release. No
// webhook is processed and no call is placed while the flag is false; the
// call_records table exists but nothing writes real data to it yet.

export function isCallCentreEnabled(): boolean {
  return (
    isFeatureEnabled("automatedCallCentre") &&
    Boolean(process.env.RETELL_API_KEY)
  );
}

export interface RetellWebhookEvent {
  event: string;
  call?: {
    call_id?: string;
    from_number?: string;
    transcript?: string;
    call_analysis?: { call_summary?: string };
  };
}

export type CallCentreOutcome =
  | { handled: true }
  | { handled: false; reason: string };

// Entry point for the future webhook handler. Returns a not-handled outcome
// while the feature is disabled so the route can respond 503 without doing any
// work or persisting anything.
export async function handleRetellEvent(
  _event: RetellWebhookEvent,
): Promise<CallCentreOutcome> {
  if (!isCallCentreEnabled()) {
    return { handled: false, reason: "Call centre disabled" };
  }
  // Placeholder: real transcript persistence + escalation logic lands when the
  // feature is enabled.
  return { handled: false, reason: "Call centre implementation not wired" };
}
