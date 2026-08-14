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
// user until 31 July 2026 and enforces no limits.

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
  // Marketing bullet list shown on the pricing/upgrade surfaces. Source of truth
  // for what each tier advertises so the copy never drifts between pages.
  features?: string[];
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
    orderLimit: 50,
    emailLimit: null,
    smsLimit: 0,
    advancedCustomization: false,
    removeOlyxeeBranding: false,
    availableFrom: "2026-08-20",
    features: [
      "Up to 50 orders per month",
      "Customer tracking pages",
      "Email status updates",
      "PDF invoices",
      "Customer and order management",
    ],
  },

  pro: {
    name: "Growth",
    price: 89,
    orderLimit: 300,
    emailLimit: null,
    smsLimit: 100,
    advancedCustomization: true,
    removeOlyxeeBranding: true,
    availableFrom: "2026-08-20",
    features: [
      "Up to 300 orders per month",
      "Everything in Free",
      "SMS and email updates",
      "Business branding",
      "Invoice customization",
      "Order and delivery records",
    ],
  },

  business: {
    name: "Scale",
    price: 999,
    orderLimit: 1000,
    emailLimit: null,
    smsLimit: 500,
    callMinutesLimit: 0,
    advancedCustomization: true,
    removeOlyxeeBranding: true,
    apiAccess: false,
    automatedCallCentre: true,
    availableFrom: "2026-08-20",
    features: [
      "Up to 1,000 orders per month",
      "Everything in Growth",
      "Higher-volume operations",
      "Unlimited email updates",
      "Advanced business branding",
      "Call centre",
      "Priority support",
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
  smsNotifications: true,
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
// 20 August 2026 00:00 Africa/Johannesburg (UTC+02:00). Existing users get Pro
// free from 20–26 August 2026.

export const orderLoopLaunch = {
  launchDate: "2026-08-20T00:00:00+02:00",
  trialStartDate: "2026-08-20T00:00:00+02:00",
  trialEndDate: "2026-08-26T23:59:59+02:00",
} as const;

// Convenience: pricing pages / countdown labels.
export const LAUNCH_LABEL = "20 August 2026";
export const TRIAL_LABEL = "20–26 August 2026";
