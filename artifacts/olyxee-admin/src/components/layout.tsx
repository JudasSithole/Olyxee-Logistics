import React from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Package, FileText,
  Menu, Moon, Sun, Settings, LogOut,
  ArrowUpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { InstallAppPrompt } from "@/components/install-app-prompt";

function UserRow() {
  const { user, signOut } = useAuth();
  const [location, setLocation] = useLocation();

  // AuthUser exposes `name` + `email` directly (set by the auth context from
  // /auth/me). The previous `user_metadata` shape was a leftover from an
  // earlier Supabase implementation and never existed on this type.
  const fullName = user?.name || user?.email || "User";
  const email = user?.email ?? "";
  const initial = (fullName || "U").charAt(0).toUpperCase();
  const isOnProfile = location === "/profile";

  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      {/* Avatar + name double as the link to the profile page so the user
          can click their name in the sidebar to manage their account. */}
      <Link
        href="/profile"
        className={`flex items-center gap-2.5 flex-1 min-w-0 -mx-1 px-1 py-1 transition-colors ${
          isOnProfile
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
        }`}
        title="Edit your profile"
        data-testid="link-profile"
      >
        <Avatar className="h-7 w-7 flex-shrink-0">
          <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{fullName}</p>
          {email ? (
            <p className="text-xs text-sidebar-foreground/50 truncate">{email}</p>
          ) : null}
        </div>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          setLocation("/login");
        }}
        className="text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors p-1"
        aria-label="Sign out"
        title="Sign out"
        data-testid="button-signout"
      >
        <LogOut className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/invoices", label: "Invoices", icon: FileText },
];

// Launch-prep nav: pricing.
const GROWTH_ITEMS = [
  { href: "/upgrade", label: "Upgrade plan", icon: ArrowUpCircle },
];

// A single nav row used for every sidebar link so the active treatment -
// a left accent bar plus filled background - stays perfectly consistent.
function NavLink({
  href, label, icon: Icon, active,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-2.5 pl-3.5 pr-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-200 ${
          active ? "h-5 bg-sidebar-primary-foreground" : "h-0 bg-transparent group-hover:h-3 group-hover:bg-sidebar-foreground/30"
        }`}
      />
      <Icon className="h-4 w-4 flex-shrink-0" />
      {label}
    </Link>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isDark, setIsDark, logoUrl, businessName } = useTheme();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo / Brand - logo (or initial fallback) + company name, always side
          by side so the brand is named even when a logo is uploaded. */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-sidebar-border flex-shrink-0 min-w-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={businessName}
            className="h-7 w-auto object-contain max-w-[80px] flex-shrink-0"
          />
        ) : (
          <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <span className="text-white text-xs font-bold leading-none">
              {businessName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <span className="font-semibold text-sm tracking-tight truncate min-w-0">
          {businessName}
        </span>
      </div>

      {/* Primary nav - the three core workspace destinations sit at the top on
          their own so the everyday navigation stays uncluttered. */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={location === item.href || location.startsWith(item.href + "/")}
            />
          ))}
        </div>
      </nav>

      {/* Secondary navigation stays separate from the primary workflow. */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2 border-t border-sidebar-border">
        <div className="space-y-0.5">
          {GROWTH_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={location === item.href || location.startsWith(item.href + "/")}
            />
          ))}
          <NavLink
            href="/settings"
            label="Settings"
            icon={Settings}
            active={location.startsWith("/settings")}
          />
        </div>

      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-sidebar-border">
        {/* User row */}
        <UserRow />

        {/* Olyxee branding */}
        <div className="px-5 py-2 border-t border-sidebar-border">
          <p className="text-[10px] text-sidebar-foreground/25 tracking-widest uppercase">Powered by Olyxee</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      <InstallAppPrompt />
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-12 bg-sidebar border-b border-sidebar-border flex items-center px-4 gap-3">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-sidebar-foreground">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-56 border-r-0">
            <SidebarContent />
          </SheetContent>
        </Sheet>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sidebar-foreground">{businessName}</span>
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          aria-pressed={isDark}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>

      {/* Main Content.
          The outer <div> owns the scroll. The inner wrapper centers content
          and caps width at 1536px so tables and cards have breathing room on
          ultra-wide monitors instead of sprawling edge-to-edge - but tables
          can still use the full container width on a 27" screen.
          Padding scales: tight on mobile, generous on desktop. */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:mt-0 mt-12">
        <div className="hidden h-14 shrink-0 items-center justify-end border-b border-border/60 bg-background/90 px-6 backdrop-blur md:flex lg:px-8 xl:px-10">
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="relative flex h-9 w-[68px] items-center rounded-full border border-border bg-muted/60 p-1 shadow-sm transition-colors hover:bg-muted"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
            <Moon className="absolute right-2 h-3.5 w-3.5 text-muted-foreground" />
            <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background text-foreground shadow-sm transition-transform duration-200 ${isDark ? "translate-x-7" : "translate-x-0"}`}>
              {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </span>
          </button>
        </div>
        <div className="flex-1 overflow-auto">
          <div
            key={location}
            className="animate-page mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10"
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
