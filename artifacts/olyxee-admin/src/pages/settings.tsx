import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Moon, Sun, Check, AlertCircle, AlertTriangle, Upload, X, Eye, Loader2, Pipette, Shuffle,
  Building2, Mail, SunMoon, RotateCcw, History, Trash2, ShieldAlert,
  Code2, Copy, Download, Globe, Tag, GitBranch, ExternalLink,
} from "lucide-react";
import {
  BusinessTypeSelector,
  BUSINESS_TYPES,
} from "@/components/business-type-selector";
import { SiCurl, SiJavascript, SiPython, SiPhp, SiHtml5 } from "react-icons/si";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useGetBusiness, useUpdateBusiness, useDeleteBusiness } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ActivityFeed } from "@/components/activity-feed";
import { LogoUpload } from "@/components/logo-upload";
import { compressLogo, compressFavicon } from "@/lib/image-processing";

// ─── Color presets ────────────────────────────────────────────────────────────
const PRESET_COLORS = [
  { label: "Charcoal", hex: "#2b2b2b" },
  { label: "Slate", hex: "#475569" },
  { label: "Ocean", hex: "#2563eb" },
  { label: "Indigo", hex: "#4f46e5" },
  { label: "Emerald", hex: "#059669" },
  { label: "Rose", hex: "#e11d48" },
];

