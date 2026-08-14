import { Fragment, useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Check, Loader2, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/hooks/use-supabase-queries";
import { apiFetch, ApiError } from "@/lib/api";
import {
  plans,
  featureFlags,
  LAUNCH_LABEL,
  type PlanId,
} from "@/lib/launch";

function formatPrice(price: number): string {
  return price === 0 ? "Free" : `R${price}`;
}

function featureList(id: PlanId): string[] {
  return plans[id].features ?? [];
}

const TIERS: PlanId[] = ["free", "pro", "business"];
const PLAN_COPY: Record<"free"|"pro"|"business", { eyebrow:string; description:string }> = {
  free: { eyebrow:"For getting started", description:"Run a small cross-border operation with the core order and invoice workflow." },
  pro: { eyebrow:"For growing teams", description:"Add higher order volume, customer communication, and your own brand." },
  business: { eyebrow:"For busy operations", description:"Handle larger monthly volumes with priority help when your team needs it." },
};

const FEATURE_GROUPS = [
  { title: "Operations", rows: [
    ["Orders each month", "50", "300", "1,000"],
    ["Customer and order management", true, true, true],
    ["Air and sea freight workflows", true, true, true],
    ["Manual payment confirmation", true, true, true],
    ["Dashboard and business insights", true, true, true],
  ]},
  { title: "Customer experience", rows: [
    ["Public shipment tracking", true, true, true],
    ["Cancel and reschedule requests", true, true, true],
    ["Email status notifications", true, true, true],
    ["SMS notifications", false, "100 / month", "100 / month"],
  ]},
  { title: "Invoices and brand", rows: [
    ["Automatic PDF invoices", true, true, true],
    ["Invoice payment details", true, true, true],
    ["Custom logo and company colour", false, true, true],
    ["Remove Olyxee branding", false, true, true],
  ]},
  { title: "Support", rows: [
    ["Standard support", true, true, true],
    ["Priority support", false, false, true],
  ]},
] as const;

function FeatureValue({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-4 w-4" aria-label="Included" />;
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" aria-label="Not included" />;
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
  // For normal users (flag off, no test billing) the buttons stay
  // "Available <date>" and disabled.
  const envTestBilling = ["1", "true"].includes(
    String(import.meta.env.VITE_ENABLE_TEST_BILLING ?? "").toLowerCase(),
  );
  const devTestBilling = (import.meta.env.DEV || envTestBilling) && !billingLive;
  // Whether checkout is possible at all in this environment (auth-independent).
  const checkoutEnabled = billingLive || devTestBilling;
  // Checkout requires an authenticated business; public visitors are routed to
  // login first.
  const canCheckout = isAuthed && checkoutEnabled;

  const [pendingPlan, setPendingPlan] = useState<PlanId | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <header className="border-b border-border pb-7 pt-2">
        <div className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Plans and pricing</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Choose a plan that fits your order volume.</h1>
          <p className="mt-3 text-base leading-7 text-muted-foreground">All plans include the full cross-border order workflow, customer records, PDF invoices, email updates, and a customer tracking page. Upgrade for more capacity and branding.</p>
        </div>
      </header>

      {isAuthed && currentPlan === "beta" && (
        <Card className="rounded-2xl border-border p-4 shadow-none">
          <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Your beta account is currently unlimited.</span> Paid subscriptions become available on {LAUNCH_LABEL}; you do not need to do anything today.</p>
        </Card>
      )}

      {errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5 p-4" data-testid="billing-error">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {TIERS.map((id) => {
          const p = plans[id];
          const isCurrent = currentPlan === id;
          return (
            <Card
              key={id}
              data-testid={`plan-${id}`}
              className="relative flex flex-col rounded-3xl border-border/70 p-6 shadow-sm"
            >
              <div><p className="text-xs font-medium text-muted-foreground">{PLAN_COPY[id as "free"|"pro"|"business"].eyebrow}</p><div className="mt-2 flex items-center gap-2"><h2 className="text-xl font-bold">{p.name}</h2>{id === "pro" && <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">Recommended</span>}</div><p className="mt-2 min-h-[60px] text-sm leading-relaxed text-muted-foreground">{PLAN_COPY[id as "free"|"pro"|"business"].description}</p></div>
              <div className="mt-5 flex items-baseline gap-1 border-b border-border pb-5">
                <span className="text-4xl font-bold tracking-tight">
                  {formatPrice(p.price)}
                </span>
                {p.price > 0 && (
                  <span className="text-sm text-muted-foreground">/month</span>
                )}
              </div>

              <p className="mt-5 text-xs font-semibold text-foreground">Plan highlights</p><ul className="mt-3 space-y-2.5">
                {featureList(id).slice(0, 5).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0" /><span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex-1" />
              <Button
                className="w-full"
                variant={id === "pro" ? "default" : "outline"}
                disabled={
                  pendingPlan !== null || !checkoutEnabled || (isAuthed && isCurrent)
                }
                onClick={() => handleChoose(id)}
                data-testid={`button-choose-${id}`}
              >
                {pendingPlan === id && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {!checkoutEnabled
                  ? `Available ${LAUNCH_LABEL}`
                  : !isAuthed
                    ? "Log in to get started"
                    : isCurrent
                      ? "Current plan"
                      : devTestBilling
                        ? `Test ${p.name} checkout`
                        : `Choose ${p.name}`}
                {pendingPlan !== id && checkoutEnabled && !isCurrent ? <ArrowRight className="ml-2 h-4 w-4"/> : null}
              </Button>
            </Card>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="border-b border-border px-5 py-5 sm:px-6"><h2 className="text-xl font-bold">Compare every feature</h2><p className="mt-1 text-sm text-muted-foreground">A complete view of what each plan includes.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <thead><tr className="border-b border-border bg-muted/25"><th className="w-[46%] px-6 py-4 text-xs font-semibold text-muted-foreground">Feature</th>{TIERS.map(id=><th key={id} className="px-4 py-4 text-center text-sm font-semibold">{plans[id].name}</th>)}</tr></thead>
            <tbody>{FEATURE_GROUPS.map(group=><Fragment key={group.title}><tr className="border-b border-border bg-muted/15"><td colSpan={4} className="px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group.title}</td></tr>{group.rows.map(row=><tr key={row[0]} className="border-b border-border/60 last:border-0"><td className="px-6 py-3.5 text-sm">{row[0]}</td><td className="px-4 py-3.5 text-center"><FeatureValue value={row[1]}/></td><td className="px-4 py-3.5 text-center"><FeatureValue value={row[2]}/></td><td className="px-4 py-3.5 text-center"><FeatureValue value={row[3]}/></td></tr>)}</Fragment>)}</tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground"><span>Prices in South African Rand (ZAR)</span><span>Change or cancel at any time</span><span>No payment gateway is used for customer invoices</span></div>
    </div>
  );
}
