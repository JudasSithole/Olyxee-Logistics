import { randomBytes } from "crypto";

export function generateId(): string {
  return randomBytes(16).toString("hex");
}

// Alphabet for customer-facing tracking IDs. Excludes 0/O/1/I/L so the codes
// stay readable when handwritten or read aloud over the phone.
const TRACKING_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomChars(n: number): string {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += TRACKING_ALPHABET[bytes[i] % TRACKING_ALPHABET.length];
  }
  return out;
}

// Customer-facing tracking ID in the form {PREFIX}-{3 alnums}-{4 alnums},
// e.g. FSL-K7M-9X2A. Prefix is 3–5 uppercase letters chosen by the business;
// we sanitize and clamp it here so unusual inputs (slugs, lowercase) still
// produce a well-formed ID. ~26 bits of entropy in the random portion - plenty
// for tens of thousands of orders per tenant before collision risk matters,
// and the caller still loops on the unique constraint to be safe.
export function generateTrackingId(prefixInput: string): string {
  const cleaned = (prefixInput ?? "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .substring(0, 5);
  const prefix = cleaned.length >= 3 ? cleaned : "OLY";
  return `${prefix}-${randomChars(3)}-${randomChars(4)}`;
}

// Derive the same human-friendly company acronym used by Job Numbers. Legal
// suffixes do not identify the brand, so "Freight Solutions Logistics (Pty)
// Ltd" becomes "FSL" rather than "FSLPL".
export function companyAcronym(name: string | null | undefined): string {
  const ignored = new Set(["PTY", "LTD", "LIMITED", "INC", "LLC", "COMPANY", "CO"]);
  const words = (name ?? "")
    .toUpperCase()
    .match(/[A-Z0-9]+/g)
    ?.filter((word) => !ignored.has(word)) ?? [];
  if (words.length >= 2) return words.slice(0, 4).map((word) => word[0]).join("").padEnd(3, "X");
  if (words.length === 1) return words[0].slice(0, 3).padEnd(3, "X");
  return "OLY";
}

// Pick the leading segment for a business's tracking IDs so every code is
// clearly tied to THAT business. Preference order:
//   1. the prefix the business explicitly configured (unique per business);
//   2. otherwise a 3–4 letter acronym from the business name (e.g. "Freight
//      Shift Logistics" -> "FSL"), so businesses that never set a prefix get
//      a branded, business-specific code instead of a shared generic one;
//   3. otherwise the first 3+ letters of the (always-present, URL-safe) slug,
//      which covers names that yield <3 A-Z letters (very short or non-Latin);
//   4. "OLY" only as a true last resort.
// generateTrackingId() re-sanitizes whatever this returns, so it's safe to
// pass slightly messy input.
export function resolveTrackingPrefix(
  configuredPrefix: string | null | undefined,
  businessName: string | null | undefined,
  slug?: string | null | undefined,
): string {
  const lettersOf = (s: string | null | undefined) =>
    (s ?? "").toUpperCase().replace(/[^A-Z]/g, "");

  const configured = lettersOf(configuredPrefix).substring(0, 5);
  // TRK is the old schema default applied to SaaS accounts automatically; it
  // was never chosen by the tenant and must not override company branding.
  // Any other valid prefix is considered an intentional customization.
  if (configured === "TRK") return companyAcronym(businessName);
  if (configured.length >= 3) return configured;

  const fromName = companyAcronym(businessName);
  if (fromName.length >= 3) return fromName;

  const fromSlug = lettersOf(slug).substring(0, 3);
  if (fromSlug.length >= 3) return fromSlug;

  return "OLY";
}
