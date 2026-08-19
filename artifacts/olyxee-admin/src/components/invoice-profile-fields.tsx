import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { LogoUpload } from "@/components/logo-upload";
import {
  BANK_ACCOUNT_TYPES,
  SOUTH_AFRICAN_BANKS,
  SOUTH_AFRICAN_CITIES,
  SOUTH_AFRICAN_PROVINCES,
  invoiceReadyCount,
  type InvoiceProfile,
} from "@/lib/invoice-profile";

interface InvoiceProfileFieldsProps {
  profile: InvoiceProfile;
  update: (key: keyof InvoiceProfile, value: string) => void;
  pickLogo: (file: File) => void;
  // When false, the individual inputs are not HTML-`required`, so the parent
  // form can be submitted (or skipped) with the invoice section left blank.
  // Settings keeps them required; onboarding makes them optional.
  required?: boolean;
  showReadiness?: boolean;
}

// Shared, soft-fill control styling so every input, select and textarea reads as
// one calm system (matches the create-Job wizard). Selects keep their native
// arrow; only colours/shape are themed.
const field =
  "h-11 w-full rounded-xl border border-border bg-muted/40 px-3.5 text-[15px] text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-foreground/25 focus:bg-background focus:ring-2 focus:ring-ring/40";
const labelCls = "mb-1.5 block text-[13px] font-medium text-foreground";
const headerCls = "text-[13px] font-semibold uppercase tracking-wider text-muted-foreground";

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

