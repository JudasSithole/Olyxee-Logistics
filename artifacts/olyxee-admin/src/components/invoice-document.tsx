// The real, branded A4 invoice document. Shared by the full invoice page and the
// Finance quick-view popup so both show the identical customer-facing invoice.
// Includes the print stylesheet so window.print() prints ONLY this document,
// wherever it's mounted (full page or inside a dialog).

// Loose `any` shape: the invoice comes straight from GET /api/invoices/:id, which
// spreads the invoice row plus { order, customer, business }.
export function InvoiceDocument({ invoice }: { invoice: any }) {
  const order = invoice.order;
  const customer = invoice.customer;
  const business = invoice.business;
  const brandColor = /^#[0-9a-f]{6}$/i.test(business?.primaryBrandColour || "") ? business.primaryBrandColour : "#10243e";
  const money = (value: string | number) =>
    `${invoice.currency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayStatus = invoice.status === "sent" ? "Pending payment" : invoice.status === "paid" ? "Paid" : invoice.status === "draft" ? "Draft" : String(invoice.status).replaceAll("_", " ").replace(/\b\w/, (c: string) => c.toUpperCase());
  const statusStyle = invoice.status === "paid" ? "bg-emerald-50 text-emerald-700" : invoice.status === "sent" ? "bg-amber-50 text-amber-700" : invoice.status === "overdue" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";
  const issueDate = new Date(invoice.createdAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "On receipt";
  const jobNumber = order?.jobNumber || order?.orderReference || "-";
  const transportLabel = order?.transportMode ? `${String(order.transportMode).charAt(0)}${String(order.transportMode).slice(1).toLowerCase()} freight` : "";
  const chargeDescription = [transportLabel || "Logistics service", order?.cargoType || order?.description, order?.weight].filter(Boolean).join(" · ");

  return (
    <>
      <style>{`@media print {
        @page { size: A4 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        .invoice-document, .invoice-document * { visibility: visible !important; }
        .invoice-document { position: fixed !important; inset: 0 !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; box-sizing: border-box !important; overflow: hidden !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }`}</style>

      <article className="invoice-document relative mx-auto flex min-h-[1120px] w-full max-w-[794px] flex-col overflow-hidden bg-white px-[64px] pb-[48px] pt-[60px] text-[13.5px] leading-[1.5] text-[#1d2733] shadow-xl print:min-h-0 print:max-w-none print:px-[18mm] print:py-[16mm] print:shadow-none">
        <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: brandColor }} />

        <header className="flex items-start justify-between gap-8">
          <div className="max-w-[330px]">
            {(business?.businessLogoUrl || business?.invoiceLogoUrl) ? <img src={business.businessLogoUrl || business.invoiceLogoUrl} alt={`${business.invoiceLegalName || business.name} logo`} className="mb-4 max-h-[44px] object-contain object-left" /> : null}
            <h1 className="text-[20px] font-semibold tracking-[-0.01em]">{business?.invoiceLegalName || business?.name || "Business"}</h1>
            <div className="mt-2 space-y-0.5 text-[12px] text-slate-500">
              {business?.invoiceRegistrationNumber ? <p>Reg No. {business.invoiceRegistrationNumber}</p> : null}
              {business?.invoiceTaxNumber ? <p>Tax No. {business.invoiceTaxNumber}</p> : null}
              <p>{business?.invoiceEmail || business?.supportEmail}</p>
              {(business?.invoicePhone || business?.phone) ? <p>{business.invoicePhone || business.phone}</p> : null}
              {(business?.invoiceAddress || business?.location) ? <p className="whitespace-pre-line">{business.invoiceAddress || business.location}</p> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[26px] font-semibold tracking-[-0.01em]" style={{ color: brandColor }}>Invoice</p>
            <p className="mt-1 font-mono text-[13px] text-slate-600">{invoice.invoiceNumber}</p>
            <span className={`mt-3 inline-block rounded-full px-3 py-1 text-[11px] font-semibold ${statusStyle}`}>{displayStatus}</span>
          </div>
        </header>

        <section className="mt-9 grid grid-cols-[1.35fr_1fr] border border-slate-200">
          <div className="border-r border-slate-200 p-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Billed to</p>
            <p className="mt-1.5 text-[15px] font-semibold">{customer?.fullName}</p>
            {customer?.companyName ? <p className="text-slate-500">{customer.companyName}</p> : null}
            <p className="mt-1 whitespace-pre-line text-[12px] text-slate-500">{customer?.address || "Address not supplied"}</p>
            <p className="mt-0.5 text-[12px] text-slate-500">{customer?.email}</p>
            {customer?.phone ? <p className="text-[12px] text-slate-500">{customer.phone}</p> : null}
          </div>
          <div className="divide-y divide-slate-200">
            {([['Invoice number', invoice.invoiceNumber], ['Issue date', issueDate], ['Due date', dueDate], ['Job reference', jobNumber]] as [string, string][]).map(([label, value]) => (
              <div key={label} className="grid grid-cols-[112px_1fr] px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
                <p className={`text-right text-[12px] font-medium text-slate-700 ${label === 'Invoice number' ? 'font-mono' : ''}`}>{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Shipment reference</p>
          <table className="w-full border-collapse border border-slate-200 text-[12px]">
            <tbody>
              <tr className="border-b border-slate-200">
                <th className="w-[18%] bg-slate-50 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-400">Cargo</th>
                <td className="w-[32%] px-3 py-2.5 font-medium text-slate-700">{order?.cargoType || order?.description || "-"}</td>
                <th className="w-[18%] border-l border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-400">Transport</th>
                <td className="w-[32%] px-3 py-2.5 font-medium text-slate-700">{transportLabel || "-"}</td>
              </tr>
              <tr>
                <th className="bg-slate-50 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-400">Origin</th>
                <td className="px-3 py-2.5 font-medium text-slate-700">{order?.origin || "-"}</td>
                <th className="border-l border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-slate-400">Destination</th>
                <td className="px-3 py-2.5 font-medium text-slate-700">{order?.destination || "-"}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="mt-8">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Invoice items</p>
          <table className="w-full border-collapse border border-slate-200">
            <thead style={{ backgroundColor: brandColor }}><tr className="text-[10px] uppercase tracking-wide text-white"><th className="px-3 py-3 text-left font-medium">Description</th><th className="w-[70px] px-3 py-3 text-center font-medium">Qty</th><th className="w-[125px] px-3 py-3 text-right font-medium">Rate</th><th className="w-[125px] px-3 py-3 text-right font-medium">Amount</th></tr></thead>
            <tbody>
              <tr className="border-b border-slate-200"><td className="px-3 py-4 font-medium">{chargeDescription}</td><td className="px-3 py-4 text-center text-slate-600">1</td><td className="px-3 py-4 text-right text-slate-600">{money(invoice.subtotal)}</td><td className="px-3 py-4 text-right font-medium">{money(invoice.subtotal)}</td></tr>
              {Number(invoice.additionalCharges) > 0 ? <tr><td className="px-3 py-3 text-slate-600">Additional charges</td><td className="px-3 py-3 text-center text-slate-600">1</td><td className="px-3 py-3 text-right text-slate-600">{money(invoice.additionalCharges)}</td><td className="px-3 py-3 text-right font-medium">{money(invoice.additionalCharges)}</td></tr> : null}
            </tbody>
          </table>
          <div className="ml-auto w-[330px] border-x border-b border-slate-200">
            <div className="flex justify-between border-b border-slate-200 px-4 py-2.5 text-[12px]"><span className="text-slate-500">Subtotal</span><span className="font-medium">{money(invoice.subtotal)}</span></div>
            {Number(invoice.additionalCharges) > 0 ? <div className="flex justify-between border-b border-slate-200 px-4 py-2.5 text-[12px]"><span className="text-slate-500">Additional charges</span><span className="font-medium">{money(invoice.additionalCharges)}</span></div> : null}
            <div className="flex justify-between border-b border-slate-200 px-4 py-2.5 text-[12px]"><span className="text-slate-500">VAT</span><span className="font-medium">Not separately charged</span></div>
            <div className="flex items-center justify-between px-4 py-3.5" style={{ color: brandColor }}><span className="text-[13px] font-semibold uppercase tracking-wide">Total due</span><span className="text-[20px] font-bold">{money(invoice.total)}</span></div>
          </div>
        </section>

        <section className="mt-8 border border-slate-200 bg-slate-50 p-5">
          <div className="flex items-start justify-between gap-8">
            <div className="max-w-[320px]">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">How to pay</p>
              <div className="mt-2 whitespace-pre-line text-[13px] leading-relaxed">{business?.invoicePaymentDetails || "Contact the issuer for payment instructions."}</div>
            </div>
            <div className="min-w-[190px] space-y-4 border-l border-slate-200 pl-6">
              <div><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Payment reference</p><p className="mt-1 font-mono text-[13px] font-medium">{invoice.invoiceNumber}</p></div>
              <div><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Terms</p><p className="mt-1 text-[12px] text-slate-600">{business?.invoicePaymentTerms || "Payment due on receipt."}</p></div>
            </div>
          </div>
        </section>

        <div className="mt-auto" />
        {business?.invoiceFooterNote ? <p className="pt-8 text-center text-[11px] text-slate-400">{business.invoiceFooterNote}</p> : null}
        <footer className="mt-6 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">{business?.invoiceLegalName || business?.name} · {business?.invoiceEmail || business?.supportEmail}</footer>
      </article>
    </>
  );
}
