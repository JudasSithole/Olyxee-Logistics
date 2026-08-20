import { Fragment, useState } from "react";
import { useLocation } from "wouter";
import {
  ArrowRight,
  ArrowUpCircle,
  AlertTriangle,
  BarChart3,
  Bell,
  Check,
  ClipboardCheck,
  Clock,
  FileSearch,
  FileText,
  LifeBuoy,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessagesSquare,
  Minus,
  Package,
  Palette,
  PhoneCall,
  Ship,
  Sparkles,
  Star,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/hooks/use-supabase-queries";
import { apiFetch, ApiError } from "@/lib/api";
import {
  plans,
  featureFlags,
  SCALE_BILLING_START_LABEL,
  type PlanId,
} from "@/lib/launch";

function formatPrice(price: number): string {
  return price === 0 ? "Free" : `R${price.toLocaleString("en-ZA")}`;
}

const TIERS: PlanId[] = ["free", "business"];

// Short, plain-language descriptions for this page (the catalog taglines are
// longer marketing copy used elsewhere).
const PLAN_BLURB: Record<string, string> = {
  free: "Manage the job - the core system for running your freight work in one place.",
  business: "Make the job faster, cheaper and easier to run. Save controller time, reduce cross-border mistakes, and protect your margins.",
};

// One distinct icon per feature, matched by keyword so it keeps working if
// catalog wording is tweaked.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/customer management|customer and order/i, Users],
  [/quotes? and jobs|order management/i, Package],
  [/quot/i, FileText],
  [/margin|profit|landed.?cost|costs?\b|cost eat/i, BarChart3],
  [/portal|self-service/i, Users],
  [/invoic/i, FileText],
  [/air and sea|shipment workflows/i, Ship],
  [/branded/i, Palette],
  [/tracking/i, MapPin],
  [/delivery|collection/i, Truck],
  [/sms/i, MessageCircle],
  [/email/i, Mail],
  [/dashboard|insights/i, BarChart3],
  [/orgni/i, Sparkles],
  [/follow-up/i, MessagesSquare],
  [/document/i, FileSearch],
  [/exception/i, AlertTriangle],
  [/eta|deadline/i, Clock],
  [/alert|warning/i, Bell],
  [/customs|clearance/i, ClipboardCheck],
  [/integration/i, Package],
  [/escalation/i, ArrowUpCircle],
  [/communication/i, MessageCircle],
  [/call/i, PhoneCall],
  [/priority support/i, Star],
  [/support/i, LifeBuoy],
];

function featureIcon(label: string): LucideIcon {
  for (const [re, Icon] of ICON_RULES) {
    if (re.test(label)) return Icon;
  }
  return Check;
}

