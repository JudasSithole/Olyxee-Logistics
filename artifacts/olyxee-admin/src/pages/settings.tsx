import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Moon, Sun, Check, AlertCircle, AlertTriangle, Upload, X, Eye, Loader2, Pipette, Shuffle,
  Building2, Mail, SunMoon, RotateCcw,
  Code2, Copy, Download, Globe, Tag, CreditCard, Phone,
} from "lucide-react";
import {
  BusinessTypeSelector,
  BUSINESS_TYPES,
} from "@/components/business-type-selector";
import { SiCurl, SiJavascript, SiPython, SiPhp, SiHtml5 } from "react-icons/si";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBusiness, useUpdateBusiness } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { plans, isFeatureEnabled, type PlanId, LAUNCH_LABEL, TRIAL_LABEL } from "@/lib/launch";
import { Link } from "wouter";
import { LogoUpload } from "@/components/logo-upload";
import { compressLogo, compressFavicon } from "@/lib/image-processing";

const DEFAULT_PRIMARY = "#2b2b2b";

// ─── Section accent tints ─────────────────────────────────────────────────────
// Apple system colors. Each settings area gets its own tint so the page is
// instantly scannable by color - the iOS Settings pattern of colored, rounded
// icon badges next to each row.
const TINTS = {
  blue: "#0a84ff",
  indigo: "#5856d6",
  purple: "#5e5ce6",
  orange: "#ff9500",
  green: "#34c759",
  teal: "#30b0c7",
  cyan: "#32ade6",
  pink: "#ff2d55",
  red: "#ff3b30",
  gray: "#8e8e93",
} as const;

// Normalize free-typed hex into "#rrggbb". Returns null for invalid input so
// we can surface a clear error instead of writing junk into the theme.
function normalizeHex(raw: string): string | null {
  const trimmed = raw.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(trimmed)) {
    // Expand #abc → #aabbcc so the picker + downstream code see a single form.
    return "#" + trimmed.split("").map(c => c + c).join("").toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(trimmed)) {
    return "#" + trimmed.toLowerCase();
  }
  return null;
}

// ─── Brand color picker ──────────────────────────────────────────────────────
// Compute the WCAG contrast ratio of white text on a given hex background so we
// can warn the admin if their button labels would be unreadable. 4.5:1 is the
// AA threshold for normal text; we treat ≥4.5 as "good", 3-4.5 as "okay for
// large text only", and below 3 as a real readability problem.
function whiteContrastOn(hex: string): number {
  const n = normalizeHex(hex);
  if (!n) return 21;
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // L_white = 1, so ratio = (1 + 0.05) / (L + 0.05).
  return 1.05 / (L + 0.05);
}

function BrandColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const nativeRef = useRef<HTMLInputElement>(null);
  const [hexDraft, setHexDraft] = useState(value);
  const [hexError, setHexError] = useState(false);

  useEffect(() => {
    setHexDraft(value);
    setHexError(false);
  }, [value]);

  const commitHex = (raw: string) => {
    const norm = normalizeHex(raw);
    if (!norm) {
      setHexError(true);
      return;
    }
    setHexError(false);
    setHexDraft(norm);
    onChange(norm);
  };

  // Tasteful random - restrict to mid-saturation / mid-lightness so we
  // don't hand the admin neon yellow or near-black.
  const surpriseMe = () => {
    const h = Math.floor(Math.random() * 360);
    const s = 55 + Math.floor(Math.random() * 25);
    const l = 38 + Math.floor(Math.random() * 18);
    onChange(hslToHex(h, s, l));
  };

  const contrast = whiteContrastOn(value);
  const contrastTier: "good" | "okay" | "bad" =
    contrast >= 4.5 ? "good" : contrast >= 3 ? "okay" : "bad";
  const CONTRAST_COPY: Record<typeof contrastTier, { label: string; tone: string }> = {
    good: { label: "White text reads clearly on this color.", tone: "text-emerald-700" },
    okay: { label: "White text works for large headings only - pick a darker shade for buttons.", tone: "text-amber-700" },
    bad: { label: "White text is hard to read on this color. Try something darker.", tone: "text-rose-700" },
  };

  return (
    <div className="space-y-4">
      {/* Spectrum: drag across the rainbow to choose any hue, then fine-tune
          below. Replaces the old fixed swatch grid so the brand color feels
          like a free choice instead of a short, noisy preset list. */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Pick your brand color</p>
        <input
          type="range"
          min={0}
          max={360}
          value={hexToHsl(value).h}
          onChange={(e) => {
            const { s, l } = hexToHsl(value);
            onChange(hslToHex(Number(e.target.value), s < 12 ? 72 : s, s < 12 ? 46 : l));
          }}
          aria-label="Brand color hue"
          className="brand-hue h-3 w-full cursor-pointer appearance-none rounded-full border border-border"
          style={{
            background:
              "linear-gradient(to right,#ff0000,#ffd400,#22c55e,#06b6d4,#3b82f6,#a855f7,#ff0000)",
          }}
        />
        <style>{`
          .brand-hue::-webkit-slider-thumb {
            -webkit-appearance: none;
            height: 22px; width: 22px; border-radius: 9999px;
            background: ${value}; border: 3px solid #fff;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.3);
            cursor: pointer;
          }
          .brand-hue::-moz-range-thumb {
            height: 22px; width: 22px; border-radius: 9999px;
            background: ${value}; border: 3px solid #fff;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.3);
            cursor: pointer;
          }
        `}</style>
      </div>

      {/* Step 2: Custom color - one tidy row instead of three stacked controls.
          The big swatch on the left is the "current pick" indicator. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">
            Or use your exact brand color
          </p>
          <button
            type="button"
            onClick={surpriseMe}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <Shuffle className="h-3 w-3" /> Surprise me
          </button>
        </div>

        <div className="flex items-stretch gap-2">
          <button
            type="button"
            onClick={() => nativeRef.current?.click()}
            className="h-10 w-10 rounded-lg border border-border flex-shrink-0 relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ backgroundColor: hexError ? "transparent" : (normalizeHex(hexDraft) ?? value) }}
            aria-label="Open color spectrum"
            title="Open color spectrum"
          >
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 bg-black/30 transition-opacity">
              <Pipette className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
          </button>

          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none pointer-events-none">
              #
            </span>
            <Input
              value={hexDraft.replace(/^#/, "")}
              onChange={(e) => {
                const next = e.target.value;
                setHexDraft(next);
                const norm = normalizeHex(next);
                if (norm) {
                  setHexError(false);
                  onChange(norm);
                } else if (next.trim() === "") {
                  setHexError(false);
                } else {
                  setHexError(true);
                }
              }}
              onBlur={(e) => commitHex(e.target.value)}
              placeholder="2563eb"
              maxLength={7}
              spellCheck={false}
              className={cn("pl-7 h-10 font-mono uppercase", hexError && "border-destructive focus-visible:ring-destructive")}
              aria-invalid={hexError}
            />
          </div>

        </div>

        <input
          ref={nativeRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />

        {hexError && (
          <p className="text-xs text-destructive">
            Enter a valid hex like <code>2563eb</code> or <code>#abc</code>.
          </p>
        )}
      </div>

      {/* Step 3: Plain-English readability check - tells the admin whether
          their button text will actually be legible without making them
          learn what "WCAG 4.5:1" means. */}
      <div
        className={cn(
          "flex items-start gap-2 px-3 py-2 border text-xs",
          contrastTier === "good" && "border-emerald-200 bg-emerald-50",
          contrastTier === "okay" && "border-amber-200 bg-amber-50",
          contrastTier === "bad" && "border-rose-200 bg-rose-50",
        )}
      >
        {contrastTier === "good" ? (
          <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-emerald-700" aria-hidden="true" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
        )}
        <p className={cn("flex-1", CONTRAST_COPY[contrastTier].tone)}>
          {CONTRAST_COPY[contrastTier].label}
        </p>
      </div>
    </div>
  );
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const v = lN - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

// Inverse of hslToHex - lets the spectrum slider read the current hue and keep
// the existing saturation/lightness when the admin only drags the hue.
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const n = normalizeHex(hex) ?? "#000000";
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ─── Section primitives (Apple "Inset Grouped" feel) ──────────────────────────
// A section is a titled card. Title + description live OUTSIDE the card (small,
// muted) - content lives INSIDE on a flat surface with hairline dividers
// between rows. This is the macOS / iOS Settings pattern and keeps the page
// scannable when you have a lot of fields.

function SectionShell({
  id, icon: Icon, title, description, action, children, tint = TINTS.gray,
}: {
  // Optional - used to be required for scrollspy anchors. With tabs now
  // driving navigation, callers usually omit it.
  id?: string;
  icon: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  // Accent color for the section's icon badge. Defaults to neutral gray.
  tint?: string;
}) {
  return (
    <section
      id={id}
      // scroll-mt accounts for the sticky page header so anchor jumps land
      // with breathing room above the section title.
      className="scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
    >
      <header className="px-1 mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex items-start gap-2.5">
          <span
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[7px] shadow-sm ring-1 ring-black/5"
            style={{ backgroundColor: tint }}
          >
            <Icon className="h-[18px] w-[18px] text-white" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>

      <div className="bg-card border border-border divide-y divide-border/70 rounded-2xl shadow-sm overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function SectionRow({
  label, hint, htmlFor, children, align = "stack",
}: {
  label?: string;
  hint?: string;
  // When provided, threads an explicit label↔control association so screen
  // readers announce the field name correctly. Falls back to a plain <Label>
  // when the row's "control" isn't a single input (e.g. logo upload tile).
  htmlFor?: string;
  children: React.ReactNode;
  // "stack" = label above, content below (good for inputs and tiles).
  // "split" = label left, content right (good for compact toggles).
  align?: "stack" | "split";
}) {
  if (align === "split") {
    return (
      <div className="px-4 py-3.5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          {label && <p className="text-sm font-medium text-foreground">{label}</p>}
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        <div className="flex-shrink-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="px-4 py-4 space-y-2">
      {label && (
        <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
          {label}
        </Label>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// Small "Restore" button surfaced in section headers when that section is
// dirty. Lets the user revert one section without touching the rest.
function RestoreButton({ onClick, label = "Restore" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
      title="Revert this section to saved values"
    >
      <RotateCcw className="h-3 w-3" />
      {label}
    </button>
  );
}

// One compact, consolidated preview that replaces the four separate inline
// mockups. It shows - at a glance, side by side - how the brand reads in this
// app's sidebar, in a browser tab, and on a customer email, so the user can
// judge everything in one place instead of scrolling through stacked cards.
function BrandIdentityPreview({
  businessName, tagline, logoUrl, faviconUrl, primaryColor,
}: {
  businessName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
}) {
  const name = businessName.trim() || "Your business";
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
        <Eye className="h-3 w-3" aria-hidden="true" />
        Live preview
      </div>
      <div className="p-4 grid gap-4 sm:grid-cols-2">
        {/* Sidebar */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Sidebar</p>
          <div className="flex items-center gap-2.5 px-3 h-11 rounded-lg border border-border bg-background">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                aria-hidden="true"
                className="h-6 w-auto object-contain max-w-[72px] flex-shrink-0"
              />
            ) : (
              <div
                className="h-6 w-6 flex items-center justify-center flex-shrink-0"
                style={{ background: primaryColor }}
              >
                <span className="text-white text-[10px] font-bold leading-none">
                  {name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="font-semibold text-sm tracking-tight truncate">{name}</span>
          </div>
          {/* Active nav item in the brand color */}
          <div
            className="px-3 py-1.5 rounded-md text-[11px] font-semibold text-white w-fit"
            style={{ background: primaryColor }}
          >
            Orders
          </div>
        </div>

        {/* Browser tab */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Browser tab</p>
          <div className="bg-muted/60 pt-2 px-2 border border-border rounded-lg">
            <div className="flex items-end">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-background border-t border-l border-r border-border -mb-px text-[11px] text-foreground max-w-[180px]">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain flex-shrink-0"
                  />
                ) : (
                  <div className="h-3.5 w-3.5 bg-muted-foreground/30 flex-shrink-0" aria-hidden="true" />
                )}
                <span className="truncate font-medium">{name}</span>
                <X className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" aria-hidden="true" />
              </div>
            </div>
            <div className="h-5 bg-background border-x border-b border-border" />
          </div>
        </div>

        {/* Customer email line - full width */}
        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-[10px] text-muted-foreground">On customer emails</p>
          <div className="border border-border bg-background px-3 py-2.5 rounded-lg">
            <p className="text-sm font-semibold text-foreground leading-tight">{name}</p>
            {tagline.trim() ? (
              <p className="text-xs text-muted-foreground">{tagline}</p>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">No tagline yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
// Each entry drives one TabsTrigger and matches the `id` of one TabsContent
// below. Order here is the order shown to the user.
const NAV_ITEMS = [
  { id: "identity", label: "Brand & Identity", icon: Building2, tint: TINTS.blue },
  { id: "integrations", label: "Integrations", icon: Code2, tint: TINTS.indigo },
  { id: "appearance", label: "Appearance", icon: SunMoon, tint: TINTS.orange },
  { id: "billing", label: "Billing", icon: CreditCard, tint: TINTS.green },
  { id: "call-centre", label: "Call Centre", icon: Phone, tint: TINTS.teal },
] as const;

// ─── Billing & plan ───────────────────────────────────────────────────────────
// Shows the business's current plan straight from the shared plan catalog
// (@workspace/plans): its name, monthly ZAR price, and exactly what it includes.
// Billing is handled through the Upgrade flow, so this surface is informational
// and links out to change plans - it is not itself a checkout.
function BillingSection() {
  const { user } = useAuth();
  const { data: business } = useBusiness(user?.businessId);

  const planId = (business?.plan as PlanId | undefined) ?? "beta";
  const plan = plans[planId] ?? plans.beta;
  const isBeta = planId === "beta";

  // Price straight from the catalog so it never drifts from the pricing/upgrade
  // pages. All paid plans are billed monthly in ZAR.
  const priceLabel = plan.price === 0 ? "Free" : `R${plan.price}`;

  // What the plan includes. Paid tiers carry an explicit marketing bullet list
  // in the catalog; beta has none, so fall back to its "no limits" promise.
  const includes =
    plan.features && plan.features.length > 0
      ? plan.features
      : [
          "Unlimited orders",
          "Unlimited customer emails",
          "Unlimited customers",
        ];

  const emailsSent = business?.email_usage_this_month ?? 0;

  return (
    <SectionShell
      icon={CreditCard}
      tint={TINTS.green}
      title="Billing & plan"
      description="Your current plan and everything it includes."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/upgrade" data-testid="link-view-plans">
            {isBeta ? "View plans" : "Change plan"}
          </Link>
        </Button>
      }
    >
      {/* Current plan header - name, price and a "Current" badge. */}
      <div className="px-4 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-foreground">{plan.name}</p>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-foreground">
              Current
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isBeta
              ? "Unlimited access with no limits while we're in beta."
              : "Billed monthly, in South African Rand (ZAR)."}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <span className="text-2xl font-bold tracking-tight text-foreground">{priceLabel}</span>
          {plan.price > 0 && (
            <span className="block text-xs text-muted-foreground">per month</span>
          )}
        </div>
      </div>

      {/* What the plan includes - mirrors the pricing/upgrade feature list. */}
      <div className="px-4 py-4">
        <p className="text-sm font-medium text-foreground">What&apos;s included</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {includes.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Usage snapshot - emails are unlimited on every current plan, so this is
          purely informational rather than a cap. */}
      <div className="px-4 py-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Customer emails this month</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Included with your plan · resets on the 1st.
          </p>
        </div>
        <span className="flex-shrink-0 font-mono text-sm text-foreground">
          {emailsSent.toLocaleString()}
        </span>
      </div>

      {/* Launch note - paid plans and the existing-business trial go live at
          launch. Only relevant while the business is still on beta. */}
      {isBeta && (
        <div className="px-4 py-4">
          <div className="rounded-[12px] border border-primary/25 bg-primary/[0.04] p-4">
            <p className="text-sm font-semibold text-foreground">
              Paid plans go live on {LAUNCH_LABEL}
            </p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Nothing changes for you before then. As an existing business, you&apos;ll get{" "}
              <span className="font-semibold text-foreground">{plans.pro.name}</span> free during{" "}
              {TRIAL_LABEL}.
            </p>
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function InvoiceProfileSection() {
  const { user } = useAuth(); const { data: business } = useBusiness(user?.businessId); const save = useUpdateBusiness();
  const [profile,setProfile]=useState({legalName:"",registrationNumber:"",taxNumber:"",address:"",email:"",phone:"",logoUrl:"",paymentDetails:"",paymentTerms:"",footerNote:""});
  useEffect(()=>{if(business)setProfile({legalName:business.invoice_legal_name||business.name||"",registrationNumber:business.invoice_registration_number||"",taxNumber:business.invoice_tax_number||"",address:business.invoice_address||business.location||"",email:business.invoice_email||business.support_email||"",phone:business.invoice_phone||business.phone||"",logoUrl:business.invoice_logo_url||business.business_logo_url||"",paymentDetails:business.invoice_payment_details||"",paymentTerms:business.invoice_payment_terms||"Payment due within agreed terms.",footerNote:business.invoice_footer_note||""});},[business]);
  const pickLogo=async(file:File)=>{if(file.type==="image/svg+xml"){toast.error("Invoice logos must be PNG or JPEG so every PDF renders reliably.");return;}try{const logoUrl=await compressLogo(file);setProfile(p=>({...p,logoUrl}));}catch{toast.error("Could not process that logo. Use a PNG or JPEG image.");}};
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!user?.businessId)return;try{await save.mutateAsync({id:user.businessId,invoice_legal_name:profile.legalName||null,invoice_registration_number:profile.registrationNumber||null,invoice_tax_number:profile.taxNumber||null,invoice_address:profile.address||null,invoice_email:profile.email||null,invoice_phone:profile.phone||null,invoice_logo_url:profile.logoUrl||null,invoice_payment_details:profile.paymentDetails||null,invoice_payment_terms:profile.paymentTerms||null,invoice_footer_note:profile.footerNote||null});toast.success("Invoice profile saved");}catch(error){toast.error(error instanceof Error?error.message:"Could not save invoice profile");}};
  return <SectionShell icon={CreditCard} tint={TINTS.green} title="Invoice profile" description="Legal, contact, logo, and payment information included on every invoice."><form onSubmit={submit} className="divide-y divide-border"><div className="grid gap-4 p-4 sm:grid-cols-2">{([['legalName','Legal business name'],['registrationNumber','Registration number'],['taxNumber','Tax / VAT number'],['email','Invoice email'],['phone','Invoice phone']] as const).map(([key,label])=><div className="space-y-2" key={key}><Label>{label}</Label><Input type={key==='email'?'email':'text'} value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))}/></div>)}<div className="space-y-2 sm:col-span-2"><Label>Invoice address</Label><Textarea value={profile.address} onChange={e=>setProfile(p=>({...p,address:e.target.value}))}/></div></div><div className="p-4 space-y-2"><Label>Invoice logo</Label><LogoUpload value={profile.logoUrl} businessName={profile.legalName} onFile={pickLogo} onRemove={()=>setProfile(p=>({...p,logoUrl:""}))}/><p className="text-xs text-muted-foreground">Stored as a compressed PNG/JPEG data image. Invalid or unavailable logos safely fall back to the legal business name.</p></div><div className="grid gap-4 p-4"><div className="space-y-2"><Label>Payment details</Label><Textarea rows={6} placeholder={'Account name:\nBank:\nAccount number:\nBranch code:\nAccount type:'} value={profile.paymentDetails} onChange={e=>setProfile(p=>({...p,paymentDetails:e.target.value}))}/></div><div className="space-y-2"><Label>Payment terms</Label><Input value={profile.paymentTerms} onChange={e=>setProfile(p=>({...p,paymentTerms:e.target.value}))}/></div><div className="space-y-2"><Label>Invoice footer note</Label><Textarea value={profile.footerNote} onChange={e=>setProfile(p=>({...p,footerNote:e.target.value}))}/></div><Button type="submit" disabled={save.isPending}>{save.isPending?"Saving...":"Save invoice profile"}</Button></div></form></SectionShell>;
}

export default function SettingsPage() {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: settingsBusiness } = useBusiness(user?.businessId);
  const saveBusiness = useUpdateBusiness();

  // Local form state for the theme/branding bits. Email wording lives in its
  // own component because it persists to the server, not localStorage.
  const initial = useMemo(
    () => ({
      businessName: theme.businessName,
      businessTagline: theme.businessTagline,
      logoUrl: settingsBusiness?.business_logo_url ?? theme.logoUrl,
      faviconUrl: theme.faviconUrl,
      primaryColor: theme.primaryColor,
    }),
    // Re-baseline only when the saved theme values change (e.g. after a save).
    [theme.businessName, theme.businessTagline, theme.logoUrl, theme.faviconUrl, theme.primaryColor, settingsBusiness?.business_logo_url],
  );

  const [form, setForm] = useState(initial);

  // Re-baseline form when saved theme changes from elsewhere (e.g. theme
  // toggle in the sidebar). Keeps the page in sync without clobbering unsaved
  // typing because we only reset when the saved snapshot itself shifts.
  useEffect(() => {
    setForm(initial);
  }, [initial]);

  // Which sections are dirty? Drives the side-nav dot indicators and lets us
  // show a precise "N changes" count in the save bar.
  const dirty = useMemo(() => {
    const ids = new Set<string>();
    // Brand and identity now share one tab/card, so both feed the same
    // "identity" dirty bucket that drives the tab's unsaved dot.
    if (
      form.businessName !== initial.businessName ||
      form.businessTagline !== initial.businessTagline ||
      form.logoUrl !== initial.logoUrl ||
      form.faviconUrl !== initial.faviconUrl ||
      form.primaryColor !== initial.primaryColor
    ) {
      ids.add("identity");
    }
    return ids;
  }, [form, initial]);

  const hasChanges = dirty.size > 0;
  const changeCount =
    (form.businessName !== initial.businessName ? 1 : 0) +
    (form.businessTagline !== initial.businessTagline ? 1 : 0) +
    (form.logoUrl !== initial.logoUrl ? 1 : 0) +
    (form.faviconUrl !== initial.faviconUrl ? 1 : 0) +
    (form.primaryColor !== initial.primaryColor ? 1 : 0);

  const handleSave = useCallback(async () => {
    if (user?.businessId) {
      try {
        await saveBusiness.mutateAsync({ id: user.businessId, business_logo_url: form.logoUrl || null });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Unable to save logo");
        return;
      }
    }
    theme.saveSettings({
      businessName: form.businessName,
      businessTagline: form.businessTagline,
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved - logo will be used on invoices");
  }, [theme, form, user?.businessId, saveBusiness]);

  const handleDiscard = useCallback(() => {
    setForm(initial);
  }, [initial]);

  // Track the email editor's dirty state so the beforeunload guard covers
  // unsaved email wording too (email persists server-side via its own button,
  // so it's not in the page-level save bar - but losing typed text on tab
  // close would still be a bad surprise).
  const [emailDirty, setEmailDirty] = useState(false);
  const guardActive = hasChanges || emailDirty;

  // ⌘S / Ctrl+S - power-user shortcut. Browsers reserve this for "Save page",
  // so we preventDefault and route it to our save handler.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isSave = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s";
      if (!isSave) return;
      e.preventDefault();
      if (hasChanges) handleSave();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [hasChanges, handleSave]);

  // Soft guard: prompt before navigating away with unsaved theme changes.
  // The modern browsers ignore custom strings, but they still show the
  // confirmation dialog when returnValue is set.
  useEffect(() => {
    if (!guardActive) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [guardActive]);

  // Active tab. Honour a deep-link hash (#identity, #integrations, …) on first mount
  // so links from elsewhere can drop the user straight onto a tab.
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return NAV_ITEMS[0].id;
    const hash = window.location.hash.replace(/^#/, "");
    return NAV_ITEMS.some((n) => n.id === hash) ? hash : NAV_ITEMS[0].id;
  });

  // Keep the URL hash in sync as the tab changes - preserves deep-linking
  // and back/forward navigation between tabs.
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value);
    if (typeof window !== "undefined" && window.history.replaceState) {
      window.history.replaceState(null, "", `#${value}`);
    }
  }, []);

  async function handleLogoPicked(file: File) {
    try {
      const dataUrl = await compressLogo(file);
      setForm((f) => ({ ...f, logoUrl: dataUrl }));
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  }

  async function handleFaviconPicked(file: File) {
    try {
      const dataUrl = await compressFavicon(file);
      setForm((f) => ({ ...f, faviconUrl: dataUrl }));
    } catch {
      toast.error("Could not read that image. Try a different file.");
    }
  }

  return (
    <div className="min-h-full pb-32">
      {/* Page header - kept generous; this is the moment the page "establishes
          itself" before the content groups begin. */}
      <header className="mb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
          Manage your business profile, branding, and developer integrations.
        </p>
      </header>

      {/* Tabs - replace the long scroll. Only the active panel renders, so
          there's no off-screen content competing for attention. */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="max-w-4xl">
        {/* TabsList scrolls horizontally on narrow viewports so the labels
            never wrap or truncate. */}
        <TabsList className="h-auto p-1 bg-muted/60 w-full sm:w-auto flex flex-wrap justify-start gap-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isDirty = dirty.has(item.id);
            const isActive = activeTab === item.id;
            return (
              <TabsTrigger
                key={item.id}
                value={item.id}
                className="relative gap-2 px-3 py-1.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {isActive && (
                  <motion.span
                    layoutId="settingsTabHighlight"
                    aria-hidden="true"
                    className="absolute inset-0 rounded-md bg-background shadow-sm pointer-events-none"
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                  />
                )}
                <Icon
                  className="relative z-10 h-3.5 w-3.5"
                  style={{ color: item.tint }}
                />
                <span className="relative z-10">{item.label}</span>
                {isDirty && (
                  <motion.span
                    layout
                    className="relative z-10 h-1.5 w-1.5 rounded-full bg-amber-500 inline-block"
                    aria-label="Unsaved changes"
                  />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* ─── Brand & Identity ─────────────────────────────────────── */}
        {/* One compact card for all brand inputs, plus a single consolidated
            preview - far shorter and calmer than the old stacked sections. */}
        <TabsContent value="identity" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={Building2}
            tint={TINTS.blue}
            title="Brand & Identity"
            description="Your name, logo, and accent color - how you appear to your team and customers."
            action={
              dirty.has("identity") && (
                <RestoreButton
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      businessName: initial.businessName,
                      businessTagline: initial.businessTagline,
                      logoUrl: initial.logoUrl,
                      faviconUrl: initial.faviconUrl,
                      primaryColor: initial.primaryColor,
                    }))
                  }
                />
              )
            }
          >
            <SectionRow
              label="Business name"
              hint="Shown in the sidebar and on every customer email."
              htmlFor="businessName"
            >
              <Input
                id="businessName"
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
                placeholder="Your business name"
                className="h-11"
                autoComplete="organization"
              />
            </SectionRow>

            <SectionRow
              label="Tagline"
              hint="Optional. A short phrase shown under your name."
              htmlFor="businessTagline"
            >
              <Input
                id="businessTagline"
                value={form.businessTagline}
                onChange={(e) =>
                  setForm((f) => ({ ...f, businessTagline: e.target.value.slice(0, 80) }))
                }
                placeholder="e.g. Fast, reliable shipping across the EU"
                className="h-11"
                maxLength={80}
              />
            </SectionRow>

            {/* Logo + favicon side by side to keep the card short. */}
            <div className="px-4 py-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Logo</Label>
                <LogoUpload
                  variant="logo"
                  businessName={form.businessName}
                  value={form.logoUrl}
                  onFile={handleLogoPicked}
                  onRemove={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                />
                <p className="text-xs text-muted-foreground">PNG, SVG, or JPEG.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">Favicon</Label>
                <LogoUpload
                  variant="favicon"
                  businessName={form.businessName}
                  value={form.faviconUrl}
                  onFile={handleFaviconPicked}
                  onRemove={() => setForm((f) => ({ ...f, faviconUrl: "" }))}
                />
                <p className="text-xs text-muted-foreground">Square images work best.</p>
              </div>
            </div>

            <SectionRow label="Brand color">
              <BrandColorPicker
                value={form.primaryColor}
                onChange={(hex) => setForm((f) => ({ ...f, primaryColor: hex }))}
              />
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, primaryColor: DEFAULT_PRIMARY }))}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset brand color
                </button>
              </div>
            </SectionRow>
          </SectionShell>

          {/* Single consolidated preview replaces four stacked inline mockups. */}
          <div className="mt-6">
            <BrandIdentityPreview
              businessName={form.businessName}
              tagline={form.businessTagline}
              logoUrl={form.logoUrl}
              faviconUrl={form.faviconUrl}
              primaryColor={form.primaryColor}
            />
          </div>

          {/* Business Type - persists server-side independently of the
              theme save bar (same pattern as Tracking). */}
          <div className="mt-8">
            <BusinessTypeSection />
          </div>

          {/* Tracking section persists server-side (separate from the theme
              form's save bar). */}
          <div className="mt-8">
            <TrackingCustomizationSection />
          </div>
          <div className="mt-8"><InvoiceProfileSection /></div>
        </TabsContent>

        {/* ─── Integrations ─────────────────────────────────────────── */}
        <TabsContent value="integrations" className="mt-6 focus-visible:outline-none">
          <IntegrationsSection />
        </TabsContent>

        {/* ─── Appearance ───────────────────────────────────────────── */}
        <TabsContent value="appearance" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={SunMoon}
            tint={TINTS.orange}
            title="Appearance"
            description="Pick the look that's easier on your eyes."
          >
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <ThemeOption
                  active={!theme.isDark}
                  onClick={() => theme.setIsDark(false)}
                  icon={Sun}
                  label="Light"
                  bg="bg-white"
                  fg="bg-zinc-900"
                  muted="bg-zinc-200"
                />
                <ThemeOption
                  active={theme.isDark}
                  onClick={() => theme.setIsDark(true)}
                  icon={Moon}
                  label="Dark"
                  bg="bg-zinc-900"
                  fg="bg-zinc-200"
                  muted="bg-zinc-700"
                />
              </div>
            </div>
          </SectionShell>
        </TabsContent>

        {/* ─── Billing ──────────────────────────────────────────────── */}
        <TabsContent value="billing" className="mt-6 focus-visible:outline-none">
          <BillingSection />
        </TabsContent>

        {/* ─── Call Centre ─────────────────────────────────────────── */}
        <TabsContent value="call-centre" className="mt-6 focus-visible:outline-none">
          <div className="max-w-3xl">
            <CallCentreSettingsEmbed />
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Sticky save bar ───────────────────────────────────────────────
          Floats above the content with a soft backdrop blur. Slides in only
          when there are real changes - the empty state would feel like noise. */}
      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 md:left-56 z-30 border-t bg-background/85 backdrop-blur-md transition-all duration-300 ease-out",
          hasChanges
            ? "translate-y-0 opacity-100 border-border shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.18)]"
            : "translate-y-full opacity-0 border-transparent pointer-events-none",
        )}
        role="region"
        aria-label="Unsaved changes"
      >
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm min-w-0">
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping bg-amber-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-foreground font-medium truncate">
              {changeCount === 1 ? "1 unsaved change" : `${changeCount} unsaved changes`}
            </span>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="ghost" size="sm" onClick={handleDiscard}>
              Discard
            </Button>
            <Button size="sm" onClick={handleSave} className="gap-1.5">
              <Check className="h-4 w-4" />
              Save changes
              <kbd className="hidden sm:inline-flex ml-1 items-center justify-center min-w-[1.25rem] h-4 px-1 text-[10px] font-medium bg-primary-foreground/15 border border-primary-foreground/20 text-primary-foreground/90">
                ⌘S
              </kbd>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Customer email wording ───────────────────────────────────────────────────
