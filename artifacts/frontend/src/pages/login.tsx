import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth-context";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const logoUrl = `${import.meta.env.BASE_URL}favicon.png`;

type Mode = "signin" | "signup";

export default function LoginPage() {
  const { signIn, signUp, isConfigured } = useAuth();
  const [, setLocation] = useLocation();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    setLocation("/dashboard");
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    const result = await signUp(email, password, fullName, businessName);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setInfo(
        "Check your inbox for a confirmation link. Once confirmed, sign in to finish setting up your business.",
      );
      return;
    }
    setLocation("/onboarding");
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setInfo(null);
    setPassword("");
  }

  return (
    <AuthLayout>
      <div className="flex flex-col items-center mb-8">
        <img src={logoUrl} alt="Olyxee" className="h-14 w-14 mb-5" data-testid="img-logo" />
        <h1 className="text-[26px] font-semibold text-[hsl(220,20%,10%)] tracking-tight text-center">
          {mode === "signin" ? "Welcome to Olyxee Logistics" : "Create your business account"}
        </h1>
        <p className="text-[15px] text-[hsl(220,9%,46%)] mt-1.5 text-center">
          {mode === "signin"
            ? "Sign in to continue"
            : "Set up Olyxee for your business"}
        </p>
      </div>

      {!isConfigured ? (
        <div
          className="text-xs text-amber-700 border border-amber-200 bg-amber-50 p-3 mb-5"
          data-testid="text-config-warning"
        >
          Supabase is not configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> on your deployment for sign-in to work.
        </div>
      ) : null}

      {mode === "signin" && (
        <form onSubmit={handleSignIn} className="space-y-5" data-testid="form-signin">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-password"
            />
          </div>

          {error ? (
            <div className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3" data-testid="text-error">
              {error}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting || !email || !password}
            className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px]"
            data-testid="button-signin"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <p className="text-[13px] text-center text-[hsl(220,9%,46%)]">
            Don't have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="text-[hsl(220,20%,10%)] hover:underline font-medium"
              data-testid="button-switch-signup"
            >
              Create one
            </button>
          </p>
        </form>
      )}

      {mode === "signup" && (
        <form onSubmit={handleSignUp} className="space-y-5" data-testid="form-signup">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Your name
            </Label>
            <Input
              id="fullName"
              type="text"
              autoComplete="name"
              required
              autoFocus
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-fullname"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Business name
            </Label>
            <Input
              id="businessName"
              type="text"
              required
              placeholder="FreightShift Logistics"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-business-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Email address
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[13px] font-medium text-[hsl(220,20%,10%)]">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 bg-white border-[hsl(220,13%,82%)] focus-visible:border-[hsl(220,20%,10%)] focus-visible:ring-0"
              data-testid="input-password"
            />
          </div>

          {error ? (
            <div className="text-[13px] text-red-600 border border-red-200 bg-red-50 p-3" data-testid="text-error">
              {error}
            </div>
          ) : null}

          {info ? (
            <div
              className="text-[13px] text-green-700 border border-green-200 bg-green-50 p-3"
              data-testid="text-info"
            >
              {info}
            </div>
          ) : null}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-11 bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,20%)] text-white font-medium text-[15px]"
            data-testid="button-create-account"
          >
            {submitting ? "Creating account…" : "Create business account"}
          </Button>

          <p className="text-[12px] text-center text-[hsl(220,9%,46%)]">
            By creating an account you agree to Olyxee's terms of service.
          </p>

          <p className="text-[13px] text-center text-[hsl(220,9%,46%)]">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signin")}
              className="text-[hsl(220,20%,10%)] hover:underline font-medium"
              data-testid="button-switch-signin"
            >
              Sign in
            </button>
          </p>
        </form>
      )}

      <p className="text-[10px] text-center text-[hsl(220,9%,60%)] mt-10 tracking-[0.15em] uppercase">
        Powered by Olyxee
      </p>
    </AuthLayout>
  );
}
