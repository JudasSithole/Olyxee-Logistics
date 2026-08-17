// Shared invoice-profile logic used by both the Settings "Invoice details"
// section and the account-setup onboarding step. Keeping the parse/format,
// hydrate, and update-mapping in one place means the two entry points can
// never drift: whatever is captured at onboarding round-trips identically
// through Settings.

export interface InvoiceProfile {
  legalName: string;
  registrationNumber: string;
  taxNumber: string;
  streetAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  email: string;
  phone: string;
  logoUrl: string;
  bank: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  accountType: string;
  paymentExtra: string;
  paymentTerms: string;
  footerNote: string;
}

export const EMPTY_INVOICE_PROFILE: InvoiceProfile = {
  legalName: "",
  registrationNumber: "",
  taxNumber: "",
  streetAddress: "",
  city: "",
  province: "",
  postalCode: "",
  country: "",
  email: "",
  phone: "",
  logoUrl: "",
  bank: "",
  accountName: "",
  accountNumber: "",
  branchCode: "",
  accountType: "",
  paymentExtra: "",
  paymentTerms: "Payment due on receipt.",
  footerNote: "",
};

export const SOUTH_AFRICAN_BANKS = [
  "Absa", "African Bank", "Bank Zero", "Bidvest Bank", "Capitec Bank",
  "Discovery Bank", "FNB", "Investec", "Nedbank", "Standard Bank", "TymeBank",
];
export const SOUTH_AFRICAN_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];
export const SOUTH_AFRICAN_CITIES = [
  "Bloemfontein", "Cape Town", "Durban", "East London", "Gqeberha",
  "Johannesburg", "Kimberley", "Mbombela", "Polokwane", "Pretoria", "Rustenburg",
];
export const BANK_ACCOUNT_TYPES = [
  "Business Cheque", "Cheque", "Current", "Savings", "Transmission",
];

// The invoice address is stored as a single multi-line string on the business
// row; parse it back into its parts (best-effort, tolerant of older formats)
// and re-compose it for saving.
export function parseInvoiceAddress(value: string | null | undefined) {
  const lines = (value || "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  if (lines.length >= 4)
    return { streetAddress: lines[0], city: lines[1], province: lines[2], postalCode: lines[3], country: lines.slice(4).join(", ") };
  if (lines.length === 3) {
    const place = lines[1].split(",").map((v) => v.trim());
    const postal = lines[2].split(",").map((v) => v.trim());
    return { streetAddress: lines[0], city: place[0] || "", province: place.slice(1).join(", "), postalCode: postal[0] || "", country: postal.slice(1).join(", ") };
  }
  if (lines.length === 2) return { streetAddress: lines[0], city: lines[1], province: "", postalCode: "", country: "" };
  return { streetAddress: lines[0] || "", city: "", province: "", postalCode: "", country: "" };
}

export function formatInvoiceAddress(profile: InvoiceProfile) {
  return [profile.streetAddress, profile.city, profile.province, profile.postalCode, profile.country]
    .map((v) => v.trim())
    .filter(Boolean)
    .join("\n");
}

// Payment/bank details are likewise stored as a labelled multi-line string.
export function parsePaymentDetails(value: string | null | undefined) {
  const result = { bank: "", accountName: "", accountNumber: "", branchCode: "", accountType: "", paymentExtra: "" };
  const extra: string[] = [];
  for (const line of (value || "").split(/\r?\n/).map((v) => v.trim()).filter(Boolean)) {
    const match = line.match(/^(bank|account name|account number|branch code|account type)\s*:\s*(.*)$/i);
    if (!match) { extra.push(line); continue; }
    const key = match[1].toLowerCase();
    const text = match[2];
    if (key === "bank") result.bank = text;
    else if (key === "account name") result.accountName = text;
    else if (key === "account number") result.accountNumber = text;
    else if (key === "branch code") result.branchCode = text;
    else result.accountType = text;
  }
  result.paymentExtra = extra.join("\n");
  return result;
}

export function formatPaymentDetails(profile: InvoiceProfile) {
  return [
    ["Bank", profile.bank],
    ["Account Name", profile.accountName],
    ["Account Number", profile.accountNumber],
    ["Branch Code", profile.branchCode],
    ["Account Type", profile.accountType],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${label}: ${value.trim()}`)
    .concat(profile.paymentExtra.trim() ? profile.paymentExtra.trim() : [])
    .join("\n");
}

// Fields read off a loaded business row to prefill the form. All optional so
// either the Settings or onboarding business shape can be passed in.
export interface InvoiceProfileBusinessSource {
  name?: string | null;
  support_email?: string | null;
  phone?: string | null;
  location?: string | null;
  business_logo_url?: string | null;
  invoice_legal_name?: string | null;
  invoice_registration_number?: string | null;
  invoice_tax_number?: string | null;
  invoice_address?: string | null;
  invoice_email?: string | null;
  invoice_phone?: string | null;
  invoice_logo_url?: string | null;
  invoice_payment_details?: string | null;
  invoice_payment_terms?: string | null;
  invoice_footer_note?: string | null;
}

// Build a fully-populated form profile from a business row, falling back to the
// general business account details (name, support email, phone, logo) so the
// user reviews prefilled values instead of an empty form.
export function hydrateInvoiceProfile(business: InvoiceProfileBusinessSource): InvoiceProfile {
  const savedPayment = parsePaymentDetails(business.invoice_payment_details);
  const savedAddress = parseInvoiceAddress(business.invoice_address || business.location);
  return {
    ...EMPTY_INVOICE_PROFILE,
    legalName: business.invoice_legal_name || business.name || "",
    registrationNumber: business.invoice_registration_number || "",
    taxNumber: business.invoice_tax_number || "",
    ...savedAddress,
    country: savedAddress.country || "South Africa",
    email: business.invoice_email || business.support_email || "",
    phone: business.invoice_phone || business.phone || "",
    logoUrl: business.invoice_logo_url || business.business_logo_url || "",
    ...savedPayment,
    accountName: savedPayment.accountName || business.invoice_legal_name || business.name || "",
    paymentTerms: business.invoice_payment_terms || "Payment due on receipt.",
    footerNote: business.invoice_footer_note || "",
  };
}

// Number of the 8 "essential" invoice fields that are filled in - drives the
// readiness meter.
export function invoiceReadyCount(profile: InvoiceProfile): number {
  return [
    profile.legalName, profile.streetAddress, profile.city, profile.country,
    profile.email, profile.bank, profile.accountName, profile.accountNumber,
  ].filter((v) => v.trim()).length;
}

// Map the form profile to the snake_case business-update payload consumed by
// useUpdateBusiness(). Blank fields are sent as null so they clear cleanly.
export function buildInvoiceUpdate(profile: InvoiceProfile) {
  return {
    invoice_legal_name: profile.legalName || null,
    invoice_registration_number: profile.registrationNumber || null,
    invoice_tax_number: profile.taxNumber || null,
    invoice_address: formatInvoiceAddress(profile) || null,
    invoice_email: profile.email || null,
    invoice_phone: profile.phone || null,
    invoice_logo_url: profile.logoUrl || null,
    invoice_payment_details: formatPaymentDetails(profile) || null,
    invoice_payment_terms: profile.paymentTerms || null,
    invoice_footer_note: profile.footerNote || null,
  };
}
