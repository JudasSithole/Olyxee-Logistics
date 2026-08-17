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
  free: "Everything you need to run freight jobs today.",
  business: "Less manual work as your business grows.",
};

// One distinct icon per feature, matched by keyword so it keeps working if
// catalog wording is tweaked.
const ICON_RULES: [RegExp, LucideIcon][] = [
  [/customer management|customer and order/i, Users],
  [/order management/i, Package],
  [/invoic/i, FileText],
  [/air and sea|shipment workflows/i, Ship],
  [/branded/i, Palette],
  [/tracking/i, MapPin],
  [/delivery|collection/i, Truck],
  [/email/i, Mail],
  [/dashboard|insights/i, BarChart3],
  [/orgni/i, Sparkles],
  [/follow-up/i, MessagesSquare],
  [/document/i, FileSearch],
  [/exception/i, AlertTriangle],
  [/eta|deadline/i, Clock],
  [/alert/i, Bell],
  [/customs|clearance/i, ClipboardCheck],
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
  { title: "Orgni Intelligence", comingSoon: true, rows: [
    ["Automated follow-ups", false, "soon"],
    ["Document monitoring", false, "soon"],
    ["Exception detection", false, "soon"],
    ["ETA and deadline monitoring", false, "soon"],
    ["Operational alerts", false, "soon"],
    ["Easier customs-clearance workflows", false, "soon"],
    ["Task escalation", false, "soon"],
    ["Customer communication automation", false, "soon"],
    ["Call-centre capabilities", false, "soon"],
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
  // non-charging plan selection — no checkout, no payment.
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
      <header className="border-b border-border pb-7 pt-2">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Pricing</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Two plans. Start free.</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">
            Free covers your day-to-day freight work. Scale adds Orgni automation as it's released.
          </p>
        </div>
      </header>

      <Card className="rounded-2xl border-primary/25 bg-primary/[0.04] p-4 shadow-none">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{plans.business.name} billing starts {SCALE_BILLING_START_LABEL}.</span>{" "}
          Join today, pay nothing until then. Existing businesses stay on {plans.free.name} at no cost.
        </p>
      </Card>

      {errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5 p-4" data-testid="billing-error">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {TIERS.map((id) => {
          const p = plans[id];
          const isCurrent = currentPlan === id;
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
                    <span className="text-sm text-muted-foreground">/month per company</span>
                  )}
                </div>
                {id === "business" && (
                  <p className="mt-2 text-xs font-medium text-primary">Billing starts {SCALE_BILLING_START_LABEL}</p>
                )}
              </div>

              <p className="mt-5 text-xs font-semibold text-foreground">
                {id === "business" ? "Everything in Free, plus" : "Included"}
              </p>
              <ul className="mt-3 space-y-2.5">
                {(p.features ?? []).filter((f) => id !== "business" || f !== "Everything in Free").map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <FeatureIcon label={f} />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              {(p.comingSoon?.length ?? 0) > 0 && (
                <>
                  <p className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />Orgni Intelligence <ComingSoonBadge />
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {(p.comingSoon ?? []).filter((f) => f !== "Orgni Intelligence").map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-sm">
                        <FeatureIcon label={f} muted />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-7 flex-1" />
              <Button
                className="w-full"
                variant={id === "business" ? "default" : "outline"}
                disabled={
                  pendingPlan !== null || (isAuthed && isCurrent) || id === "free"
                }
                onClick={() => (checkoutEnabled ? handleChoose(id) : handleJoin(id))}
                data-testid={`button-choose-${id}`}
              >
                {pendingPlan === id && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {id === "free"
                  ? isAuthed && isCurrent
                    ? "Current plan"
                    : "Included for every business"
                  : isAuthed && isCurrent
                    ? "Current plan"
                    : !isAuthed
                      ? "Log in to get started"
                      : !checkoutEnabled
                        ? `Join ${p.name}`
                        : devTestBilling
                          ? `Test ${p.name} checkout`
                          : `Choose ${p.name}`}
                {pendingPlan !== id && !isCurrent && id !== "free" ? <ArrowRight className="ml-2 h-4 w-4"/> : null}
              </Button>
              {id === "business" && !checkoutEnabled && (
                <p className="mt-2 text-center text-xs text-muted-foreground">No charge before {SCALE_BILLING_START_LABEL}</p>
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
