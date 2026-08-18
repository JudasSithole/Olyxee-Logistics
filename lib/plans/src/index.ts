// Shared, framework-agnostic launch/plan configuration for the Order Loop
// launch-prep release. Imported by BOTH the API server and the admin frontend
// so the plan catalog, feature flags, and launch dates are defined once and
// never drift between pricing UI, badges, and (future) enforcement.
//
// IMPORTANT: nothing in this file turns a feature on by itself. Feature flags
// gate every unfinished capability; leave them false until the capability is
// fully built and verified.

// ─── Plan catalog ────────────────────────────────────────────────────────────
// `null` limits mean "unlimited". `beta` is the current plan for every existing
// user and enforces no limits. The public catalog is Free + Scale; `pro`
// (Growth) is retired from display but the ID stays valid because it is baked
// into the DB enum and generated API types.

export type PlanId = "beta" | "free" | "pro" | "business";

export interface PlanConfig {
  name: string;
  price: number;
  active?: boolean;
  enforceLimits?: boolean;
  orderLimit?: number | null;
  customerLimit?: number | null;
  emailLimit?: number | null;
  smsLimit?: number | null;
  callMinutesLimit?: number | null;
  advancedCustomization?: boolean;
  removeOlyxeeBranding?: boolean;
  apiAccess?: boolean;
  automatedCallCentre?: boolean;
  availableFrom?: string;
  // Short positioning line shown under the plan name on pricing surfaces.
  tagline?: string;
  // Marketing bullet list shown on the pricing/upgrade surfaces. Source of truth
  // for what each tier advertises so the copy never drifts between pages.
  features?: string[];
  // Capabilities advertised for the tier that are NOT released yet. Pricing
  // surfaces must render these with a "Coming Soon" marker, never as available.
  comingSoon?: string[];
}

export const plans: Record<PlanId, PlanConfig> = {
  beta: {
    name: "BETA",
    price: 0,
    active: true,
    enforceLimits: false,
  },

  free: {
    // Entry tier "Starter". Free for everyone during beta; R89/month once
    // billing starts. Plan id stays "free" (DB enum + generated types); only
    // the label/price/copy change. The core system for running freight jobs.
    name: "Starter",
    price: 89,
    orderLimit: null,
    emailLimit: 50,
    smsLimit: 0,
    advancedCustomization: false,
    removeOlyxeeBranding: false,
    tagline: "Run your freight jobs in one place.",
    features: [
      "Customer management",
      "Quotes and jobs",
      "Invoicing and payment confirmation",
      "Air and sea shipment workflows",
      "Shipment tracking",
      "Branded customer tracking",
      "Delivery and collection management",
      "Up to 50 automated emails per month",
    ],
  },

  // Retired tier — kept only because the `pro` ID exists in the DB enum and
  // generated API types. Not shown on any pricing surface.
  pro: {
    name: "Growth",
    price: 89,
    active: false,
    orderLimit: 300,
    emailLimit: null,
    smsLimit: 0,
    advancedCustomization: true,
    removeOlyxeeBranding: true,
    features: [],
  },

  business: {
    name: "Scale",
    // R999/month. Free for everyone during beta; this price only starts being
    // charged on SCALE_BILLING_START (30 September 2026). `price` is the single
    // source of truth for both the pricing UI and the Paystack charge amount
    // (planAmountMinor = price * 100).
    price: 999,
    orderLimit: null,
    emailLimit: null,
    smsLimit: 0,
    callMinutesLimit: 0,
    advancedCustomization: true,
    removeOlyxeeBranding: true,
    apiAccess: false,
    automatedCallCentre: true,
    availableFrom: "2026-09-30",
    tagline:
      "Handle more cross-border freight with less admin and better control over every job. Save controller time, reduce mistakes, and protect your margins.",
    features: [
      "Everything in Starter",
      "Higher email allowance",
    ],
    // Outcome-first roadmap, written for a freight owner (never internal/AI
    // jargon). None of these are released yet, so every item renders with a
    // "Coming Soon" marker on the pricing surfaces.
    comingSoon: [
      "Spend less time chasing documents — automatic handling of invoices, packing lists, AWBs/BLs, permits and PODs",
      "Missing-document reminders and follow-ups",
      "Easier customs and clearance coordination",
      "Quote faster using your freight rates, costs and margins",
      "Landed-cost estimates — freight, duties, taxes, clearing and delivery",
      "Know the real profit on every job with margin tracking",
      "Early warnings when carrier or supplier costs eat into your margin",
      "Automatic follow-ups with customers, suppliers and agents",
      "Customer self-service portal for shipments, documents, invoices and updates",
      "SMS shipment notifications",
      "Call-centre support for routine shipment questions",
      "Orgni Intelligence — watches active jobs and flags what needs attention",
      "Carrier, customs and freight-system integrations as they're added",
    ],
  },
} satisfies Record<PlanId, PlanConfig>;

export type Plans = typeof plans;

export function getPlan(id: PlanId): PlanConfig {
  return plans[id];
}

export function isValidPlanId(id: string): id is PlanId {
  return id === "beta" || id === "free" || id === "pro" || id === "business";
}

// The subscription lifecycle states persisted on a business.
export type SubscriptionStatus =
  | "beta"
  | "trial"
  | "active"
  | "past_due"
  | "cancelled";

// ─── Feature flags ───────────────────────────────────────────────────────────
// Every unfinished route, component, service, background job, or migration MUST
// check the relevant flag and no-op / hide when it is false. Keep these false in
// production for this preparation release.

export const featureFlags = {
  // SMS is fully removed from the product for now (pricing, notifications,
  // settings). The dormant code paths stay behind this flag.
  smsNotifications: false,
  subscriptionBilling: false,
  planEnforcement: false,
  businessBranding: false,
  customTemplates: false,
  publicApi: false,
  automatedCallCentre: false,
  existingUserTrial: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return Boolean(featureFlags[flag]);
}

// ─── Launch + trial dates ────────────────────────────────────────────────────

export const orderLoopLaunch = {
  launchDate: "2026-08-20T00:00:00+02:00",
  trialStartDate: "2026-08-20T00:00:00+02:00",
  trialEndDate: "2026-08-26T23:59:59+02:00",
} as const;

// Convenience: pricing pages / countdown labels.
export const LAUNCH_LABEL = "20 August 2026";
export const TRIAL_LABEL = "20–26 August 2026";

// ─── Scale billing start ─────────────────────────────────────────────────────
// Businesses may see and join Scale during the rollout period, but NO
// subscription charge may be processed before this date. Backend billing
// endpoints and every UI surface that shows the Scale price must use these.

export const SCALE_BILLING_START = "2026-09-30T00:00:00+02:00";
export const SCALE_BILLING_START_LABEL = "30 September 2026";

export function isScaleBillingLive(now: Date = new Date()): boolean {
  return now.getTime() >= new Date(SCALE_BILLING_START).getTime();
}
