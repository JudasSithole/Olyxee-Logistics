// Safe monetary parsing. The legacy invoice columns (subtotal/additional_charges
// /total) are stored as TEXT and can in theory hold junk. Every finance
// calculation must go through this so a bad value degrades to 0 rather than
// producing NaN and poisoning an aggregate. (Flagged as tech debt: migrate those
// columns to numeric later — not done here to avoid a risky money-type change.)
export function parseMoney(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  // Strip currency symbols, spaces and thousands separators; keep digits, a
  // single decimal point and a leading minus.
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// Round to cents to avoid floating-point dust in returned totals.
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Gross margin as a percentage of revenue. Returns null when revenue is 0 (a
// margin % is meaningless without revenue), never Infinity/NaN.
export function marginPct(revenue: number, grossProfit: number): number | null {
  if (!revenue) return null;
  return round2((grossProfit / revenue) * 100);
}

// Default low-margin threshold (%). A job at or below this is flagged for
// attention. Configurable per-business later; a constant for now.
export const LOW_MARGIN_THRESHOLD_PCT = 15;