const FeatureIcon = ({ label, muted }: { label: string; muted?: boolean }) => {
  const Icon = featureIcon(label);
  return (
    <span
      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
        muted ? "bg-primary/10 text-primary" : "bg-muted text-foreground/70"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
};

// Bold the capability name at the start of a feature line, leaving the
// explanatory tail in normal weight (e.g. **Call-centre support** for routine
// questions). Splits at the first dash/paren/colon or a connective word.
const FEATURE_BOLD_SPLIT = /\s[-–]\s|\s*\(|:\s|\sfor\s|\swith\s|\sfrom\s|\son\s|\swhen\s|\susing\s|\sincluding\s/i;
function renderFeature(text: string) {
  const idx = text.search(FEATURE_BOLD_SPLIT);
  if (idx > 0) {
    return (
      <span className="text-muted-foreground">
        <span className="font-semibold text-foreground">{text.slice(0, idx)}</span>
        {text.slice(idx)}
      </span>
    );
  }
  return <span className="font-semibold text-foreground">{text}</span>;
}

const FEATURE_GROUPS = [
  { title: "Operations", rows: [
    ["Customer and order management", true, true],
    ["Air and sea freight workflows", true, true],
    ["Invoicing and payment confirmation", true, true],
    ["Delivery and collection management", true, true],
    ["Dashboard and business insights", true, true],
  ]},
  { title: "Customer experience", rows: [
    ["Public shipment tracking", true, true],
    ["Branded customer tracking pages", true, true],
    ["Email status notifications", "50 / month", "Higher allowance"],
  ]},
  { title: "Documents & coordination", comingSoon: true, rows: [
    ["Automatic document handling (invoices, packing lists, AWBs/BLs, permits, PODs)", false, "soon"],
    ["Missing-document reminders and follow-ups", false, "soon"],
    ["Easier customs and clearance coordination", false, "soon"],
  ]},
  { title: "Pricing, cost & profit", comingSoon: true, rows: [
    ["Quote faster from your rates, costs and margins", false, "soon"],
    ["Landed-cost estimates (freight, duties, taxes, clearing, delivery)", false, "soon"],
    ["Profit and margin tracking on every job", false, "soon"],
    ["Warnings when costs eat into your margin", false, "soon"],
  ]},
  { title: "Automation & service", comingSoon: true, rows: [
    ["Automatic follow-ups with customers, suppliers and agents", false, "soon"],
    ["Customer self-service portal", false, "soon"],
    ["SMS shipment notifications", false, "soon"],
    ["Call-centre support for routine questions", false, "soon"],
    ["Orgni Intelligence - flags what needs attention", false, "soon"],
    ["Carrier, customs and freight-system integrations", false, "soon"],
  ]},
  { title: "Support", rows: [
    ["Standard support", true, true],
    ["Priority support", false, true],
  ]},
] as const;

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
      Coming soon
    </span>
  );
}

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />;
  if (value === "soon") return <ComingSoonBadge />;
  return <span className="text-xs font-medium">{value}</span>;
}

