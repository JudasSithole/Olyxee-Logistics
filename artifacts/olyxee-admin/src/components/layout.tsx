import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, Package, Wallet,
  Menu, Moon, Sun, Settings, LogOut, User, ChevronDown,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/theme-context";
import { useAuth } from "@/contexts/auth-context";
import { useBusiness } from "@/hooks/use-supabase-queries";
import { InstallAppPrompt } from "@/components/install-app-prompt";
import { SettingsModal, SettingsModalContext, useSettingsModal } from "@/components/settings-modal";

// The account menu, top-right on every page. Click the avatar chip to open a
// dropdown with profile, settings, appearance (light/dark) and sign-out — so
// everything account/display-related lives in one place.
function TopUser() {
  const { user, signOut } = useAuth();
  const { data: business } = useBusiness(user?.businessId);
  const { open: openSettings } = useSettingsModal();
  const [, setLocation] = useLocation();
  const fullName = user?.name || user?.email || "User";
  const email = user?.email ?? "";
  const initial = (fullName || "U").charAt(0).toUpperCase();
  // Show the plan + an Upgrade entry for anyone not on Scale. Routes to the one
  // existing upgrade flow (no competing upgrade systems).
  const planId = business?.plan ?? "beta";
  const planLabel = planId === "business" ? "Scale" : "Starter";
  const showUpgrade = planId !== "business";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring sm:pr-2"
          data-testid="button-user-menu"
          aria-label="Account menu"
        >
          <Avatar className="h-7 w-7 flex-shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initial}</AvatarFallback></Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium sm:inline">{fullName}</span>
          <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar className="h-9 w-9 flex-shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-sm">{initial}</AvatarFallback></Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{fullName}</p>
            {email ? <p className="truncate text-xs text-muted-foreground">{email}</p> : null}
            <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{planLabel} plan</p>
          </div>
        </div>
        {showUpgrade ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLocation("/upgrade")} className="font-medium" data-testid="link-upgrade"><Sparkles className="mr-2 h-4 w-4" /> Upgrade to Scale</DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setLocation("/profile")} data-testid="link-profile"><User className="mr-2 h-4 w-4" /> Edit profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => openSettings()} data-testid="link-settings"><Settings className="mr-2 h-4 w-4" /> Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={async () => { await signOut(); setLocation("/login"); }} className="text-destructive focus:text-destructive" data-testid="button-signout"><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/orders", label: "Jobs", icon: Package },
  { href: "/finance", label: "Finance", icon: Wallet },
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
      className={`group relative flex items-center gap-2.5 pl-3.5 pr-3 py-2 text-sm rounded-lg transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98] ${
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-200 ${
          active ? "h-5 bg-sidebar-foreground/45" : "h-0 bg-transparent group-hover:h-3 group-hover:bg-sidebar-foreground/25"
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
  const [settingsOpen, setSettingsOpen] = useState(false);

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
              active={
                location === item.href ||
                location.startsWith(item.href + "/") ||
                // Invoice detail still lives at /invoices/:id; keep Finance lit.
                (item.href === "/finance" && location.startsWith("/invoices"))
              }
            />
          ))}
        </div>
      </nav>

      {/* Footer — profile + plan + settings now live in the top-bar account menu. */}
      <div className="flex-shrink-0 border-t border-sidebar-border px-5 py-2.5">
        <p className="text-[10px] text-sidebar-foreground/25 tracking-widest uppercase">Powered by Olyxee</p>
      </div>
    </div>
  );

  return (
    <SettingsModalContext.Provider value={{ open: () => setSettingsOpen(true) }}>
    <div className="flex h-screen bg-background">
      <InstallAppPrompt />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
          {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-400" />}
        </button>
        <TopUser />
      </div>

      {/* Main Content.
          The outer <div> owns the scroll. The inner wrapper centers content
          and caps width at 1536px so tables and cards have breathing room on
          ultra-wide monitors instead of sprawling edge-to-edge - but tables
          can still use the full container width on a 27" screen.
          Padding scales: tight on mobile, generous on desktop. */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:mt-0 mt-12">
        <div className="hidden h-14 shrink-0 items-center justify-end gap-3 border-b border-border/60 bg-background/90 px-6 backdrop-blur md:flex lg:px-8 xl:px-10">
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            className="relative flex h-9 w-[68px] items-center rounded-full border border-border bg-muted/60 p-1 shadow-sm transition-colors hover:bg-muted"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            <Sun className="absolute left-2 h-3.5 w-3.5 text-amber-400" />
            <Moon className="absolute right-2 h-3.5 w-3.5 text-indigo-400" />
            <span className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow-sm transition-transform duration-200 ${isDark ? "translate-x-7" : "translate-x-0"}`}>
              {isDark ? <Moon className="h-3.5 w-3.5 text-indigo-400" /> : <Sun className="h-3.5 w-3.5 text-amber-500" />}
            </span>
          </button>
          <div className="h-6 w-px bg-border" />
          <TopUser />
        </div>
        <div className="flex-1 overflow-auto">
          {/* No per-navigation entrance animation — pages swap instantly instead
              of sliding/scaling the whole frame in on every route change. */}
          <div className="mx-auto w-full max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 xl:px-10">
            {children}
          </div>
        </div>
      </main>
    </div>
    </SettingsModalContext.Provider>
  );
}
