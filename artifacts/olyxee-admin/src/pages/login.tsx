import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Spinner } from "@/components/ui/spinner";

type Mode = "signin" | "signup" | "forgot";

export default function LoginPage() {
  const { signIn, signUp, requestPasswordReset } = useAuth();
  const [, setLocation] = useLocation();

  // When arriving from the hero "Try Courier Loop" CTA we assume the visitor
  // doesn't have an account yet, so default to the create-account form.
  const initialMode: Mode =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("mode") === "signup"
      ? "signup"
      : "signin";

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        const result = await requestPasswordReset(email);
        if (result.error) {
          setError(result.error);
          return;
        }
        setInfo(
          "If an account exists for that email, we've sent a link to reset your password. Check your inbox.",
        );
        return;
      }
      const result =
        mode === "signin"
          ? await signIn(email, password)
          : await signUp({ email, password, fullName, businessName });
      if (result.error) {
        setError(result.error);
        return;
      }
      setLocation(mode === "signup" ? "/onboarding" : "/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setShowPassword(false);
  }

  const fieldClass =
    "w-full bg-transparent text-[17px] leading-tight text-[#1c1c1e] placeholder:text-[#b0b0b8] outline-none";

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-7">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-[#1c1c1e] text-center">
          {mode === "signin"
            ? "Welcome back"
            : mode === "signup"
              ? "Create your account"
              : "Reset your password"}
        </h1>
        <p className="text-[15px] text-[#8e8e93] mt-2 text-center leading-snug max-w-[300px]">
          {mode === "signin"
            ? "Sign in to your Courier Loop workspace"
            : mode === "signup"
              ? "Set up Courier Loop for your business in seconds"
              : "Enter your email and we'll send you a reset link"}
        </p>
      </div>

      {mode !== "forgot" && (
        <div
          className="relative flex p-1 mb-7 bg-[#f2f2f7] rounded-[14px]"
          role="tablist"
        >
          <span
            aria-hidden
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[10px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out"
            style={{
              transform:
                mode === "signup" ? "translateX(calc(100% + 8px))" : "translateX(0)",
            }}
          />
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            onClick={() => switchMode("signin")}
            className={`relative z-10 flex-1 h-9 text-[14px] font-semibold rounded-[10px] transition-colors ${
              mode === "signin" ? "text-[#1c1c1e]" : "text-[#8e8e93]"
            }`}
            data-testid="tab-signin"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => switchMode("signup")}
            className={`relative z-10 flex-1 h-9 text-[14px] font-semibold rounded-[10px] transition-colors ${
              mode === "signup" ? "text-[#1c1c1e]" : "text-[#8e8e93]"
            }`}
            data-testid="tab-signup"
          >
            Create account
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" data-testid={`form-${mode}`}>
        <div className="rounded-[16px] bg-white border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] overflow-hidden divide-y divide-black/[0.07]">
          {mode === "signup" && (
            <>
              <div className="px-4 py-2.5">
                <label
                  htmlFor="fullName"
                  className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#8e8e93] mb-0.5"
                >
                  Your name
                </label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Jane Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={fieldClass}
                  data-testid="input-fullname"
                />
              </div>
              <div className="px-4 py-2.5">
                <label
                  htmlFor="businessName"
                  className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#8e8e93] mb-0.5"
                >
                  Business name
                </label>
                <input
                  id="businessName"
                  type="text"
                  required
                  placeholder="FreightShift Logistics"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className={fieldClass}
                  data-testid="input-business-name"
                />
              </div>
            </>
          )}

          <div className="px-4 py-2.5">
            <label
              htmlFor="email"
              className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#8e8e93] mb-0.5"
            >
              Email address
            </label>
            <input
              id="email"
              type={mode === "signin" ? "text" : "email"}
              autoComplete="email"
              inputMode="email"
              required
              placeholder={mode === "signin" ? "you@company.com or demo" : "you@company.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              data-testid="input-email"
            />
          </div>

          {mode !== "forgot" && (
            <div className="px-4 py-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <label
                  htmlFor="password"
                  className="block text-[11px] font-medium uppercase tracking-[0.06em] text-[#8e8e93]"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[12px] font-medium text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
                  data-testid="button-toggle-password"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                placeholder={
                  mode === "signup" ? "At least 8 characters" : "Enter your password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={fieldClass}
                data-testid="input-password"
              />
            </div>
          )}
        </div>

        {mode === "signin" && (
          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-[13px] font-medium text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
              data-testid="button-forgot-password"
            >
              Forgot password?
            </button>
          </div>
        )}

        {info ? (
          <div
            className="text-[13px] text-emerald-700 border border-emerald-200 bg-emerald-50 rounded-[12px] px-4 py-3 leading-snug"
            data-testid="text-info"
          >
            {info}
          </div>
        ) : null}

        {error ? (
          <div
            className="text-[13px] text-red-600 border border-red-200 bg-red-50 rounded-[12px] px-4 py-3 leading-snug"
            data-testid="text-error"
          >
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full h-[52px] rounded-[14px] bg-[#1c1c1e] text-white font-semibold text-[17px] flex items-center justify-center gap-2 transition-all duration-150 hover:bg-black active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100"
          data-testid={`button-${mode}`}
        >
          {submitting ? (
            <>
              <Spinner className="size-4 text-white" />
              {mode === "signin"
                ? "Signing in…"
                : mode === "signup"
                  ? "Creating account…"
                  : "Sending reset link…"}
            </>
          ) : mode === "signin" ? (
            "Sign in"
          ) : mode === "signup" ? (
            "Create account"
          ) : (
            "Send reset link"
          )}
        </button>

        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="block mx-auto text-[14px] font-medium text-[#8e8e93] hover:text-[#1c1c1e] transition-colors"
            data-testid="button-back-to-signin"
          >
            Back to sign in
          </button>
        )}

        {mode === "signup" && (
          <p className="text-[12px] text-center text-[#b0b0b8] leading-relaxed px-2">
            By creating an account you agree to our Terms and Privacy Policy.
          </p>
        )}
      </form>

      <p className="text-[10px] text-center text-[#b0b0b8] mt-10 tracking-[0.15em] uppercase">
        Powered by Courier Loop
      </p>
    </AuthLayout>
  );
}