export default function UpgradePage() {
  const { status, user } = useAuth();
  const isAuthed = status === "authenticated";
  const [, navigate] = useLocation();
  const { data: business } = useBusiness(user?.businessId);
  const currentPlan = business?.plan ?? "beta";
  // During beta every business is on Starter (the "free" tier) - Scale isn't
  // available to join yet. Map anything that isn't an active Scale plan to
  // Starter so it shows as the current plan.
  const currentTier: PlanId = currentPlan === "business" ? "business" : "free";
  const billingLive = featureFlags.subscriptionBilling;
  // Test control: when the billing flag is still off, the Paystack test flow can
  // still be exercised in dev, or in any environment where the server enables
  // test billing (mirror it to the client via VITE_ENABLE_TEST_BILLING=1|true).
  const envTestBilling = ["1", "true"].includes(
    String(import.meta.env.VITE_ENABLE_TEST_BILLING ?? "").toLowerCase(),
  );
  const devTestBilling = (import.meta.env.DEV || envTestBilling) && !billingLive;
  // Whether checkout is possible at all in this environment (auth-independent).
  const checkoutEnabled = billingLive || devTestBilling;

  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Rollout period: joining Scale before the billing start date is a plain,
  // non-charging plan selection - no checkout, no payment.
  async function handleJoin(id: PlanId) {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    setErrorMsg(null);
    setPendingPlan(id);
    try {
      await apiFetch("/api/business/select-plan", {
        method: "POST",
        body: { plan: id },
      });
      window.location.reload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not join the plan.");
    } finally {
      setPendingPlan(null);
    }
  }

  async function handleChoose(id: PlanId) {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    setErrorMsg(null);
    setPendingPlan(id);
    try {
      const res = await apiFetch<{ authorizationUrl: string }>(
        "/api/billing/initialize",
        { method: "POST", body: { plan: id } },
      );
      if (res.authorizationUrl) {
        window.location.href = res.authorizationUrl;
        return;
      }
      setErrorMsg("Checkout could not be started.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        setErrorMsg(
          "Billing is not enabled yet on this server. It requires a Paystack key plus the matching billing switch (ENABLE_TEST_BILLING=1 for test keys, ENABLE_LIVE_BILLING=1 for live keys).",
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : "Checkout failed.");
      }
    } finally {
      setPendingPlan(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12">
      <header className="pt-1">
        <h1 className="text-xl font-bold tracking-tight">Plans</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Free for everyone until {SCALE_BILLING_START_LABEL} - nothing to pay until then.</p>
      </header>

      {errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5 p-4" data-testid="billing-error">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {TIERS.map((id) => {
          const p = plans[id];
          const isCurrent = currentTier === id;
          return (
            <Card
              key={id}
              data-testid={`plan-${id}`}
              className="relative flex flex-col rounded-3xl border-border/70 p-6 shadow-sm"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold">{p.name}</h2>
                  {id === "business" && (
                    <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Recommended</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{PLAN_BLURB[id] ?? p.tagline}</p>
              </div>
              <div className="mt-5 border-b border-border pb-5">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">
                    {formatPrice(p.price)}
                  </span>
                  {p.price > 0 && (
                    <span className="text-sm text-muted-foreground">/month</span>
                  )}
                </div>
                {id === "business" && (
                  <p className="mt-2 text-xs font-medium text-primary">Billing starts {SCALE_BILLING_START_LABEL}</p>
                )}
              </div>

              <p className="mt-5 text-xs font-semibold text-foreground">
                {id === "business" ? "Everything in Starter, plus" : "Included"}
              </p>
              <ul className="mt-3 space-y-2.5">
                {(p.features ?? []).filter((f) => id !== "business" || f !== "Everything in Starter").map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <FeatureIcon label={f} />
                    {renderFeature(f)}
                  </li>
                ))}
              </ul>

              {(p.comingSoon?.length ?? 0) > 0 && (
                <>
                  <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />Coming soon to {p.name} <ComingSoonBadge />
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {(p.comingSoon ?? []).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <FeatureIcon label={f} muted />
                        {renderFeature(f)}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-7 flex-1" />
              {id === "free" ? (
                <Button className="w-full" variant="outline" disabled data-testid={`button-choose-${id}`}>
                  {isCurrent ? "Current plan" : "Included for every business"}
                </Button>
              ) : (
                // Scale isn't available to join yet - show a blurred "Upgrade"
                // so it reads as the next step, but clearly not active.
                <>
                  <Button className="w-full select-none opacity-70 blur-[1.5px] pointer-events-none" variant="default" disabled tabIndex={-1} aria-hidden data-testid={`button-choose-${id}`}>
                    Upgrade <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <p className="mt-2 text-center text-xs text-muted-foreground">Available from {SCALE_BILLING_START_LABEL}</p>
                </>
              )}
            </Card>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border px-5 py-5 sm:px-6">
          <h2 className="text-xl font-bold">Compare plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">"Coming soon" features are not available yet.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-border bg-muted/25">
                <th className="w-[50%] px-6 py-4 text-xs font-semibold text-muted-foreground">Feature</th>
                {TIERS.map(id => (
                  <th key={id} className="px-4 py-4 text-center text-sm font-semibold">{plans[id].name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_GROUPS.map(group => (
                <Fragment key={group.title}>
                  <tr className="border-b border-border bg-muted/15">
                    <td colSpan={3} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.title}
                      {"comingSoon" in group && group.comingSoon ? <span className="ml-2 normal-case"><ComingSoonBadge /></span> : null}
                    </td>
                  </tr>
                  {group.rows.map(row => (
                    <tr key={row[0]} className="border-b border-border/60 last:border-0">
                      <td className="px-6 py-3">
                        <span className="flex items-center gap-2.5 text-sm">
                          <FeatureIcon label={row[0]} muted={"comingSoon" in group && !!group.comingSoon} />
                          {row[0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center"><FeatureValue value={row[1]}/></td>
                      <td className="px-4 py-3 text-center"><FeatureValue value={row[2]}/></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground">
        <span>Prices in Rand (ZAR)</span>
        <span>{plans.business.name} billing starts {SCALE_BILLING_START_LABEL}</span>
        <span>Change or cancel any time</span>
      </div>
    </div>
  );
}
