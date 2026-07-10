import { getPlan, isFeatureEnabled, isValidPlanId, type PlanId } from "@workspace/plans";

// ─── Usage enforcement + trial logic (DISABLED) ──────────────────────────────
// Central place that decides whether a business may perform a metered action
// (add a customer, send an email/SMS). While featureFlags.planEnforcement is
// false — or the business is still on the BETA plan — nothing is ever blocked.
// This lets the rest of the app call these checks now; they simply always allow
// until enforcement is switched on post-launch.

export interface EnforceableBusiness {
  plan?: string | null;
  subscriptionStatus?: string | null;
}

export type LimitKind = "order" | "customer" | "email" | "sms";

export interface LimitDecision {
  allowed: boolean;
  limit: number | null; // null === unlimited
  reason?: string;
}

function planFor(business: EnforceableBusiness): PlanId {
  return business.plan && isValidPlanId(business.plan) ? business.plan : "beta";
}

// Whether limits should be enforced for this business right now.
export function enforcementActive(business: EnforceableBusiness): boolean {
  if (!isFeatureEnabled("planEnforcement")) return false;
  const planId = planFor(business);
  if (planId === "beta") return false;
  const plan = getPlan(planId);
  return plan.enforceLimits !== false;
}

function limitFor(planId: PlanId, kind: LimitKind): number | null | undefined {
  const plan = getPlan(planId);
  switch (kind) {
    case "order":
      return plan.orderLimit;
    case "customer":
      return plan.customerLimit;
    case "email":
      return plan.emailLimit;
    case "sms":
      return plan.smsLimit;
  }
}

// Decides whether one more unit of `kind` is allowed given current usage. When
// enforcement is inactive it always allows (limit reported as null/unlimited).
export function checkLimit(
  business: EnforceableBusiness,
  kind: LimitKind,
  currentUsage: number,
): LimitDecision {
  if (!enforcementActive(business)) {
    return { allowed: true, limit: null };
  }
  const planId = planFor(business);
  const limit = limitFor(planId, kind);
  if (limit == null) {
    return { allowed: true, limit: null };
  }
  if (currentUsage >= limit) {
    return {
      allowed: false,
      limit,
      reason: `${kind} limit of ${limit} reached for the ${getPlan(planId).name} plan`,
    };
  }
  return { allowed: true, limit };
}

// ─── Existing-user trial ─────────────────────────────────────────────────────
// Existing (BETA) users get Pro free for the launch trial window. This helper
// reports whether a business is currently inside that window. It is inert until
// featureFlags.existingUserTrial is enabled.
export function isInTrial(
  business: EnforceableBusiness & { trialStartsAt?: Date | null; trialEndsAt?: Date | null },
  now: Date = new Date(),
): boolean {
  if (!isFeatureEnabled("existingUserTrial")) return false;
  if (business.subscriptionStatus !== "trial") return false;
  const start = business.trialStartsAt;
  const end = business.trialEndsAt;
  if (!start || !end) return false;
  return now >= start && now <= end;
}
