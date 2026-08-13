import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowRight, Check, Loader2, PackageCheck, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="mx-auto max-w-6xl space-y-7 pb-12">
      <header className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="max-w-2xl"><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><Sparkles className="h-3.5 w-3.5"/>Simple monthly pricing</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Choose the capacity your logistics team needs.</h1><p className="mt-3 text-base leading-relaxed text-muted-foreground">Every plan includes the complete order-to-invoice workflow, customer records, and public shipment tracking. Upgrade when your monthly volume grows.</p></div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 px-4 py-3"><PackageCheck className="h-5 w-5 text-primary"/><div><p className="text-sm font-semibold">No setup fees</p><p className="text-xs text-muted-foreground">Prices are monthly in ZAR</p></div></div>
        </div>
      </header>

      {isAuthed && currentPlan === "beta" && (
        <Card className="border-primary/20 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-3"><Badge>BETA ACCESS</Badge><p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Your current account remains unlimited.</span> Paid subscriptions become available on {LAUNCH_LABEL}; no action is required today.</p></div>
        </Card>
      )}

      {errorMsg && (
        <Card className="border-destructive/30 bg-destructive/5 p-4" data-testid="billing-error">
          <p className="text-sm text-destructive">{errorMsg}</p>
        </Card>
      )}

      <div className="grid gap-5 md:grid-cols-3">
        {TIERS.map((id) => {
          const p = plans[id];
          const isCurrent = currentPlan === id;
          const isPro = id === "pro";
          return (
            <Card
              key={id}
              data-testid={`plan-${id}`}
              className={`relative flex min-h-[500px] flex-col overflow-hidden p-6 ${
                isPro ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "shadow-sm"
              }`}
            >
              {isPro && (
                <div className="absolute inset-x-0 top-0 bg-primary py-1.5 text-center text-[11px] font-bold uppercase tracking-widest text-primary-foreground">Most popular</div>
              )}
              <div className={isPro ? "pt-5" : ""}><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{PLAN_COPY[id as "free"|"pro"|"business"].eyebrow}</p><h2 className="mt-2 text-xl font-bold">{p.name}</h2><p className="mt-2 min-h-[60px] text-sm leading-relaxed text-muted-foreground">{PLAN_COPY[id as "free"|"pro"|"business"].description}</p></div>
              <div className="mt-5 flex items-baseline gap-1 border-b border-border pb-5">
                <span className="text-4xl font-bold tracking-tight">
                  {formatPrice(p.price)}
                </span>
                {p.price > 0 && (
                  <span className="text-sm text-muted-foreground">/month</span>
                )}
              </div>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-foreground">What&apos;s included</p><ul className="mt-3 space-y-3">
                {featureList(id).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"><Check className="h-3 w-3 text-primary" /></span><span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7 flex-1" />
              <Button
                className="w-full"
                variant={isPro ? "default" : "outline"}
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

      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-border pt-5 text-xs text-muted-foreground"><span>Prices in South African Rand (ZAR)</span><span>Change or cancel at any time</span><span>No payment gateway is used for customer invoices</span></div>
    </div>
  );
}
