import { isFeatureEnabled, getPlan, isValidPlanId } from "@workspace/plans";

// ─── Business branding foundation (DISABLED) ─────────────────────────────────
// Resolves the effective branding for a business. While
// featureFlags.businessBranding is false, this always returns the default
// Olyxee branding regardless of any stored per-business values, so the
// customer-facing surface is unchanged for this launch-prep release.

export interface Branding {
  brandColor: string | null;
  logoUrl: string | null;
  removeOlyxeeBranding: boolean;
}

const DEFAULT_BRANDING: Branding = {
  brandColor: null,
  logoUrl: null,
  removeOlyxeeBranding: false,
};

export interface BrandingSource {
  plan?: string | null;
  primaryBrandColour?: string | null;
  businessLogoUrl?: string | null;
}

// Returns the branding to apply. Gated two ways: the global feature flag, and
// the plan's own removeOlyxeeBranding capability (Pro/Business only).
export function resolveBranding(business: BrandingSource): Branding {
  if (!isFeatureEnabled("businessBranding")) return DEFAULT_BRANDING;

  const planId = business.plan && isValidPlanId(business.plan) ? business.plan : "beta";
  const plan = getPlan(planId);
  const allowCustom = plan.advancedCustomization === true;
  const allowRemoveBranding = plan.removeOlyxeeBranding === true;

  return {
    brandColor: allowCustom ? business.primaryBrandColour ?? null : null,
    logoUrl: allowCustom ? business.businessLogoUrl ?? null : null,
    removeOlyxeeBranding: allowRemoveBranding,
  };
}
