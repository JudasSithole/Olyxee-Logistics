import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { PublicShell } from "@/components/public-shell";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { useEffect } from "react";
import { useBusiness } from "@/hooks/use-supabase-queries";
import { Spinner } from "@/components/ui/spinner";

import LandingPage from "@/pages/landing";
import ContactPage from "@/pages/contact";
import LoginPage from "@/pages/login";
import ResetPasswordPage from "@/pages/reset-password";
import TrackPage from "@/pages/track";
import BusinessTypePage from "@/pages/business-type";
import OnboardingPage from "@/pages/onboarding";
import DashboardPage from "@/pages/dashboard";
import CustomersPage from "@/pages/customers";
import CustomerDetailPage from "@/pages/customer-detail";
import OrdersPage from "@/pages/orders";
import OrderDetailPage from "@/pages/order-detail";
import SettingsPage from "@/pages/settings";
import ProfilePage from "@/pages/profile";
import UpdatesPage from "@/pages/updates";
import UpgradePage from "@/pages/upgrade";
import PricingPage from "@/pages/pricing";
import BillingCallbackPage from "@/pages/billing-callback";
import NotFound from "@/pages/not-found";
import InvoiceDetailPage from "@/pages/invoice-detail";
import InvoicesPage from "@/pages/invoices";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Protected({
  component: Component,
  skipOnboardingGuard = false,
  withLayout = true,
}: {
  component: React.ComponentType;
  skipOnboardingGuard?: boolean;
  withLayout?: boolean;
}) {
  const { status, user } = useAuth();
  const businessQuery = useBusiness(
    status === "authenticated" ? user?.businessId : null,
  );

  // Pre-auth check is usually instant (cookie/session resolves on first tick).
  // Render nothing instead of a full white viewport so a quick check doesn't
  // flash a "page crashed" looking blank screen at the user.
  if (status === "loading") {
    return null;
  }
  if (status === "unauthenticated") {
    return <Redirect to="/login" />;
  }

  if (!skipOnboardingGuard) {
    if (businessQuery.isLoading) {
      // We're already authenticated here - render the real app chrome with a
      // small inline spinner in the content area so the sidebar stays put
      // and the page feels like it's loading data, not crashing.
      return (
        <AppLayout>
          <div
            className="flex min-h-[40vh] items-center justify-center"
            role="status"
            aria-label="Loading"
          >
            <Spinner className="size-6 text-primary" />
          </div>
        </AppLayout>
      );
    }
    if (businessQuery.isError) {
      return (
        <AppLayout>
          <div className="mx-auto max-w-lg rounded-lg border border-destructive/30 bg-card p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold">Unable to load your workspace</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              The server could not load the business data. Check the database connection and try again.
            </p>
            <button
              type="button"
              className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              onClick={() => businessQuery.refetch()}
            >
              Try again
            </button>
          </div>
        </AppLayout>
      );
    }
    if (businessQuery.data && !businessQuery.data.onboarding_completed) {
      if (!businessQuery.data.business_type) {
        return <Redirect to="/business-type" />;
      }
      return <Redirect to="/onboarding" />;
    }
  }

  if (!withLayout) return <Component />;
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function PublicOnly({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  // Same reasoning as Protected: auth check is fast, render nothing rather
  // than flashing a blank white screen that looks broken.
  if (status === "loading") {
    return null;
  }
  if (status === "authenticated") {
    return <Redirect to="/dashboard" />;
  }
  return <Component />;
}

// Announcement / pricing pages are public: logged-out visitors see them wrapped
// in the public site chrome (header + nav tabs), while authenticated users see
// them inside the app sidebar layout.
function PublicOrApp({ component: Component }: { component: React.ComponentType }) {
  const { status } = useAuth();
  if (status === "loading") {
    return null;
  }
  if (status === "authenticated") {
    return (
      <AppLayout>
        <Component />
      </AppLayout>
    );
  }
  return (
    <PublicShell>
      <Component />
    </PublicShell>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={() => <PublicOnly component={LandingPage} />} />
      <Route path="/contact" component={ContactPage} />
      <Route path="/login" component={() => <PublicOnly component={LoginPage} />} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/track" component={TrackPage} />
      <Route path="/track/:trackingId" component={TrackPage} />
      <Route path="/signup"><Redirect to="/login" /></Route>
      <Route
        path="/business-type"
        component={() => (
          <Protected component={BusinessTypePage} skipOnboardingGuard withLayout={false} />
        )}
      />
      <Route
        path="/onboarding"
        component={() => (
          <Protected component={OnboardingPage} skipOnboardingGuard withLayout={false} />
        )}
      />
      <Route path="/dashboard" component={() => <Protected component={DashboardPage} />} />
      <Route path="/customers" component={() => <Protected component={CustomersPage} />} />
      <Route path="/customers/:id" component={() => <Protected component={CustomerDetailPage} />} />
      <Route path="/orders" component={() => <Protected component={OrdersPage} />} />
      <Route path="/orders/:id" component={() => <Protected component={OrderDetailPage} />} />
      <Route path="/invoices" component={() => <Protected component={InvoicesPage} />} />
      <Route path="/invoices/:id" component={() => <Protected component={InvoiceDetailPage} />} />
      {/* Legacy /audit-logs URL - bounce to the new Settings → Activity tab. */}
      <Route path="/audit-logs">
        {() => {
          if (typeof window !== "undefined") {
            window.location.replace(`${basePath}/settings#activity`);
          }
          return null;
        }}
      </Route>
      <Route path="/updates" component={() => <PublicOrApp component={UpdatesPage} />} />
      <Route path="/whats-new"><Redirect to="/updates" /></Route>
      <Route path="/coming-soon"><Redirect to="/updates" /></Route>
      <Route path="/upgrade" component={() => <PublicOrApp component={UpgradePage} />} />
      <Route path="/pricing" component={() => <PublicOrApp component={PricingPage} />} />
      <Route
        path="/billing/callback"
        component={() => (
          <Protected component={BillingCallbackPage} skipOnboardingGuard withLayout={false} />
        )}
      />
      <Route path="/settings" component={() => <Protected component={SettingsPage} />} />
      <Route path="/profile" component={() => <Protected component={ProfilePage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Tells the theme whether tenant branding (favicon + tab title) should be
// active. It only switches on once the user is authenticated, so logged-out
// visitors always see our Olyxee Logistics favicon.
function BrandingSync() {
  const { status, user } = useAuth();
  const { data: business } = useBusiness(user?.businessId);
  const { setBrandingActive, saveSettings } = useTheme();
  useEffect(() => {
    setBrandingActive(status === "authenticated");
  }, [status, setBrandingActive]);
  useEffect(() => {
    if (!business) return;
    saveSettings({
      businessName: business.name,
      logoUrl: business.business_logo_url ?? "",
      primaryColor: business.primary_brand_colour || "#2b2b2b",
    });
  }, [business?.name, business?.business_logo_url, business?.primary_brand_colour, saveSettings]);
  return null;
}

function App() {
  return (
    <ThemeProvider>
      <WouterRouter base={basePath}>
        <TooltipProvider>
          <AuthProvider>
            <QueryClientProvider client={queryClient}>
              <BrandingSync />
              <AppRoutes />
            </QueryClientProvider>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
