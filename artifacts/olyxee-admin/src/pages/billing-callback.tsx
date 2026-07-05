import { useEffect, useState } from "react";
import { Link } from "wouter";
import { apiFetch, ApiError } from "@/lib/api";

/**
 * Paystack redirects the buyer here after a checkout (the callback_url set when
 * the transaction was initialized). We read the `reference` query param and
 * re-verify it server-side via /api/billing/verify/:reference, which activates
 * the plan idempotently. Verification is authoritative — we never trust the
 * redirect alone.
 */

type Phase = "verifying" | "success" | "failed";

export default function BillingCallbackPage() {
  const [phase, setPhase] = useState<Phase>("verifying");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get("reference") ?? params.get("trxref") ?? "";
    if (!reference) {
      setPhase("failed");
      setMessage("No payment reference was provided.");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch<{ status: string; activated: boolean }>(
          `/api/billing/verify/${encodeURIComponent(reference)}`,
        );
        if (cancelled) return;
        // Verification is authoritative on `status`. `activated` is false when a
        // prior verify/webhook already processed this reference (idempotent), so
        // a successful-but-already-processed payment is still a success.
        if (res.status === "success") {
          setPhase("success");
          if (!res.activated) {
            setMessage("This payment was already processed — your plan is active.");
          }
        } else {
          setPhase("failed");
          setMessage("Payment could not be confirmed. If you were charged, contact support.");
        }
      } catch (err) {
        if (cancelled) return;
        setPhase("failed");
        setMessage(
          err instanceof ApiError
            ? err.message
            : "Something went wrong verifying your payment.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      {phase === "verifying" && (
        <div data-testid="billing-callback-verifying">
          <h1 className="text-xl font-semibold">Confirming your payment…</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This only takes a moment. Please don&apos;t close this window.
          </p>
        </div>
      )}

      {phase === "success" && (
        <div data-testid="billing-callback-success">
          <h1 className="text-xl font-semibold text-green-600">Payment confirmed</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {message || "Your plan has been upgraded. Thank you!"}
          </p>
          <Link
            href="/settings"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            data-testid="link-billing-settings"
          >
            Go to settings
          </Link>
        </div>
      )}

      {phase === "failed" && (
        <div data-testid="billing-callback-failed">
          <h1 className="text-xl font-semibold text-destructive">Payment not confirmed</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          <Link
            href="/upgrade"
            className="mt-6 inline-flex items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            data-testid="link-billing-retry"
          >
            Back to plans
          </Link>
        </div>
      )}
    </div>
  );
}