const DEFAULT_PRIMARY = "#2b2b2b";

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

  const presetMatch = PRESET_COLORS.find(
    (c) => c.hex.toLowerCase() === value.toLowerCase(),
  );

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

  // Tasteful random — restrict to mid-saturation / mid-lightness so we
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
    okay: { label: "White text works for large headings only — pick a darker shade for buttons.", tone: "text-amber-700" },
    bad: { label: "White text is hard to read on this color. Try something darker.", tone: "text-rose-700" },
  };

  return (
    <div className="space-y-4">
      {/* Step 1: Named presets — bigger tiles with the name visible so the
          choice feels like picking a brand mood, not guessing at swatches. */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Quick picks</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {PRESET_COLORS.map((c) => {
            const active = value.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => onChange(c.hex)}
                aria-pressed={active}
                className={cn(
                  "group relative flex flex-col items-stretch border transition-all text-left",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  active
                    ? "border-foreground"
                    : "border-border hover:border-muted-foreground/60",
                )}
              >
                <div
                  className="h-12 w-full flex items-center justify-center"
                  style={{ backgroundColor: c.hex }}
                >
                  {active && <Check className="h-4 w-4 text-white drop-shadow" aria-hidden="true" />}
                </div>
                <div className="px-2 py-1.5 flex items-center justify-between gap-1 bg-background">
                  <span className="text-[11px] font-medium truncate">{c.label}</span>
                  {active && (
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">In use</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2: Custom color — one tidy row instead of three stacked controls.
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
            className="h-10 w-10 border border-border flex-shrink-0 relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

          {!presetMatch && (
            <span className="inline-flex items-center px-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-muted/40 border border-border">
              Custom
            </span>
          )}
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

      {/* Step 3: Plain-English readability check — tells the admin whether
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

// ─── Section primitives (Apple "Inset Grouped" feel) ──────────────────────────
// A section is a titled card. Title + description live OUTSIDE the card (small,
// muted) — content lives INSIDE on a flat surface with hairline dividers
// between rows. This is the macOS / iOS Settings pattern and keeps the page
// scannable when you have a lot of fields.

function SectionShell({
  id, icon: Icon, title, description, action, children,
}: {
  // Optional — used to be required for scrollspy anchors. With tabs now
  // driving navigation, callers usually omit it.
  id?: string;
  icon: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      // scroll-mt accounts for the sticky page header so anchor jumps land
      // with breathing room above the section title.
      className="scroll-mt-24 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-500"
    >
      <header className="px-1 mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 ml-6">{description}</p>
          )}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </header>

      <div className="bg-card border border-border divide-y divide-border/70">
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
// mockups. It shows — at a glance, side by side — how the brand reads in this
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
    <div className="bg-card border border-border">
      <div className="px-4 py-2 border-b border-border bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
        <Eye className="h-3 w-3" aria-hidden="true" />
        Live preview
      </div>
      <div className="p-4 grid gap-4 sm:grid-cols-2">
        {/* Sidebar */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Sidebar</p>
          <div className="flex items-center gap-2.5 px-3 h-11 border border-border bg-background">
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
            className="px-3 py-1.5 text-[11px] font-semibold text-white w-fit"
            style={{ background: primaryColor }}
          >
            Orders
          </div>
        </div>

        {/* Browser tab */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-muted-foreground">Browser tab</p>
          <div className="bg-muted/60 pt-2 px-2 border border-border">
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

        {/* Customer email line — full width */}
        <div className="space-y-1.5 sm:col-span-2">
          <p className="text-[10px] text-muted-foreground">On customer emails</p>
          <div className="border border-border bg-background px-3 py-2.5">
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
  { id: "identity", label: "Brand & Identity", icon: Building2 },
  { id: "integrations", label: "Integrations", icon: Code2 },
  { id: "appearance", label: "Appearance", icon: SunMoon },
  { id: "workflows", label: "Workflows", icon: GitBranch },
  { id: "activity", label: "Activity", icon: History },
  { id: "danger", label: "Danger zone", icon: ShieldAlert },
] as const;

// ─── Danger zone ──────────────────────────────────────────────────────────────
// Permanently deletes the current business and every row tied to it. Requires
// the operator to type the exact business name to guard against muscle-memory
// clicks. After a successful delete we sign out client-side and bounce home.
function DangerZone({ businessName }: { businessName: string }) {
  const [, setLocation] = useLocation();
  const { signOut } = useAuth();
  const deleteMutation = useDeleteBusiness();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const matches =
    confirmText.trim().toLowerCase() === businessName.trim().toLowerCase() &&
    businessName.trim().length > 0;

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync();
      toast.success("Business deleted");
      // Cookie is cleared server-side; clear client-side auth state too so the
      // protected routes stop hitting /business with a now-invalid session.
      await signOut().catch(() => {});
      setOpen(false);
      setLocation("/");
    } catch {
      toast.error("Couldn't delete the business. Please try again.");
    }
  }

  return (
    <SectionShell
      icon={ShieldAlert}
      title="Danger zone"
      description="Irreversible actions that affect the entire business account."
    >
      <div className="border border-destructive/40 bg-destructive/[0.03] rounded-md">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-foreground flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Delete this business
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-xl">
              Permanently delete <span className="font-medium text-foreground">{businessName || "this business"}</span>,
              all customers, orders, tracking events, email notifications,
              audit logs, and user accounts. This cannot be undone.
            </p>
          </div>

          <AlertDialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setConfirmText("");
            }}
          >
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="gap-2 self-start sm:self-auto whitespace-nowrap"
                data-testid="button-open-delete-business"
              >
                <Trash2 className="h-4 w-4" />
                Delete business
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete this business?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>
                      This action is <span className="font-medium text-foreground">permanent</span>.
                      Everything in your account — customers, orders, tracking events,
                      email logs, and team members — will be erased.
                    </p>
                    <p>
                      To confirm, type the business name{" "}
                      <span className="font-medium text-foreground">{businessName}</span>{" "}
                      below.
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>

              <div className="space-y-2 py-2">
                <Label htmlFor="confirm-business" className="text-[13px]">
                  Business name
                </Label>
                <Input
                  id="confirm-business"
                  autoComplete="off"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={businessName}
                  className="h-10"
                  data-testid="input-confirm-business-name"
                />
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    if (!matches || deleteMutation.isPending) return;
                    void handleDelete();
                  }}
                  disabled={!matches || deleteMutation.isPending}
                  className="bg-destructive text-white hover:bg-destructive/90 gap-2"
                  data-testid="button-confirm-delete-business"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete forever
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </SectionShell>
  );
}

// ─── Settings page ────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const theme = useTheme();

  // Local form state for the theme/branding bits. Email wording lives in its
  // own component because it persists to the server, not localStorage.
  const initial = useMemo(
    () => ({
      businessName: theme.businessName,
      businessTagline: theme.businessTagline,
      logoUrl: theme.logoUrl,
      faviconUrl: theme.faviconUrl,
      primaryColor: theme.primaryColor,
    }),
    // Re-baseline only when the saved theme values change (e.g. after a save).
    [theme.businessName, theme.businessTagline, theme.logoUrl, theme.faviconUrl, theme.primaryColor],
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

  const handleSave = useCallback(() => {
    theme.saveSettings({
      businessName: form.businessName,
      businessTagline: form.businessTagline,
      logoUrl: form.logoUrl,
      faviconUrl: form.faviconUrl,
      primaryColor: form.primaryColor,
    });
    toast.success("Settings saved");
  }, [theme, form]);

  const handleDiscard = useCallback(() => {
    setForm(initial);
  }, [initial]);

  // Track the email editor's dirty state so the beforeunload guard covers
  // unsaved email wording too (email persists server-side via its own button,
  // so it's not in the page-level save bar — but losing typed text on tab
  // close would still be a bad surprise).
  const [emailDirty, setEmailDirty] = useState(false);
  const guardActive = hasChanges || emailDirty;

  // ⌘S / Ctrl+S — power-user shortcut. Browsers reserve this for "Save page",
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

  // Keep the URL hash in sync as the tab changes — preserves deep-linking
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
      {/* Page header — kept generous; this is the moment the page "establishes
          itself" before the content groups begin. */}
      <header className="mb-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1.5 text-[15px]">
          Manage your business profile, branding, and developer integrations.
        </p>
      </header>

      {/* Tabs — replace the long scroll. Only the active panel renders, so
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
                <Icon className="relative z-10 h-3.5 w-3.5" />
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
            preview — far shorter and calmer than the old stacked sections. */}
        <TabsContent value="identity" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={Building2}
            title="Brand & Identity"
            description="Your name, logo, and accent color — how you appear to your team and customers."
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

          {/* Business Type — persists server-side independently of the
              theme save bar (same pattern as Tracking). */}
          <div className="mt-8">
            <BusinessTypeSection />
          </div>

          {/* Tracking section persists server-side (separate from the theme
              form's save bar). */}
          <div className="mt-8">
            <TrackingCustomizationSection />
          </div>
        </TabsContent>

        {/* ─── Integrations ─────────────────────────────────────────── */}
        <TabsContent value="integrations" className="mt-6 focus-visible:outline-none">
          <IntegrationsSection />
        </TabsContent>

        {/* ─── Appearance ───────────────────────────────────────────── */}
        <TabsContent value="appearance" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={SunMoon}
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

        {/* ─── Workflows ────────────────────────────────────────────── */}
        <TabsContent value="workflows" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={GitBranch}
            title="Workflow Templates"
            description="Define and assign the steps your team follows for every order."
          >
            <div className="px-4 py-6 flex flex-col items-center gap-4 text-center">
              <GitBranch className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-foreground">Manage your workflow templates</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Create custom workflows, clone system presets, and assign an active template to
                  control the order statuses shown to your team.
                </p>
              </div>
              <a
                href="/workflows"
                className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 hover:text-muted-foreground transition-colors"
              >
                Open Workflows
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          </SectionShell>
        </TabsContent>

        {/* ─── Activity ─────────────────────────────────────────────── */}
        <TabsContent value="activity" className="mt-6 focus-visible:outline-none">
          <SectionShell
            icon={History}
            title="Activity"
            description="A plain-English log of what's happened in your account."
          >
            <ActivityFeed />
          </SectionShell>
        </TabsContent>

        {/* ─── Danger zone ──────────────────────────────────────────── */}
        <TabsContent value="danger" className="mt-6 focus-visible:outline-none">
          <DangerZone businessName={theme.businessName} />
        </TabsContent>
      </Tabs>

      {/* ─── Sticky save bar ───────────────────────────────────────────────
          Floats above the content with a soft backdrop blur. Slides in only
          when there are real changes — the empty state would feel like noise. */}
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
// into outgoing customer status emails. Self-contained — has its own load /
// save lifecycle and "Save email wording" button so it doesn't interfere with
// the page-level "Unsaved changes" bar (which is wired to the theme form).
function EmailCustomizationSection({
  businessName,
  onDirtyChange,
}: {
  businessName: string;
  // Lets the parent extend its beforeunload guard to cover unsaved email
  // wording. We notify on every transition rather than every keystroke.
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { data: business, isLoading, refetch } = useGetBusiness();
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
        emailGreeting: business.emailGreeting ?? "",
        emailSignature: business.emailSignature ?? "",
        emailFooterNote: business.emailFooterNote ?? "",
      });
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty =
    loaded &&
    (form.emailGreeting !== (business?.emailGreeting ?? "") ||
      form.emailSignature !== (business?.emailSignature ?? "") ||
      form.emailFooterNote !== (business?.emailFooterNote ?? ""));

  // Surface dirty state to the parent so the page-level beforeunload guard
  // can fire when email wording has unsaved changes too.
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = () => {
    updateMutation.mutate(
      {
        data: {
          emailGreeting: form.emailGreeting.trim() ? form.emailGreeting : null,
          emailSignature: form.emailSignature.trim() ? form.emailSignature : null,
          emailFooterNote: form.emailFooterNote.trim() ? form.emailFooterNote : null,
        },
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
      emailGreeting: business?.emailGreeting ?? "",
      emailSignature: business?.emailSignature ?? "",
      emailFooterNote: business?.emailFooterNote ?? "",
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
  const previewSignature = sub(form.emailSignature || "— {businessName}");
  const previewFooter = sub(form.emailFooterNote || "");

  return (
    <SectionShell
      id="emails"
      icon={Mail}
      title="Customer emails"
      description="Customize the greeting, sign-off, and footer on status emails."
      action={dirty ? <RestoreButton onClick={handleReset} /> : undefined}
    >
      {/* Token legend */}
      <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>Tokens:</span>
        <code className="font-mono text-foreground bg-background border border-border px-1.5 py-0.5">{"{name}"}</code>
        <span className="text-muted-foreground/70">customer's name</span>
        <code className="font-mono text-foreground bg-background border border-border px-1.5 py-0.5">{"{businessName}"}</code>
        <span className="text-muted-foreground/70">your business</span>
      </div>

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
            hint="Optional — shown below the sign-off in muted text."
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

          {/* Live email preview — uses real fallbacks + token substitution so
              the admin sees exactly what the customer will get. */}
          <div className="px-4 py-4 bg-muted/20 space-y-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <div className="border border-border bg-background p-4 text-sm space-y-3">
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
              Saves immediately — separate from the page-level Save.
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
  const { data: business, isLoading, refetch } = useGetBusiness();
  const updateMutation = useUpdateBusiness();

  const [selected, setSelected] = useState<string>("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (business && !loaded) {
      setSelected(business.industry ?? "");
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty = loaded && selected !== (business?.industry ?? "");

  const handleSave = () => {
    if (!selected) {
      toast.error("Please choose a business type before saving.");
      return;
    }
    updateMutation.mutate(
      { data: { industry: selected } },
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
    setSelected(business?.industry ?? "");
  };

  const currentLabel =
    BUSINESS_TYPES.find((t) => t.value === (business?.industry ?? ""))?.label ??
    business?.industry ??
    "Not set";

  return (
    <SectionShell
      icon={Tag}
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
//   trackingIdPrefix — 3–5 uppercase letters, used as the leading segment
//     of every new tracking ID we generate (e.g. "FSL" → "FSL-K7M-9X2A").
//   allowedOrigins   — comma-separated list of customer-site origins allowed
//     to call the public tracking endpoint cross-origin.
// Self-contained like EmailCustomizationSection so it persists independently
// of the theme save bar at the top of the page.
function TrackingCustomizationSection() {
  const { data: business, isLoading, refetch } = useGetBusiness();
  const updateMutation = useUpdateBusiness();

  const [form, setForm] = useState({
    trackingIdPrefix: "",
    allowedOrigins: "",
  });
  const [loaded, setLoaded] = useState(false);
  // Local validation: prefix must be 3–5 A–Z when present. Empty is allowed
  // (server falls back to "OLY") so users can clear it.
  const prefixValid =
    form.trackingIdPrefix === "" || /^[A-Z]{3,5}$/.test(form.trackingIdPrefix);

  useEffect(() => {
    if (business && !loaded) {
      setForm({
        trackingIdPrefix: business.trackingIdPrefix ?? "",
        allowedOrigins: business.allowedOrigins ?? "",
      });
      setLoaded(true);
    }
  }, [business, loaded]);

  const dirty =
    loaded &&
    (form.trackingIdPrefix !== (business?.trackingIdPrefix ?? "") ||
      form.allowedOrigins !== (business?.allowedOrigins ?? ""));

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
        data: {
          trackingIdPrefix: form.trackingIdPrefix
            ? form.trackingIdPrefix
            : null,
          allowedOrigins: normalizedOrigins ? normalizedOrigins : null,
        },
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
      trackingIdPrefix: business?.trackingIdPrefix ?? "",
      allowedOrigins: business?.allowedOrigins ?? "",
    });
  };

  return (
    <SectionShell
      id="tracking"
      icon={Building2}
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
                  // a letter, clamp to 5 chars — produces a valid prefix
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
              Saves immediately — separate from the page-level Save.
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
// tracking endpoint (GET /api/public/track/:id — no auth) so a customer's
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
// real code. Tokens are rendered as React spans, so all text is auto-escaped —
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
    <pre className="overflow-x-auto bg-zinc-950 text-zinc-200 text-[12.5px] leading-relaxed p-4 pt-9 font-mono">
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
  console.log(order.statusLabel, "—", order.currentStatus);
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
  <title>__BIZ__ — Order tracking</title>
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
          toast.error("Couldn't copy — select the code and copy manually.");
        }
      }}
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 border border-border bg-background hover:bg-muted transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function IntegrationsSection() {
  const { data: business } = useGetBusiness();
  const { businessName, primaryColor } = useTheme();

  // Align the example to the current business: use its saved tracking prefix,
  // and if none is set yet, derive one from the business name (first letters)
  // rather than a hardcoded brand.
  const prefix = (
    business?.trackingIdPrefix?.trim() ||
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
    const site = business?.websiteUrl?.trim();
    if (site) {
      const withProto = /^https?:\/\//i.test(site) ? site : `https://${site}`;
      return withProto.replace(/\/+$/, "");
    }
    const email = business?.supportEmail?.trim();
    const domain = email && email.includes("@") ? email.split("@")[1]?.trim() : "";
    if (domain && domain.includes(".")) {
      return `https://${domain.replace(/\/+$/, "")}`;
    }
    return "";
  }, [business?.websiteUrl, business?.supportEmail]);

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
        title="Integrations"
        description="Embed live order tracking on your own website — copy a snippet in your language, or download a ready-to-run page to test locally."
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
            <div className="absolute top-2 right-2 z-10 text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-800 px-1.5 py-0.5 font-mono">
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
          <span className="font-medium text-foreground">Allowed website origins</span> in the Identity tab — including any
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