// Lives server-side on the Business record so the API server can inject it
// into outgoing customer status emails. Self-contained - has its own load /
// save lifecycle and "Save email wording" button so it doesn't interfere with
// the page-level "Unsaved changes" bar (which is wired to the theme form).
function EmailCustomizationSection({
  businessName,
  onDirtyChange,
}: {
  businessName: string;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { user } = useAuth();
  const { data: business, isLoading, refetch } = useBusiness(user?.businessId);
  const updateMutation = useUpdateBusiness();

  const [form, setForm] = useState({
    emailGreeting: "",
    emailSignature: "",
    emailFooterNote: "",
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (business && !loaded) {
      setForm({
        emailGreeting: business.email_greeting ?? "",
        emailSignature: business.email_signature ?? "",
        emailFooterNote: business.email_footer_note ?? "",
      });
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty =
    loaded &&
    (form.emailGreeting !== (business?.email_greeting ?? "") ||
      form.emailSignature !== (business?.email_signature ?? "") ||
      form.emailFooterNote !== (business?.email_footer_note ?? ""));

  // Surface dirty state to the parent so the page-level beforeunload guard
  // can fire when email wording has unsaved changes too.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        id: user!.businessId,
        email_greeting: form.emailGreeting.trim() ? form.emailGreeting : null,
        email_signature: form.emailSignature.trim() ? form.emailSignature : null,
        email_footer_note: form.emailFooterNote.trim() ? form.emailFooterNote : null,
      },
      {
        onSuccess: () => {
          toast.success("Email wording saved");
          refetch();
        },
        onError: () => toast.error("Could not save email wording"),
      },
    );
  };

  const handleReset = () => {
    setForm({
      emailGreeting: business?.email_greeting ?? "",
      emailSignature: business?.email_signature ?? "",
      emailFooterNote: business?.email_footer_note ?? "",
    });
  };

  // Token substitution for the live preview. Mirrors the server-side template
  // behaviour so the admin sees exactly what the customer would receive.
  const sub = (s: string) =>
    s
      .replace(/\{name\}/g, "Sam")
      .replace(/\{businessName\}/g, businessName);

  // Defaults intentionally mirror the server-side template helpers in
  // artifacts/api-server/src/lib/email.ts (renderGreeting / renderSignature /
  // renderFooterNote). Keeping them in sync is the only way the live preview
  // tells the truth about what customers will actually receive.
  const previewGreeting = sub(form.emailGreeting || "Hi {name},");
  const previewSignature = sub(form.emailSignature || "- {businessName}");
  const previewFooter = sub(form.emailFooterNote || "");

  return (
    <SectionShell
      id="emails"
      icon={Mail}
      tint={TINTS.pink}
      title="Customer emails"
      description="Customize the greeting, sign-off, and footer on status emails."
      action={dirty ? <RestoreButton onClick={handleReset} /> : undefined}
    >
      {/* Token legend */}
      <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Tokens:</span>
        <code className="font-mono text-foreground bg-background border border-border px-1.5 py-0.5 rounded-md">{"{name}"}</code>
        <span className="text-muted-foreground/70">customer's name</span>
        <code className="font-mono text-foreground bg-background border border-border px-1.5 py-0.5 rounded-md">{"{businessName}"}</code>
        <span className="text-muted-foreground/70">your business</span>
      </div>

      {/* Emails this month - unlimited on every plan, so this is an
          informational count only (no cap, no upgrade prompt). */}
      {(() => {
        const used = business?.email_usage_this_month ?? 0;
        return (
          <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm">
            <div className="min-w-0">
              <span className="font-medium text-foreground">Emails this month</span>
              <p className="text-xs text-muted-foreground mt-0.5">
                Unlimited on your plan · resets on the 1st.
              </p>
            </div>
            <span className="flex-shrink-0 font-mono text-muted-foreground">
              {used.toLocaleString()}
            </span>
          </div>
        );
      })()}

      {isLoading && !loaded ? (
        <div
          className="px-4 py-8 flex items-center justify-center"
          role="status"
          aria-label="Loading email wording"
        >
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <SectionRow
            label="Greeting"
            hint="The first line of every status email."
            htmlFor="emailGreeting"
          >
            <Input
              id="emailGreeting"
              value={form.emailGreeting}
              onChange={(e) => setForm((f) => ({ ...f, emailGreeting: e.target.value }))}
              placeholder="Hi {name},"
              className="h-11"
              maxLength={200}
            />
          </SectionRow>

          <SectionRow
            label="Sign-off"
            hint="Line breaks are preserved."
            htmlFor="emailSignature"
          >
            <Textarea
              id="emailSignature"
              value={form.emailSignature}
              onChange={(e) => setForm((f) => ({ ...f, emailSignature: e.target.value }))}
              placeholder={"Best,\nThe {businessName} team"}
              rows={3}
              maxLength={500}
            />
          </SectionRow>

          <SectionRow
            label="Footer note"
            hint="Optional - shown below the sign-off in muted text."
            htmlFor="emailFooterNote"
          >
            <Textarea
              id="emailFooterNote"
              value={form.emailFooterNote}
              onChange={(e) => setForm((f) => ({ ...f, emailFooterNote: e.target.value }))}
              placeholder="Thanks for shopping with us!"
              rows={2}
              maxLength={500}
            />
          </SectionRow>

          {/* Live email preview - uses real fallbacks + token substitution so
              the admin sees exactly what the customer will get. */}
          <div className="px-4 py-4 bg-muted/20 space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="border border-border bg-background p-4 text-sm space-y-3 rounded-xl">
              <p className="font-medium">{previewGreeting}</p>
              <p className="text-muted-foreground">
                Your package has left our facility and is making its way to you.
              </p>
              <p className="whitespace-pre-line text-muted-foreground">{previewSignature}</p>
              {previewFooter && (
                <p className="text-xs text-muted-foreground/80 pt-2 border-t border-border/60 whitespace-pre-line">
                  {previewFooter}
                </p>
              )}
            </div>
          </div>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saves immediately - separate from the page-level Save.
            </p>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save email wording
            </Button>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ─── Business type section ────────────────────────────────────────────────────
// Lets users change their industry / business type from Settings without going
// back through onboarding. Self-contained: persists to the API independently of
// the theme save bar so the user doesn't lose theme edits by saving here.
function BusinessTypeSection() {
  const { user } = useAuth();
  const { data: business, isLoading, refetch } = useBusiness(user?.businessId);
  const updateMutation = useUpdateBusiness();

  const [selected, setSelected] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (business && !loaded) {
      setSelected(business.business_type ?? "");
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty = loaded && selected !== (business?.business_type ?? "");

  const handleSave = () => {
    if (!selected) {
      toast.error("Please choose a business type before saving.");
      return;
    }
    updateMutation.mutate(
      { id: user!.businessId, business_type: selected },
      {
        onSuccess: () => {
          toast.success("Business type saved");
          refetch();
        },
        onError: () => toast.error("Could not save business type"),
      },
    );
  };

  const handleReset = () => {
    setSelected(business?.business_type ?? "");
  };

  const currentLabel =
    BUSINESS_TYPES.find((t) => t.value === (business?.business_type ?? ""))?.label ??
    business?.business_type ??
    "Not set";

  return (
    <SectionShell
      icon={Tag}
      tint={TINTS.purple}
      title="Business Type"
      description="The industry that best describes your business."
      action={dirty ? <RestoreButton onClick={handleReset} /> : undefined}
    >
      {isLoading && !loaded ? (
        <div
          className="px-4 py-8 flex items-center justify-center"
          role="status"
          aria-label="Loading business type"
        >
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <SectionRow
            hint={`Current: ${currentLabel}`}
          >
            <BusinessTypeSelector
              value={selected}
              onChange={setSelected}
              compact
            />
          </SectionRow>

          <div className="px-4 py-3 flex items-center justify-end border-t border-border/60">
            <Button
              size="sm"
              disabled={!dirty || updateMutation.isPending || !selected}
              onClick={handleSave}
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Save business type
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ─── Tracking customization ───────────────────────────────────────────────────
// Two server-side fields on the Business record that govern the public
// customer experience:
//   trackingIdPrefix - 3–5 uppercase letters, used as the leading segment
//     of every new tracking ID we generate (e.g. "FSL" → "FSL-K7M-9X2A").
//   allowedOrigins   - comma-separated list of customer-site origins allowed
//     to call the public tracking endpoint cross-origin.
// Self-contained like EmailCustomizationSection so it persists independently
// of the theme save bar at the top of the page.
function TrackingCustomizationSection() {
  const { user } = useAuth();
  const { data: business, isLoading, refetch } = useBusiness(user?.businessId);
  const updateMutation = useUpdateBusiness();

  const [form, setForm] = useState({
    trackingIdPrefix: "",
    allowedOrigins: "",
  });
  const [loaded, setLoaded] = useState(false);
  const prefixValid =
    form.trackingIdPrefix === "" || /^[A-Z]{3,5}$/.test(form.trackingIdPrefix);

  useEffect(() => {
    if (business && !loaded) {
      setForm({
        trackingIdPrefix: business.tracking_id_prefix ?? "",
        allowedOrigins: "",
      });
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty =
    loaded &&
    form.trackingIdPrefix !== (business?.tracking_id_prefix ?? "");

  const handleSave = () => {
    if (!prefixValid) {
      toast.error("Tracking prefix must be 3–5 letters (A–Z).");
      return;
    }
    // Normalize origins: trim each, drop trailing slashes, drop empties, dedupe.
    const normalizedOrigins = Array.from(
      new Set(
        form.allowedOrigins
          .split(",")
          .map((s) => s.trim().replace(/\/+$/, ""))
          .filter(Boolean),
      ),
    ).join(",");
    updateMutation.mutate(
      {
        id: user!.businessId,
        tracking_id_prefix: form.trackingIdPrefix ? form.trackingIdPrefix : null,
      },
      {
        onSuccess: () => {
          toast.success("Tracking settings saved");
          setForm((f) => ({ ...f, allowedOrigins: normalizedOrigins }));
          refetch();
        },
        onError: () => toast.error("Could not save tracking settings"),
      },
    );
  };

  const handleReset = () => {
    setForm({
      trackingIdPrefix: business?.tracking_id_prefix ?? "",
      allowedOrigins: "",
    });
  };

  return (
    <SectionShell
      id="tracking"
      icon={Building2}
      tint={TINTS.cyan}
      title="Tracking"
      description="Your tracking ID prefix and the websites allowed to look up orders."
      action={dirty ? <RestoreButton onClick={handleReset} /> : undefined}
    >
      {isLoading && !loaded ? (
        <div
          className="px-4 py-8 flex items-center justify-center"
          role="status"
          aria-label="Loading tracking settings"
        >
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <SectionRow
            label="Tracking ID prefix"
            hint="3–5 letters. Shown at the start of every new tracking number, e.g. FSL-K7M-9X2A."
            htmlFor="trackingIdPrefix"
          >
            <Input
              id="trackingIdPrefix"
              value={form.trackingIdPrefix}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  // Uppercase as the user types, strip everything that isn't
                  // a letter, clamp to 5 chars - produces a valid prefix
                  // without forcing the user to think about the rules.
                  trackingIdPrefix: e.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 5),
                }))
              }
              placeholder="OLY"
              maxLength={5}
              className={cn(
                "h-11 font-mono uppercase tracking-widest",
                !prefixValid &&
                  "border-destructive focus-visible:ring-destructive",
              )}
              aria-invalid={!prefixValid}
            />
            {form.trackingIdPrefix && prefixValid && (
              <p className="text-xs text-muted-foreground">
                Example: <span className="font-mono">{form.trackingIdPrefix}-K7M-9X2A</span>
              </p>
            )}
            {!prefixValid && (
              <p className="text-xs text-destructive">
                Use 3–5 letters only (A–Z).
              </p>
            )}
          </SectionRow>

          <SectionRow
            label="Allowed website origins"
            hint="Comma-separated list of sites allowed to load tracking from your customer page. Include both apex and www variants if you use both."
            htmlFor="allowedOrigins"
          >
            <Textarea
              id="allowedOrigins"
              value={form.allowedOrigins}
              onChange={(e) =>
                setForm((f) => ({ ...f, allowedOrigins: e.target.value }))
              }
              placeholder="https://example.com, https://www.example.com"
              rows={3}
              spellCheck={false}
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Leave empty to disable cross-origin browser access. Changes take
              effect within ~1 minute.
            </p>
          </SectionRow>

          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Saves immediately - separate from the page-level Save.
            </p>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || !prefixValid || updateMutation.isPending}
              className="gap-1.5"
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save tracking settings
            </Button>
          </div>
        </>
      )}
    </SectionShell>
  );
}

// ─── Integrations ─────────────────────────────────────────────────────────────
// Developer-facing tab. Generates copy-paste snippets that hit the *public*
// tracking endpoint (GET /api/public/track/:id - no auth) so a customer's
// engineering team can embed live order tracking on their own website in any
// language, or download a standalone HTML page and run it locally to test.
const INTEGRATION_LANGS = [
  { id: "curl", label: "cURL", icon: SiCurl, color: "#073551" },
  { id: "js", label: "JavaScript", icon: SiJavascript, color: "#f7df1e" },
  { id: "python", label: "Python", icon: SiPython, color: "#3776ab" },
  { id: "php", label: "PHP", icon: SiPhp, color: "#777bb4" },
  { id: "html", label: "HTML widget", icon: SiHtml5, color: "#e34f26" },
] as const;

type IntegrationLang = (typeof INTEGRATION_LANGS)[number]["id"];

// ─── Lightweight syntax highlighter ───────────────────────────────────────────
// A small, dependency-free tokenizer good enough to make the snippets read like
// real code. Tokens are rendered as React spans, so all text is auto-escaped -
// no risk of HTML injection from user-edited base URL / tracking ID.
type HlType =
  | "comment" | "string" | "number" | "keyword" | "fn"
  | "var" | "tag" | "attr" | "punct" | "plain";

const HL_CLASS: Record<HlType, string> = {
  comment: "text-zinc-500 italic",
  string: "text-emerald-400",
  number: "text-amber-300",
  keyword: "text-fuchsia-400",
  fn: "text-sky-400",
  var: "text-orange-300",
  tag: "text-rose-400",
  attr: "text-violet-300",
  punct: "text-zinc-500",
  plain: "text-zinc-200",
};

const kw = (words: string[]) =>
  new RegExp("(?:" + words.join("|") + ")\\b", "y");

const STR = /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y;
const PYSTR = /[frbu]{0,2}("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/y;
const NUM = /\b\d+(?:\.\d+)?(?:px|em|rem|%)?\b/y;
const FN = /[A-Za-z_]\w*(?=\s*\()/y;
const IDENT = /[A-Za-z_]\w*/y;
const PUNCT = /[{}()[\].,;:?=&|<>+\-*/%!@]+/y;

const HL_RULES: Record<IntegrationLang, [HlType, RegExp][]> = {
  curl: [
    ["comment", /#.*/y],
    ["string", STR],
    ["fn", kw(["curl", "echo"])],
    ["keyword", /-{1,2}[A-Za-z][\w-]*/y],
    ["var", /\$\{?\w+\}?/y],
  ],
  js: [
    ["comment", /\/\/.*/y],
    ["comment", /\/\*[\s\S]*?\*\//y],
    ["string", STR],
    ["number", NUM],
    ["var", /\$\{?\w+\}?/y],
    ["keyword", kw(["const", "let", "var", "async", "await", "function", "return", "if", "else", "try", "catch", "throw", "new", "for", "of", "in", "this", "true", "false", "null", "undefined", "void", "typeof"])],
    ["fn", FN],
    ["plain", IDENT],
    ["punct", PUNCT],
  ],
  python: [
    ["comment", /#.*/y],
    ["string", PYSTR],
    ["number", NUM],
    ["keyword", kw(["import", "from", "as", "def", "return", "if", "elif", "else", "try", "except", "raise", "with", "for", "in", "while", "and", "or", "not", "None", "True", "False", "lambda", "class"])],
    ["fn", FN],
    ["plain", IDENT],
    ["punct", PUNCT],
  ],
  php: [
    ["comment", /\/\/.*/y],
    ["comment", /#.*/y],
    ["comment", /\/\*[\s\S]*?\*\//y],
    ["keyword", /<\?php|\?>/y],
    ["string", STR],
    ["number", NUM],
    ["var", /\$\w+/y],
    ["keyword", kw(["function", "return", "if", "else", "elseif", "foreach", "for", "while", "as", "new", "use", "echo", "throw", "try", "catch", "array", "string", "int", "bool", "true", "false", "null", "PHP_EOL"])],
    ["fn", FN],
    ["plain", IDENT],
    ["punct", PUNCT],
  ],
  html: [
    ["comment", /<!--[\s\S]*?-->/y],
    ["keyword", /<!doctype[^>]*>/yi],
    ["string", STR],
    ["tag", /<\/?[A-Za-z][\w-]*/y],
    ["tag", /\/?>/y],
    ["attr", /[A-Za-z_:][\w:-]*(?==)/y],
    ["number", NUM],
    ["keyword", kw(["const", "let", "var", "async", "await", "function", "return", "if", "else", "try", "catch", "throw", "new", "for", "of", "this", "true", "false", "null"])],
    ["fn", FN],
    ["plain", IDENT],
    ["punct", PUNCT],
  ],
};

function highlight(code: string, lang: IntegrationLang): { type: HlType; value: string }[] {
  const rules = HL_RULES[lang];
  const out: { type: HlType; value: string }[] = [];
  let i = 0;
  while (i < code.length) {
    let matched = false;
    for (const [type, re] of rules) {
      re.lastIndex = i;
      const m = re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        const last = out[out.length - 1];
        if (last && last.type === type) last.value += m[0];
        else out.push({ type, value: m[0] });
        i += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const last = out[out.length - 1];
      if (last && last.type === "plain") last.value += code[i];
      else out.push({ type: "plain", value: code[i] });
      i += 1;
    }
  }
  return out;
}

function CodeBlock({ code, lang }: { code: string; lang: IntegrationLang }) {
  const tokens = useMemo(() => highlight(code, lang), [code, lang]);
  return (
    <pre className="overflow-x-auto bg-zinc-950 text-zinc-200 text-[12.5px] leading-relaxed p-4 pt-9 font-mono rounded-xl">
      <code>
        {tokens.map((t, i) => (
          <span key={i} className={HL_CLASS[t.type]}>
            {t.value}
          </span>
        ))}
      </code>
    </pre>
  );
}

// Templates use __BASE__ / __ID__ / __BIZ__ / __ACCENT__ placeholders. Inside
// the JS/HTML samples, real backticks and ${} are escaped so they survive this
// outer template literal and land in the generated snippet verbatim.
const CURL_TPL = `curl -s "__BASE__/api/public/track/__ID__"`;

const JS_TPL = `// Works in the browser and in Node.js 18+ (no API key needed)
async function trackOrder(trackingId) {
  const res = await fetch(\`__BASE__/api/public/track/\${trackingId}\`);
  if (!res.ok) throw new Error(\`Lookup failed: \${res.status}\`);
  return res.json();
}

trackOrder("__ID__").then((order) => {
  console.log(order.statusLabel, "-", order.currentStatus);
  order.events.forEach((e) =>
    console.log(e.at, e.statusLabel, e.location ?? "")
  );
});`;

const PYTHON_TPL = `import requests  # pip install requests

def track_order(tracking_id: str) -> dict:
    url = f"__BASE__/api/public/track/{tracking_id}"
    res = requests.get(url, timeout=10)
    res.raise_for_status()
    return res.json()

order = track_order("__ID__")
print(order["statusLabel"], "-", order["currentStatus"])
for e in order["events"]:
    print(e["at"], e["statusLabel"], e.get("location") or "")`;

const PHP_TPL = `<?php
function track_order(string $trackingId): array {
    $url = "__BASE__/api/public/track/" . urlencode($trackingId);
    $json = file_get_contents($url);
    if ($json === false) {
        throw new RuntimeException("Tracking lookup failed");
    }
    return json_decode($json, true);
}

$order = track_order("__ID__");
echo $order["statusLabel"] . " - " . $order["currentStatus"] . PHP_EOL;
foreach ($order["events"] as $e) {
    echo $e["at"] . "  " . $e["statusLabel"] . "  " . ($e["location"] ?? "") . PHP_EOL;
}`;

const HTML_TPL = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>__BIZ__ - Order tracking</title>
  <style>
    :root { --accent: __ACCENT__; }
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: 48px auto; padding: 0 16px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    form { display: flex; gap: 8px; margin: 16px 0; }
    input { flex: 1; padding: 10px 12px; border: 1px solid #ccc; border-radius: 8px; font-size: 14px; }
    button { padding: 10px 16px; border: 0; border-radius: 8px; background: var(--accent); color: #fff; font-weight: 600; cursor: pointer; }
    .status { font-size: 18px; font-weight: 700; margin-top: 12px; }
    .event { padding: 10px 0; border-top: 1px solid #eee; font-size: 14px; }
    .muted { color: #777; font-size: 12px; }
    .error { color: #c00; }
  </style>
</head>
<body>
  <h1>Track your order</h1>
  <p class="muted">Powered by __BIZ__</p>
  <form id="track-form">
    <input id="track-input" placeholder="e.g. __ID__" value="__ID__" />
    <button type="submit">Track</button>
  </form>
  <div id="track-output"></div>

  <script>
    const API_BASE = "__BASE__";
    const out = document.getElementById("track-output");

    // Build nodes with textContent (never innerHTML) so order data can't
    // inject markup or scripts into your page.
    function el(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    }

    document.getElementById("track-form").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      const id = document.getElementById("track-input").value.trim();
      out.replaceChildren(el("p", "muted", "Loading…"));
      try {
        const res = await fetch(\`\${API_BASE}/api/public/track/\${encodeURIComponent(id)}\`);
        if (!res.ok) throw new Error("Order not found (" + res.status + ")");
        const d = await res.json();
        const eta = d.estimatedDeliveryDate
          ? " · ETA " + new Date(d.estimatedDeliveryDate).toLocaleDateString()
          : "";
        out.replaceChildren(
          el("div", "status", d.statusLabel),
          el("div", "muted", d.trackingId + eta)
        );
        (d.events || []).forEach(function (e) {
          const row = el("div", "event");
          row.appendChild(el("strong", null, e.statusLabel + (e.location ? " · " + e.location : "")));
          row.appendChild(el("div", "muted", new Date(e.at).toLocaleString()));
          if (e.message) row.appendChild(el("div", null, e.message));
          out.appendChild(row);
        });
      } catch (err) {
        out.replaceChildren(el("div", "error", err.message));
      }
    });
  </script>
</body>
</html>`;

function buildSnippets(
  base: string,
  id: string,
  biz: string,
  accent: string,
): Record<IntegrationLang, string> {
  const fill = (tpl: string) =>
    tpl
      .replace(/__BASE__/g, base)
      .replace(/__ID__/g, id)
      .replace(/__BIZ__/g, biz)
      .replace(/__ACCENT__/g, accent);
  return {
    curl: fill(CURL_TPL),
    js: fill(JS_TPL),
    python: fill(PYTHON_TPL),
    php: fill(PHP_TPL),
    html: fill(HTML_TPL),
  };
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy - select the code and copy manually.");
        }
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors tap"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function IntegrationsSection() {
  const { user } = useAuth();
  const { data: business } = useBusiness(user?.businessId);
  const { businessName, primaryColor } = useTheme();

  const prefix = (
    business?.tracking_id_prefix?.trim() ||
    (businessName || "").replace(/[^A-Za-z]/g, "").slice(0, 3) ||
    "TRK"
  ).toUpperCase();

  const [base, setBase] = useState("");
  const [baseTouched, setBaseTouched] = useState(false);
  const [exampleId, setExampleId] = useState(`${prefix}-K7M-9X2A`);
  const [idTouched, setIdTouched] = useState(false);
  const [lang, setLang] = useState<IntegrationLang>("curl");

  // Pre-fill the base URL automatically from what the company gave us at sign-up:
  //   1. the website they entered during onboarding (preferred), normalised to
  //      include https:// if they typed a bare domain;
  //   2. otherwise the domain of their support email (e.g. hi@acme.com → acme.com).
  // We deliberately NEVER fall back to the current browser origin so the hosting
  // / dev domain can't leak in. If neither exists the field keeps its placeholder.
  // Syncing stops the moment the user edits the field so we never clobber input.
  const autoBase = useMemo(() => {
    const site = business?.website_url?.trim();
    if (site) {
      const withProto = /^https?:\/\//i.test(site) ? site : `https://${site}`;
      return withProto.replace(/\/+$/, "");
    }
    const email = business?.support_email?.trim();
    const domain = email && email.includes("@") ? email.split("@")[1]?.trim() : "";
    if (domain && domain.includes(".")) {
      return `https://${domain.replace(/\/+$/, "")}`;
    }
    return "";
  }, [business?.website_url, business?.support_email]);

  useEffect(() => {
    if (baseTouched) return;
    if (autoBase) setBase(autoBase);
  }, [autoBase, baseTouched]);

  // Keep the example ID in sync with the saved prefix until the user edits it.
  useEffect(() => {
    if (!idTouched) setExampleId(`${prefix}-K7M-9X2A`);
  }, [prefix, idTouched]);

  const cleanBase = base.trim().replace(/\/+$/, "") || "https://your-domain.com";
  const cleanId = exampleId.trim() || `${prefix}-K7M-9X2A`;

  const snippets = useMemo(
    () => buildSnippets(cleanBase, cleanId, businessName || "Your Store", primaryColor || "#f97316"),
    [cleanBase, cleanId, businessName, primaryColor],
  );

  return (
    <>
      <SectionShell
        icon={Code2}
        tint={TINTS.indigo}
        title="Integrations"
        description="Embed live order tracking on your own website - copy a snippet in your language, or download a ready-to-run page to test locally."
      >
        <SectionRow
          label="API base URL"
          hint="Pre-filled with your business domain. Change it if your tracking API is hosted elsewhere (e.g. a separate Vercel deployment)."
          htmlFor="int-base"
        >
          <Input
            id="int-base"
            value={base}
            onChange={(e) => {
              setBaseTouched(true);
              setBase(e.target.value);
            }}
            className="h-11 font-mono text-sm"
            spellCheck={false}
            placeholder="https://your-domain.com"
          />
        </SectionRow>

        <SectionRow
          label="Example tracking ID"
          hint="Used throughout the samples below so you can copy and run them right away."
          htmlFor="int-id"
        >
          <Input
            id="int-id"
            value={exampleId}
            onChange={(e) => {
              setIdTouched(true);
              setExampleId(e.target.value.toUpperCase());
            }}
            className="h-11 font-mono text-sm uppercase tracking-wider"
            spellCheck={false}
            placeholder={`${prefix}-K7M-9X2A`}
          />
        </SectionRow>

        <div className="px-4 py-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {INTEGRATION_LANGS.map((l) => {
                const Icon = l.icon;
                const active = lang === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLang(l.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border transition-colors",
                      active
                        ? "border-primary bg-primary/[0.05] text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon
                      className="h-3.5 w-3.5"
                      style={active ? { color: l.color } : undefined}
                    />
                    {l.label}
                  </button>
                );
              })}
            </div>
            <CopyButton text={snippets[lang]} />
          </div>

          <div className="relative">
            <div className="absolute top-2 right-2 z-10 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-800 px-1.5 py-0.5 font-mono rounded-md">
              GET /api/public/track/:id
            </div>
            <CodeBlock code={snippets[lang]} lang={lang} />
          </div>

          {lang === "html" && (
            <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
              <span>
                Save as <span className="font-mono text-foreground">tracking.html</span>, then serve it from a local web server
                (e.g. <span className="font-mono text-foreground">npx serve</span> or <span className="font-mono text-foreground">python3 -m http.server</span>) and add that address to Allowed origins.
              </span>
              <button
                type="button"
                onClick={() => downloadFile("tracking.html", snippets.html, "text/html")}
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline"
              >
                <Download className="h-3.5 w-3.5" /> Download tracking.html
              </button>
            </div>
          )}
        </div>
      </SectionShell>

      <div className="mt-4 px-1 flex items-start gap-2 text-xs text-muted-foreground">
        <Globe className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <p>
          Browser calls from a different website (the JavaScript and HTML samples) need that site's address listed under{" "}
          <span className="font-medium text-foreground">Allowed website origins</span> in the Identity tab - including any
          local server you test with, e.g. <span className="font-mono text-foreground">http://localhost:3000</span>. Opening
          the HTML file directly with <span className="font-mono text-foreground">file://</span> will be blocked, so serve it instead.
          Server-side calls (cURL, Python, PHP) work without any allow-listing.
        </p>
      </div>

      <div className="mt-2 px-1 flex items-center gap-2 text-xs text-muted-foreground">
        <Mail className="h-4 w-4 flex-shrink-0" />
        <p>
          Need a hand integrating?{" "}
          <a
            href="mailto:support@olyxee.com"
            className="font-medium text-foreground hover:underline"
          >
            support@olyxee.com
          </a>
        </p>
      </div>
    </>
  );
}

// ─── Theme option tile ────────────────────────────────────────────────────────
function ThemeOption({
  active, onClick, icon: Icon, label, bg, fg, muted,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  bg: string;
  fg: string;
  muted: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group relative flex flex-col items-stretch border-2 p-3 transition-all duration-200 text-left",
        active
          ? "border-primary bg-primary/[0.03]"
          : "border-border hover:border-muted-foreground/50",
      )}
    >
      <div className={cn("h-20 w-full border border-border/60 overflow-hidden flex", bg)}>
        <div className={cn(
          "w-1/3 border-r border-border/40 p-2 flex flex-col gap-1.5",
          bg === "bg-white" ? "bg-zinc-50" : "bg-zinc-950",
        )}>
          <div className={cn("h-1.5 w-3/4", muted)} />
          <div className={cn("h-1.5 w-1/2", muted)} />
          <div className={cn("h-1.5 w-2/3", muted)} />
        </div>
        <div className="flex-1 p-2 flex flex-col gap-1.5">
          <div className={cn("h-1.5 w-1/3", fg)} />
          <div className={cn("h-1.5 w-2/3", muted)} />
          <div className={cn("h-1.5 w-1/2", muted)} />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 px-0.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-foreground" />
          <span className="text-sm font-medium">{label}</span>
        </div>
        {active && (
          <span className="inline-flex items-center justify-center h-4 w-4 bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </div>
    </button>
  );
}

function CallCentreSettingsEmbed() {
  const { user } = useAuth();
  const { data: business } = useBusiness(user?.businessId);
  const featureOn = isFeatureEnabled("automatedCallCentre");
  const planId = (business?.plan as "beta" | "free" | "pro" | "business" | undefined) ?? "beta";
  const plan = plans[planId] ?? plans.beta;
  const canEnable = plan.automatedCallCentre === true;

  if (!featureOn) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          The automated call centre is not yet available. It will launch on 20 August 2026.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Connect Call Centre</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          AI-powered inbound call handling by Retell.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm text-muted-foreground">Status</span>
          <span className={`text-sm font-medium ${business?.call_centre_enabled ? "text-green-700" : "text-muted-foreground"}`}>
            {business?.call_centre_enabled ? "Active" : "Inactive"}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 border-b">
          <span className="text-sm text-muted-foreground">Phone number</span>
          <span className="text-sm font-mono">{business?.retell_phone_number ?? "—"}</span>
        </div>
        {!business?.call_centre_enabled && (
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <p>
              {canEnable
                ? "Enable call centre to start receiving AI-handled inbound calls."
                : `Call centre requires a ${plans.business.name} plan (R${plan.price}/mo).`}
            </p>
          </div>
        )}
        <div className="pt-2">
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/call-centre">
              {business?.call_centre_enabled ? "Manage Call Centre" : "Set up Call Centre"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
