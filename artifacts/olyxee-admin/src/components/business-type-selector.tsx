import { useMemo, useState } from "react";
import {
  Truck,
  UtensilsCrossed,
  ShoppingBag,
  Pill,
  Shirt,
  Wrench,
  Printer,
  Building2,
  Check,
  Search,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// ─── Business type definitions ────────────────────────────────────────────────

export interface BusinessTypeOption {
  value: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

export const BUSINESS_TYPES: BusinessTypeOption[] = [
  {
    value: "Logistics Company",
    label: "Logistics Company",
    description: "Freight, courier & delivery operations",
    icon: Truck,
  },
  {
    value: "Restaurant",
    label: "Restaurant",
    description: "Food service & takeaway orders",
    icon: UtensilsCrossed,
  },
  {
    value: "Retail Store",
    label: "Retail Store",
    description: "In-store & online product sales",
    icon: ShoppingBag,
  },
  {
    value: "Pharmacy",
    label: "Pharmacy",
    description: "Medication & health product delivery",
    icon: Pill,
  },
  {
    value: "Dry Cleaner",
    label: "Dry Cleaner",
    description: "Garment cleaning & laundry pickup",
    icon: Shirt,
  },
  {
    value: "Repair Shop",
    label: "Repair Shop",
    description: "Electronics, appliances & vehicle repairs",
    icon: Wrench,
  },
  {
    value: "Printing Shop",
    label: "Printing Shop",
    description: "Print jobs, banners & marketing materials",
    icon: Printer,
  },
  {
    value: "Custom Business",
    label: "Custom Business",
    description: "Any other type of business",
    icon: Building2,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface BusinessTypeSelectorProps {
  value: string | null | undefined;
  onChange: (type: string) => void;
  /** Render in a compact 2-row layout suitable for settings panels */
  compact?: boolean;
}

export function BusinessTypeSelector({
  value,
  onChange,
  compact = false,
}: BusinessTypeSelectorProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BUSINESS_TYPES;
    return BUSINESS_TYPES.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search business types…"
          className="pl-9 pr-9 h-10"
          aria-label="Search business types"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No business types match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div
          className={cn(
            "grid gap-3",
            compact
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
          )}
          role="listbox"
          aria-label="Business type"
        >
          {filtered.map((type) => {
            const Icon = type.icon;
            const selected = value === type.value;
            return (
              <button
                key={type.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => onChange(type.value)}
                className={cn(
                  "group relative flex flex-col items-start gap-3 rounded-lg border p-4 text-left transition-all",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  "hover:border-foreground/40 hover:bg-muted/40",
                  selected
                    ? "border-foreground bg-foreground/4 shadow-sm"
                    : "border-border bg-card",
                )}
              >
                {/* Selected check badge */}
                {selected && (
                  <span
                    className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-foreground"
                    aria-hidden="true"
                  >
                    <Check className="h-3 w-3 text-background" strokeWidth={3} />
                  </span>
                )}

                {/* Icon container */}
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-md border transition-colors",
                    selected
                      ? "border-foreground/30 bg-foreground text-background"
                      : "border-border bg-muted/60 text-muted-foreground group-hover:border-foreground/20 group-hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>

                {/* Label + description */}
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-semibold leading-tight",
                      selected ? "text-foreground" : "text-foreground/90",
                    )}
                  >
                    {type.label}
                  </p>
                  {!compact && (
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                      {type.description}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
