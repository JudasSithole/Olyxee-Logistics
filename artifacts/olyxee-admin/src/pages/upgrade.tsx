import { useState } from "react";
import { useLocation } from "wouter";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/hooks/use-supabase-queries";
import { LaunchCountdown } from "@/components/launch-countdown";
import { apiFetch, ApiError } from "@/lib/api";
import {
  plans,
  featureFlags,
  LAUNCH_LABEL,
  TRIAL_LABEL,
  type PlanId,
} from "@/lib/launch";

function formatPrice(price: number): string {
  return price === 0 ? "Free" : `R${price}`;
}

function featureList(id: PlanId): string[] {
  const p = plans[id];
  const out: string[] = [];
  out.push(
    p.customerLimit == null
      ? "Unlimited customers"
      : `Up to ${p.customerLimit} customers`,
  );
  out.push(
    p.emailLimit == null
      ? "Unlimited email notifications"
      : `${p.emailLimit} email notifications / month`,
  );
  if (p.smsLimit && p.smsLimit > 0) {
    out.push(`${p.smsLimit} SMS notifications / month`);
  }
  if (p.advancedCustomization) out.push("Advanced customization");
  if (p.removeOlyxeeBranding) out.push("Remove Olyxee branding");
  if (p.apiAccess) out.push("Public API access");
  if (p.automatedCallCentre) out.push("Automated call centre");
  return out;
}

const TIERS: PlanId[] = ["free", "pro", "business"];

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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plans &amp; Pricing</h1>
          <p className="text-sm text-muted-foreground">
            Choose the plan that fits your business.
          </p>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5 p-5 text-center">
        <p className="text-sm font-medium text-foreground">
          Paid plans go live on {LAUNCH_LABEL}
        </p>
        <LaunchCountdown className="mt-2 justify-center" />
      </Card>

      {isAuthed && currentPlan === "beta" && (
        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <Badge className="mt-0.5">BETA</Badge>
            <p className="text-sm text-muted-foreground">
              You&apos;re on the <span className="font-medium text-foreground">BETA plan</span>{" "}
              with unlimited access and no limits. Paid plans go live on{" "}
              {LAUNCH_LABEL}. As an existing business, you&apos;ll get Pro free
              during {TRIAL_LABEL}.
            </p>
          </div>
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
          const isPro = id === "pro";
          return (
            <Card
              key={id}
              data-testid={`plan-${id}`}
              className={`relative flex flex-col p-6 ${
                isPro ? "border-primary shadow-md" : ""
              }`}
            >
              {isPro && (
                <Badge className="absolute -top-2.5 left-6">Most popular</Badge>
              )}
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">
                  {formatPrice(p.price)}
                </span>
                {p.price > 0 && (
                  <span className="text-sm text-muted-foreground">/month</span>
                )}
              </div>

              <ul className="mt-5 space-y-2.5">
                {featureList(id).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex-1" />
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
                        ? `Test checkout`
                        : `Choose ${p.name}`}
              </Button>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Prices in South African Rand (ZAR). You can change or cancel your plan
        at any time.
      </p>
    </div>
  );
}
