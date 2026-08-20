import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogoUpload } from "@/components/logo-upload";
import {
  BANK_ACCOUNT_TYPES,
  SOUTH_AFRICAN_BANKS,
  SOUTH_AFRICAN_CITIES,
  SOUTH_AFRICAN_PROVINCES,
  type InvoiceProfile,
} from "@/lib/invoice-profile";

interface InvoiceProfileFieldsProps {
  profile: InvoiceProfile;
  update: (key: keyof InvoiceProfile, value: string) => void;
  pickLogo: (file: File) => void;
  // Return to the previous onboarding screen (from the first sub-step).
  onBack: () => void;
  // Finish onboarding - used by "Finish setup" and "Skip for now" alike, so the
  // whole invoice profile stays optional.
  onComplete: () => void;
  submitting?: boolean;
}

// Shared, soft-fill control styling so every input, select and textarea reads as
// one calm system (matches the create-Job wizard). Selects keep their native
// arrow; only colours/shape are themed.
const field =
  "h-11 w-full rounded-xl border border-border bg-muted/40 px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-foreground/25 focus:bg-background focus:ring-2 focus:ring-ring/40";
const labelCls = "mb-1.5 block text-[13px] font-medium text-foreground";

function Field({
  label,
  htmlFor,
  hint,
  full,
  children,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const SUB_STEPS = [
  { title: "Your business", subtitle: "The name and contact shown on your invoices." },
  { title: "Business address", subtitle: "Where your business is based." },
  { title: "Getting paid", subtitle: "The bank details customers pay into." },
  { title: "Branding & terms", subtitle: "Logo, payment terms, and a footer note." },
] as const;

// The invoice profile, captured as a short 4-step wizard so no single screen is
// long. Everything is optional - the user can Continue past empty steps or Skip
// out entirely and finish it later in Settings. Only used by onboarding.
export function InvoiceProfileFields({
  profile,
  update,
  pickLogo,
  onBack,
  onComplete,
  submitting = false,
}: InvoiceProfileFieldsProps) {
  const [sub, setSub] = useState(0);
  const last = SUB_STEPS.length - 1;
  const goBack = () => (sub === 0 ? onBack() : setSub((s) => s - 1));

  return (
    <div className="space-y-6">
      {/* Progress + per-step heading */}
      <div>
        <div className="flex gap-1.5">
          {SUB_STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= sub ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
          Invoice · Step {sub + 1} of {SUB_STEPS.length}
        </p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight text-foreground">{SUB_STEPS[sub].title}</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{SUB_STEPS[sub].subtitle}</p>
      </div>

      {/* ── Step 1 · Business identity + contact ─────────────────────────── */}
      {sub === 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Legal business name" htmlFor="invoiceLegalName" full>
            <input id="invoiceLegalName" className={field} autoComplete="organization" value={profile.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder="Olyxee Logistics (Pty) Ltd" />
          </Field>
          <Field label="Accounts email" htmlFor="invoice-email">
            <input id="invoice-email" className={field} type="email" autoComplete="email" value={profile.email} onChange={(e) => update("email", e.target.value)} placeholder="accounts@company.com" />
          </Field>
          <Field label="Business phone" htmlFor="invoice-phone">
            <input id="invoice-phone" className={field} type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+27 11 000 0000" />
          </Field>
          <Field label="Company registration number" htmlFor="invoice-registrationNumber">
            <input id="invoice-registrationNumber" className={field} value={profile.registrationNumber} onChange={(e) => update("registrationNumber", e.target.value)} placeholder="2026/123456/07" />
          </Field>
          <Field label="VAT / tax number" htmlFor="invoice-taxNumber">
            <input id="invoice-taxNumber" className={field} value={profile.taxNumber} onChange={(e) => update("taxNumber", e.target.value)} placeholder="4123456789" />
          </Field>
        </div>
      )}

      {/* ── Step 2 · Address ─────────────────────────────────────────────── */}
      {sub === 1 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Street address" htmlFor="invoiceStreet" full>
            <input id="invoiceStreet" className={field} autoComplete="street-address" value={profile.streetAddress} onChange={(e) => update("streetAddress", e.target.value)} placeholder="12 Marshall Street" />
          </Field>
          <Field label="City" htmlFor="invoice-city">
            <input id="invoice-city" className={field} list="sa-city-suggestions" autoComplete="address-level2" value={profile.city} onChange={(e) => update("city", e.target.value)} placeholder="Johannesburg" />
            <datalist id="sa-city-suggestions">{SOUTH_AFRICAN_CITIES.map((city) => <option key={city} value={city} />)}</datalist>
          </Field>
          <Field label="Postal code" htmlFor="invoice-postalCode">
            <input id="invoice-postalCode" className={field} inputMode="numeric" autoComplete="postal-code" value={profile.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="2001" />
          </Field>
          <Field label="Province" htmlFor="invoice-province">
            <select id="invoice-province" className={field} autoComplete="address-level1" value={profile.province} onChange={(e) => update("province", e.target.value)}>
              <option value="">Select province</option>
              {profile.province && !SOUTH_AFRICAN_PROVINCES.includes(profile.province) ? <option value={profile.province}>{profile.province}</option> : null}
              {SOUTH_AFRICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
            </select>
          </Field>
          <Field label="Country" htmlFor="invoice-country">
            <select id="invoice-country" className={field} autoComplete="country-name" value={profile.country} onChange={(e) => update("country", e.target.value)}>
              <option value="South Africa">South Africa</option>
              {profile.country && profile.country !== "South Africa" ? <option value={profile.country}>{profile.country}</option> : null}
            </select>
          </Field>
        </div>
      )}

      {/* ── Step 3 · Bank details ────────────────────────────────────────── */}
      {sub === 2 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bank" htmlFor="payment-bank">
            <select id="payment-bank" className={field} value={profile.bank} onChange={(e) => update("bank", e.target.value)}>
              <option value="">Select a South African bank</option>
              {profile.bank && !SOUTH_AFRICAN_BANKS.includes(profile.bank) ? <option value={profile.bank}>{profile.bank}</option> : null}
              {SOUTH_AFRICAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
            </select>
          </Field>
          <Field label="Account type" htmlFor="payment-accountType">
            <select id="payment-accountType" className={field} value={profile.accountType} onChange={(e) => update("accountType", e.target.value)}>
              <option value="">Select account type</option>
              {profile.accountType && !BANK_ACCOUNT_TYPES.includes(profile.accountType) ? <option value={profile.accountType}>{profile.accountType}</option> : null}
              {BANK_ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </Field>
          <Field label="Account name" htmlFor="payment-accountName" full>
            <input id="payment-accountName" className={field} autoComplete="organization" value={profile.accountName} onChange={(e) => update("accountName", e.target.value)} placeholder="Business account name" />
          </Field>
          <Field label="Account number" htmlFor="payment-accountNumber">
            <input id="payment-accountNumber" className={field} inputMode="numeric" autoComplete="off" value={profile.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} placeholder="123456789" />
          </Field>
          <Field label="Branch code" htmlFor="payment-branchCode">
            <input id="payment-branchCode" className={field} inputMode="numeric" autoComplete="off" value={profile.branchCode} onChange={(e) => update("branchCode", e.target.value)} placeholder="250655" />
          </Field>
          <Field label="Additional payment instructions" htmlFor="paymentExtra" full>
            <textarea id="paymentExtra" className={`${field} h-auto py-2.5`} rows={2} value={profile.paymentExtra} onChange={(e) => update("paymentExtra", e.target.value)} placeholder="Optional SWIFT code or payment note" />
          </Field>
        </div>
      )}

      {/* ── Step 4 · Branding & terms ────────────────────────────────────── */}
      {sub === 3 && (
        <div className="space-y-5">
          <Field label="Invoice logo" hint="PNG or JPEG. Your legal name is used if no logo is uploaded.">
            <LogoUpload value={profile.logoUrl} businessName={profile.legalName} onFile={pickLogo} onRemove={() => update("logoUrl", "")} />
          </Field>
          <div>
            <span className={labelCls}>Payment due</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([
                ["Payment due on receipt.", "On receipt"],
                ["Payment due within 7 days.", "7 days"],
                ["Payment due within 14 days.", "14 days"],
                ["Payment due within 30 days.", "30 days"],
              ] as const).map(([term, label]) => (
                <Button key={term} type="button" size="sm" className="h-10 rounded-xl" variant={profile.paymentTerms === term ? "default" : "outline"} onClick={() => update("paymentTerms", term)}>{label}</Button>
              ))}
            </div>
            <Field label="Message shown on invoice" htmlFor="paymentTerms">
              <input id="paymentTerms" className={`${field} mt-1.5`} value={profile.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} />
            </Field>
          </div>
          <Field label="Footer note" htmlFor="invoiceFooter">
            <textarea id="invoiceFooter" className={`${field} h-auto py-2.5`} rows={2} value={profile.footerNote} onChange={(e) => update("footerNote", e.target.value)} placeholder="Thank you for your business." />
          </Field>
        </div>
      )}

      {/* Footer nav */}
      <div className="flex items-center gap-2.5 pt-1">
        <Button type="button" variant="outline" className="h-11 px-5 text-[15px] font-medium" onClick={goBack}>
          Back
        </Button>
        {sub < last ? (
          <Button type="button" className="h-11 flex-1 text-[15px] font-medium" onClick={() => setSub((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button type="button" disabled={submitting} className="h-11 flex-1 text-[15px] font-medium" onClick={onComplete} data-testid="button-finish">
            {submitting ? "Saving…" : "Finish setup"}
          </Button>
        )}
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={onComplete}
        className="mx-auto block text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        data-testid="button-skip-invoice"
      >
        Skip for now - I’ll add this later in Settings
      </button>
    </div>
  );
}