// The invoice-profile form body. The parent owns the surrounding <form>, submit
// button, and page chrome. Kept short by design: only the handful of fields
// needed to actually send an invoice are shown up front; everything else
// (registration, VAT, logo, terms, footer…) lives behind one "more details"
// toggle so an optional step never feels endless.
export function InvoiceProfileFields({
  profile,
  update,
  pickLogo,
  required = true,
  showReadiness = true,
}: InvoiceProfileFieldsProps) {
  const req = required || undefined;
  const star = required ? " *" : "";
  const ready = invoiceReadyCount(profile);
  const pct = Math.round((ready / 8) * 100);
  // Expanded by default only where the fields are mandatory (Settings); on the
  // optional onboarding step it starts collapsed so the form stays short.
  const [showMore, setShowMore] = useState(required);

  return (
    <div className="space-y-6 p-5 sm:p-6">
      {showReadiness ? (
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[13px]">
            <span className="font-medium text-foreground">Invoice readiness</span>
            <span className="text-muted-foreground">{ready} of 8 essentials · {pct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Just the essentials to send an invoice — prefilled from your account where we could. Everything else is optional.
        </p>
      )}

      {/* ── Essentials: business identity + address ──────────────────────── */}
      <section className="space-y-4">
        <h3 className={headerCls}>Your business</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Legal business name${star}`} htmlFor="invoiceLegalName" full>
            <input id="invoiceLegalName" className={field} autoComplete="organization" value={profile.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder="Olyxee Logistics (Pty) Ltd" required={req} />
          </Field>
          <Field label="Accounts email" htmlFor="invoice-email">
            <input id="invoice-email" className={field} type="email" autoComplete="email" value={profile.email} onChange={(e) => update("email", e.target.value)} placeholder="accounts@company.com" />
          </Field>
          <Field label="Business phone" htmlFor="invoice-phone">
            <input id="invoice-phone" className={field} type="tel" autoComplete="tel" value={profile.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+27 11 000 0000" />
          </Field>
          <Field label={`Street address${star}`} htmlFor="invoiceStreet" full>
            <input id="invoiceStreet" className={field} autoComplete="street-address" value={profile.streetAddress} onChange={(e) => update("streetAddress", e.target.value)} placeholder="12 Marshall Street" required={req} />
          </Field>
          <Field label={`City${star}`} htmlFor="invoice-city">
            <input id="invoice-city" className={field} list="sa-city-suggestions" autoComplete="address-level2" value={profile.city} onChange={(e) => update("city", e.target.value)} placeholder="Johannesburg" required={req} />
            <datalist id="sa-city-suggestions">{SOUTH_AFRICAN_CITIES.map((city) => <option key={city} value={city} />)}</datalist>
          </Field>
          <Field label="Postal code" htmlFor="invoice-postalCode">
            <input id="invoice-postalCode" className={field} inputMode="numeric" autoComplete="postal-code" value={profile.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="2001" />
          </Field>
        </div>
      </section>

      {/* ── Essentials: how customers pay ────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className={headerCls}>Bank details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Bank${star}`} htmlFor="payment-bank">
            <select id="payment-bank" className={field} value={profile.bank} onChange={(e) => update("bank", e.target.value)} required={req}>
              <option value="">Select a South African bank</option>
              {profile.bank && !SOUTH_AFRICAN_BANKS.includes(profile.bank) ? <option value={profile.bank}>{profile.bank}</option> : null}
              {SOUTH_AFRICAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
            </select>
          </Field>
          <Field label={`Account number${star}`} htmlFor="payment-accountNumber">
            <input id="payment-accountNumber" className={field} inputMode="numeric" autoComplete="off" value={profile.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} placeholder="123456789" required={req} />
          </Field>
          <Field label={`Account name${star}`} htmlFor="payment-accountName" full>
            <input id="payment-accountName" className={field} autoComplete="organization" value={profile.accountName} onChange={(e) => update("accountName", e.target.value)} placeholder="Business account name" required={req} />
          </Field>
        </div>
      </section>

      {/* ── Everything else, behind one toggle ───────────────────────────── */}
      {!showMore ? (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="w-full rounded-xl border border-dashed border-border py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          data-testid="button-more-invoice-details"
        >
          + Add registration, VAT, logo &amp; terms (optional)
        </button>
      ) : (
        <div className="space-y-6">
          <section className="space-y-4">
            <h3 className={headerCls}>Registration &amp; address</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company registration number" htmlFor="invoice-registrationNumber">
                <input id="invoice-registrationNumber" className={field} value={profile.registrationNumber} onChange={(e) => update("registrationNumber", e.target.value)} placeholder="2026/123456/07" />
              </Field>
              <Field label="VAT / tax number" htmlFor="invoice-taxNumber">
                <input id="invoice-taxNumber" className={field} value={profile.taxNumber} onChange={(e) => update("taxNumber", e.target.value)} placeholder="4123456789" />
              </Field>
              <Field label="Province" htmlFor="invoice-province">
                <select id="invoice-province" className={field} autoComplete="address-level1" value={profile.province} onChange={(e) => update("province", e.target.value)}>
                  <option value="">Select province</option>
                  {profile.province && !SOUTH_AFRICAN_PROVINCES.includes(profile.province) ? <option value={profile.province}>{profile.province}</option> : null}
                  {SOUTH_AFRICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
                </select>
              </Field>
              <Field label={`Country${star}`} htmlFor="invoice-country">
                <select id="invoice-country" className={field} autoComplete="country-name" value={profile.country} onChange={(e) => update("country", e.target.value)} required={req}>
                  <option value="South Africa">South Africa</option>
                  {profile.country && profile.country !== "South Africa" ? <option value={profile.country}>{profile.country}</option> : null}
                </select>
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className={headerCls}>More bank details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Account type" htmlFor="payment-accountType">
                <select id="payment-accountType" className={field} value={profile.accountType} onChange={(e) => update("accountType", e.target.value)}>
                  <option value="">Select account type</option>
                  {profile.accountType && !BANK_ACCOUNT_TYPES.includes(profile.accountType) ? <option value={profile.accountType}>{profile.accountType}</option> : null}
                  {BANK_ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </Field>
              <Field label="Branch code" htmlFor="payment-branchCode">
                <input id="payment-branchCode" className={field} inputMode="numeric" autoComplete="off" value={profile.branchCode} onChange={(e) => update("branchCode", e.target.value)} placeholder="250655" />
              </Field>
              <Field label="Additional payment instructions" htmlFor="paymentExtra" full>
                <textarea id="paymentExtra" className={`${field} h-auto py-2.5`} rows={2} value={profile.paymentExtra} onChange={(e) => update("paymentExtra", e.target.value)} placeholder="Optional SWIFT code or payment note" />
              </Field>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className={headerCls}>Look &amp; terms</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Invoice logo" hint="PNG or JPEG. Your legal name is used if no logo is uploaded.">
                <LogoUpload value={profile.logoUrl} businessName={profile.legalName} onFile={pickLogo} onRemove={() => update("logoUrl", "")} />
              </Field>
              <div>
                <span className={labelCls}>Payment due</span>
                <div className="grid grid-cols-2 gap-2">
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
            </div>
            <Field label="Footer note" htmlFor="invoiceFooter">
              <textarea id="invoiceFooter" className={`${field} h-auto py-2.5`} rows={2} value={profile.footerNote} onChange={(e) => update("footerNote", e.target.value)} placeholder="Thank you for your business." />
            </Field>
          </section>
        </div>
      )}
    </div>
  );
}
