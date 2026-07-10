import { FC, ReactNode } from "react";
import { Link, useLocation } from "wouter";
import orderLoopLogo from "@assets/Order-Loop_trans_1781656242217.png";

const TABS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/upgrade", label: "Upgrade Plan" },
];

// Public chrome for logged-out visitors viewing the announcement / pricing
// pages. Authenticated users see these same pages inside the app sidebar
// layout instead (see App.tsx).
export const PublicShell: FC<{ children: ReactNode }> = ({ children }) => {
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center" data-testid="link-home">
            <img
              src={orderLoopLogo}
              alt="Order Loop"
              className="h-8 w-auto object-contain sm:h-9"
            />
          </Link>
          <nav className="flex items-center gap-0.5 sm:gap-1">
            {TABS.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                data-testid={`nav-${t.href.slice(1)}`}
                className={`rounded-full px-2.5 py-2 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  location === t.href
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            ))}
            <Link
              href="/login"
              data-testid="nav-login"
              className="ml-1 rounded-full bg-foreground px-3 py-2 text-xs font-medium text-background transition-opacity hover:opacity-90 sm:px-4 sm:text-sm"
            >
              Log In
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
};
