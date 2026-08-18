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
    name: "Free",
    price: 0,
    orderLimit: null,
    emailLimit: 50,
    smsLimit: 0,
    advancedCustomization: false,
    removeOlyxeeBranding: false,
    tagline: "Run your freight operation in one place.",
    features: [
      "Customer management",
      "Order management",
      "Invoicing and payment confirmation",
      "Air and sea shipment workflows",
      "Shipment tracking",
      "Branded customer tracking pages",
      "Delivery and collection management",
      "50 automated email notifications per month",
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
    // R89/month. Free for everyone during beta; this price only starts being
    // charged on SCALE_BILLING_START (30 September 2026). `price` is the single
    // source of truth for both the pricing UI and the Paystack charge amount
    // (planAmountMinor = price * 100).
    price: 89,
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
      "Grow your freight operation with less manual work. Let Orgni help your team monitor jobs, handle routine follow-ups, and surface what actually needs attention.",
    features: [
      "Everything in Free",
      "Higher email allowance (fair use)",
    ],
    comingSoon: [
      "Orgni Intelligence",
      "Automated follow-ups",
      "Document monitoring",
      "Exception detection",
      "ETA and deadline monitoring",
      "Operational alerts",
      "Easier customs-clearance workflows",
      "Task escalation",
      "Customer communication automation",
      "Call-centre capabilities",
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
