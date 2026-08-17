// UI-facing helpers layered on top of the shared @workspace/plans config so
// the admin app and the API agree on plans, flags, and launch dates.
export {
  plans,
  getPlan,
  isValidPlanId,
  featureFlags,
  isFeatureEnabled,
  orderLoopLaunch,
  LAUNCH_LABEL,
  TRIAL_LABEL,
  SCALE_BILLING_START,
  SCALE_BILLING_START_LABEL,
  isScaleBillingLive,
  type PlanId,
  type PlanConfig,
  type SubscriptionStatus,
  type FeatureFlag,
} from "@workspace/plans";

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isLaunched: boolean;
}

// Milliseconds remaining until `target` broken into d/h/m/s. Clamps at zero.
export function computeCountdown(target: string, now: number = Date.now()): Countdown {
  const total = Math.max(0, new Date(target).getTime() - now);
  const isLaunched = total <= 0;
  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  return { days, hours, minutes, seconds, total, isLaunched };
}
