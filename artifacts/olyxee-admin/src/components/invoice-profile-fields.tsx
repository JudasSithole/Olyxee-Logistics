import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

// Presentational invoice-profile form body (the two-column grid). The parent
// owns the surrounding <form>, submit button, and page chrome.
export function InvoiceProfileFields({
  profile,
  update,
  pickLogo,
  required = true,
  showReadiness = true,
}: InvoiceProfileFieldsProps) {
  const req = required || undefined;
  const ready = invoiceReadyCount(profile);
  return (
    <div className="grid items-start gap-5 p-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="space-y-5">
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-semibold">Issuing business</legend>
          <div className="mb-4 rounded-xl bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
            We’ve filled what we can from your business account. Review the details below and complete only what is missing.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="invoiceLegalName">Legal business name {required ? "*" : ""}</Label>
              <Input id="invoiceLegalName" autoComplete="organization" value={profile.legalName} onChange={(e) => update("legalName", e.target.value)} placeholder="Olyxee Logistics (Pty) Ltd" required={req} />
            </div>
            {([
              ["registrationNumber", "Company registration number", "2026/123456/07"],
              ["taxNumber", "VAT / tax number", "4123456789"],
              ["email", "Accounts email", "accounts@company.com"],
              ["phone", "Business phone", "+27 11 000 0000"],
            ] as const).map(([key, label, placeholder]) => (
              <div className="space-y-1.5" key={key}>
                <Label htmlFor={`invoice-${key}`}>{label}</Label>
                <Input id={`invoice-${key}`} autoComplete={key === "email" ? "email" : key === "phone" ? "tel" : "off"} type={key === "email" ? "email" : key === "phone" ? "tel" : "text"} value={profile[key]} onChange={(e) => update(key, e.target.value)} placeholder={placeholder} />
              </div>
            ))}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="invoiceStreet">Street address {required ? "*" : ""}</Label>
              <Input id="invoiceStreet" autoComplete="street-address" value={profile.streetAddress} onChange={(e) => update("streetAddress", e.target.value)} placeholder="Start typing your street address" required={req} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-city">City {required ? "*" : ""}</Label>
              <Input id="invoice-city" list="sa-city-suggestions" autoComplete="address-level2" value={profile.city} onChange={(e) => update("city", e.target.value)} placeholder="Start typing a city" required={req} />
              <datalist id="sa-city-suggestions">{SOUTH_AFRICAN_CITIES.map((city) => <option key={city} value={city} />)}</datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-province">Province</Label>
              <select id="invoice-province" autoComplete="address-level1" value={profile.province} onChange={(e) => update("province", e.target.value)}>
                <option value="">Select province</option>
                {profile.province && !SOUTH_AFRICAN_PROVINCES.includes(profile.province) ? <option value={profile.province}>{profile.province}</option> : null}
                {SOUTH_AFRICAN_PROVINCES.map((province) => <option key={province} value={province}>{province}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-postalCode">Postal code</Label>
              <Input id="invoice-postalCode" inputMode="numeric" autoComplete="postal-code" value={profile.postalCode} onChange={(e) => update("postalCode", e.target.value)} placeholder="2001" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-country">Country {required ? "*" : ""}</Label>
              <select id="invoice-country" autoComplete="country-name" value={profile.country} onChange={(e) => update("country", e.target.value)} required={req}>
                <option value="South Africa">South Africa</option>
                {profile.country && profile.country !== "South Africa" ? <option value={profile.country}>{profile.country}</option> : null}
              </select>
            </div>
          </div>
        </fieldset>
        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-2 text-sm font-semibold">Bank details</legend>
          <p className="mb-4 text-xs text-muted-foreground">Customers use these details to pay. The invoice number is added automatically as the payment reference.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="payment-bank">Bank {required ? "*" : ""}</Label>
              <select id="payment-bank" value={profile.bank} onChange={(e) => update("bank", e.target.value)} required={req}>
                <option value="">Select a South African bank</option>
                {profile.bank && !SOUTH_AFRICAN_BANKS.includes(profile.bank) ? <option value={profile.bank}>{profile.bank}</option> : null}
                {SOUTH_AFRICAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-accountType">Account type</Label>
              <select id="payment-accountType" value={profile.accountType} onChange={(e) => update("accountType", e.target.value)}>
                <option value="">Select account type</option>
                {profile.accountType && !BANK_ACCOUNT_TYPES.includes(profile.accountType) ? <option value={profile.accountType}>{profile.accountType}</option> : null}
                {BANK_ACCOUNT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-accountName">Account name {required ? "*" : ""}</Label>
              <Input id="payment-accountName" autoComplete="organization" value={profile.accountName} onChange={(e) => update("accountName", e.target.value)} placeholder="Business account name" required={req} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-accountNumber">Account number {required ? "*" : ""}</Label>
              <Input id="payment-accountNumber" inputMode="numeric" autoComplete="off" value={profile.accountNumber} onChange={(e) => update("accountNumber", e.target.value)} placeholder="123456789" required={req} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-branchCode">Branch code</Label>
              <Input id="payment-branchCode" inputMode="numeric" autoComplete="off" value={profile.branchCode} onChange={(e) => update("branchCode", e.target.value)} placeholder="250655" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="paymentExtra">Additional payment instructions</Label>
              <Textarea id="paymentExtra" rows={2} value={profile.paymentExtra} onChange={(e) => update("paymentExtra", e.target.value)} placeholder="Optional SWIFT code or payment note" />
            </div>
          </div>
        </fieldset>
      </div>
      <div className="space-y-5 lg:sticky lg:top-5">
        {showReadiness ? (
          <div className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Invoice readiness</p>
                <p className="text-xs text-muted-foreground">{ready} of 8 essentials completed</p>
              </div>
              <span className="text-lg font-bold text-primary">{Math.round((ready / 8) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(ready / 8) * 100}%` }} /></div>
          </div>
        ) : null}
        <div className="rounded-xl border border-border p-4">
          <Label>Invoice logo</Label>
          <div className="mt-2"><LogoUpload value={profile.logoUrl} businessName={profile.legalName} onFile={pickLogo} onRemove={() => update("logoUrl", "")} /></div>
          <p className="mt-2 text-xs text-muted-foreground">PNG or JPEG. The legal name is used if no logo is uploaded.</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm font-semibold">When is payment due?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {([
              ["Payment due on receipt.", "Due now"],
              ["Payment due within 7 days.", "7 days"],
              ["Payment due within 14 days.", "14 days"],
              ["Payment due within 30 days.", "30 days"],
            ] as const).map(([term, label]) => (
              <Button key={term} type="button" size="sm" variant={profile.paymentTerms === term ? "default" : "outline"} onClick={() => update("paymentTerms", term)}>{label}</Button>
            ))}
          </div>
          <Label htmlFor="paymentTerms" className="mt-4 block">Message shown on invoice</Label>
          <Input id="paymentTerms" className="mt-1.5" value={profile.paymentTerms} onChange={(e) => update("paymentTerms", e.target.value)} />
        </div>
        <div className="rounded-xl border border-border p-4">
          <Label htmlFor="invoiceFooter">Footer note</Label>
          <Textarea id="invoiceFooter" className="mt-1.5" rows={3} value={profile.footerNote} onChange={(e) => update("footerNote", e.target.value)} placeholder="Thank you for your business." />
        </div>
      </div>
    </div>
  );
}
