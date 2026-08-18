import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const [, navigate] = useLocation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["invoice", id], queryFn: () => apiFetch<any>(`/api/invoices/${id}`) });
  const [editOpen,setEditOpen]=useState(false);const [editForm,setEditForm]=useState({subtotal:"",additionalCharges:"",dueDate:"",notes:""});
  const action = useMutation({
    mutationFn: (name: string) => apiFetch(`/api/invoices/${id}/${name}`, { method: "POST" }),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      // After confirming payment, jump straight to the Job so the admin can
      // carry on with the shipment (which just unlocked for prepaid Jobs).
      if (name === "pay") {
        toast.success("Payment confirmed — opening the Job");
        const orderId = query.data?.orderId;
        if (orderId) navigate(`/orders/${orderId}`);
      } else {
        toast.success("Invoice updated");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteInvoice = useMutation({ mutationFn: () => apiFetch(`/api/invoices/${id}`, { method: "DELETE" }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice deleted"); navigate("/invoices"); }, onError: (error: Error) => toast.error(error.message) });
  const editInvoice=useMutation({mutationFn:()=>apiFetch(`/api/invoices/${id}`,{method:"PUT",body:{...editForm,dueDate:editForm.dueDate||null}}),onSuccess:()=>{toast.success("Invoice updated");setEditOpen(false);query.refetch();},onError:(error:Error)=>toast.error(error.message)});
  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-52"/><Skeleton className="h-[700px] w-full"/></div>;
  if (!query.data) return <p>Invoice not found.</p>;
  const invoice = query.data;
  const order = invoice.order;
  const customer = invoice.customer;
  const business = invoice.business;
  const brandColor = /^#[0-9a-f]{6}$/i.test(business?.primaryBrandColour || "") ? business.primaryBrandColour : "#10243e";
  // Group thousands so large amounts read cleanly (e.g. ZAR 1,500,000.00
  // instead of ZAR 1500000.00). Non-breaking space keeps the currency and
  // number on the same line.
  const money = (value: string | number) =>
    `${invoice.currency} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const displayStatus = invoice.status === "sent" ? "Pending payment" : invoice.status === "paid" ? "Paid" : invoice.status === "draft" ? "Draft" : String(invoice.status).replaceAll("_", " ").replace(/\b\w/, (c) => c.toUpperCase());
  const statusStyle = invoice.status === "paid" ? "bg-emerald-50 text-emerald-700" : invoice.status === "sent" ? "bg-amber-50 text-amber-700" : invoice.status === "overdue" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";
  const issueDate = new Date(invoice.createdAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "On receipt";
  const jobNumber = order?.jobNumber || order?.orderReference || "—";
  const transportLabel = order?.transportMode ? `${String(order.transportMode).charAt(0)}${String(order.transportMode).slice(1).toLowerCase()} freight` : "";
  const chargeDescription = [transportLabel || "Logistics service", order?.cargoType || order?.description, order?.weight].filter(Boolean).join(" · ");
  const openEdit=()=>{setEditForm({subtotal:String(invoice.subtotal),additionalCharges:String(invoice.additionalCharges),dueDate:invoice.dueDate?String(invoice.dueDate).slice(0,10):"",notes:invoice.notes??""});setEditOpen(true);};

  return <div className="mx-auto max-w-4xl space-y-5">
    <style>{`@media print {
      @page { size: A4 portrait; margin: 0; }
      body * { visibility: hidden !important; }
      .invoice-document, .invoice-document * { visibility: visible !important; }
      .invoice-document { position: fixed !important; inset: 0 !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; box-sizing: border-box !important; overflow: hidden !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }`}</style>
    <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
      <Link href={`/orders/${invoice.orderId}`}><Button variant="ghost">← Job</Button></Link>
      <div className="flex gap-2">
        {invoice.status !== "paid" ? <Button variant="outline" onClick={openEdit}>Edit invoice</Button> : null}
        {invoice.status !== "paid" ? <Button variant="destructive" disabled={deleteInvoice.isPending} onClick={() => { if (window.confirm(`Permanently delete invoice ${invoice.invoiceNumber}? The order will remain.`)) deleteInvoice.mutate(); }}>Delete invoice</Button> : null}
        {invoice.status === "draft" ? <Button disabled={action.isPending} onClick={() => action.mutate("send")}>Send invoice</Button> : null}
        {invoice.status === "sent" ? <Button disabled={action.isPending} onClick={() => action.mutate("pay")}>Confirm payment manually</Button> : null}
        <Button variant="outline" onClick={() => window.print()}>Download / print</Button>
      </div>
    </div>
    <Sheet open={editOpen} onOpenChange={setEditOpen}><SheetContent className="w-[400px]"><SheetHeader><SheetTitle>Edit invoice</SheetTitle></SheetHeader><form className="mt-6 space-y-4" onSubmit={e=>{e.preventDefault();editInvoice.mutate();}}><div className="space-y-2"><Label>Subtotal</Label><Input type="number" min="0" step="0.01" value={editForm.subtotal} onChange={e=>setEditForm(f=>({...f,subtotal:e.target.value}))}/></div><div className="space-y-2"><Label>Additional charges</Label><Input type="number" min="0" step="0.01" value={editForm.additionalCharges} onChange={e=>setEditForm(f=>({...f,additionalCharges:e.target.value}))}/></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={editForm.dueDate} onChange={e=>setEditForm(f=>({...f,dueDate:e.target.value}))}/></div><div className="space-y-2"><Label>Notes</Label><Input value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div><Button className="w-full" disabled={editInvoice.isPending}>{editInvoice.isPending?'Saving...':'Save invoice changes'}</Button></form></SheetContent></Sheet>

    <article className="invoice-document relative mx-auto flex min-h-[1120px] w-full max-w-[794px] flex-col overflow-hidden bg-white px-[64px] pb-[48px] pt-[60px] text-[13.5px] leading-[1.5] text-[#1d2733] shadow-xl print:min-h-0 print:max-w-none print:px-[18mm] print:py-[16mm] print:shadow-none">
      <div className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: brandColor }} />

      <header className="flex items-start justify-between gap-8">
        <div className="max-w-[330px]">
          {(business?.invoiceLogoUrl || business?.businessLogoUrl) ? <img src={business.invoiceLogoUrl || business.businessLogoUrl} alt={`${business.invoiceLegalName || business.name} logo`} className="mb-4 max-h-[44px] object-contain object-left" /> : null}
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

      <section className="mt-9 grid grid-cols-[1.5fr_1fr_1fr] gap-6 border-t border-slate-100 pt-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Billed to</p>
          <p className="mt-1.5 text-[15px] font-semibold">{customer?.fullName}</p>
          {customer?.companyName ? <p className="text-slate-500">{customer.companyName}</p> : null}
          <p className="mt-1 whitespace-pre-line text-[12px] text-slate-500">{customer?.address || "Address not supplied"}</p>
          <p className="mt-0.5 text-[12px] text-slate-500">{customer?.email}</p>
          {customer?.phone ? <p className="text-[12px] text-slate-500">{customer.phone}</p> : null}
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Issued</p>
          <p className="mt-1.5 font-medium">{issueDate}</p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Due</p>
          <p className="mt-1.5 font-medium">{dueDate}</p>
        </div>
      </section>

      <section className="mt-8">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-slate-400">Shipment</p>
        <div className="grid grid-cols-4 gap-4 rounded-2xl bg-slate-50 px-6 py-5 text-[12px]">{([
          ["Cargo", order?.cargoType || order?.description || "—"], ["Route", [order?.origin,order?.destination].filter(Boolean).join(" → ") || "—"],
          ["Transport", transportLabel || "—"], ["Job number", jobNumber],
        ] as [string,string][]).map(([label,value])=><div key={label}><p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-700">{value}</p></div>)}</div>
      </section>

      <section className="mt-8">
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Charges</p>
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wide text-slate-400"><th className="py-2.5 text-left font-medium">Description</th><th className="py-2.5 text-right font-medium">Amount</th></tr></thead>
          <tbody>
            <tr className="border-b border-slate-100"><td className="py-4 pr-4 font-medium">{chargeDescription}</td><td className="py-4 text-right font-medium">{money(invoice.subtotal)}</td></tr>
            {Number(invoice.additionalCharges) > 0 ? <tr className="border-b border-slate-100"><td className="py-3 pr-4 text-slate-500">Additional charges</td><td className="py-3 text-right text-slate-600">{money(invoice.additionalCharges)}</td></tr> : null}
          </tbody>
        </table>
        <div className="ml-auto mt-5 w-[290px] space-y-2.5">
          <div className="flex justify-between text-[12px] text-slate-400"><span>VAT</span><span>Not separately charged</span></div>
          <div className="flex items-center justify-between rounded-2xl px-5 py-3.5" style={{ backgroundColor: brandColor }}>
            <span className="text-[13px] font-medium text-white/85">Total due</span>
            <span className="text-[20px] font-semibold text-white">{money(invoice.total)}</span>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl bg-slate-50 p-6">
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
  </div>;
}
