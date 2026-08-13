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
    onSuccess: () => { toast.success("Invoice updated"); queryClient.invalidateQueries({ queryKey: ["invoice", id] }); },
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
  const money = (value: string | number) => `${invoice.currency} ${Number(value).toFixed(2)}`;
  const displayStatus = invoice.status === "sent" ? "Pending Payment" : String(invoice.status).replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const issueDate = new Date(invoice.createdAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" });
  const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "On receipt";
  const chargeDescription = [order?.transportMode ? `${String(order.transportMode).replaceAll("_", " ")} Freight` : "Logistics service", order?.cargoType || order?.description, order?.weight].filter(Boolean).join(" – ");
  const openEdit=()=>{setEditForm({subtotal:String(invoice.subtotal),additionalCharges:String(invoice.additionalCharges),dueDate:invoice.dueDate?String(invoice.dueDate).slice(0,10):"",notes:invoice.notes??""});setEditOpen(true);};

  return <div className="mx-auto max-w-4xl space-y-5">
    <style>{`@media print {
      @page { size: A4 portrait; margin: 0; }
      body * { visibility: hidden !important; }
      .invoice-document, .invoice-document * { visibility: visible !important; }
      .invoice-document { position: fixed !important; inset: 0 !important; width: 210mm !important; height: 297mm !important; margin: 0 !important; box-sizing: border-box !important; overflow: hidden !important; }
    }`}</style>
    <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
      <Link href={`/orders/${invoice.orderId}`}><Button variant="ghost">← Order</Button></Link>
      <div className="flex gap-2">
        {invoice.status !== "paid" ? <Button variant="outline" onClick={openEdit}>Edit invoice</Button> : null}
        {invoice.status !== "paid" ? <Button variant="destructive" disabled={deleteInvoice.isPending} onClick={() => { if (window.confirm(`Permanently delete invoice ${invoice.invoiceNumber}? The order will remain.`)) deleteInvoice.mutate(); }}>Delete invoice</Button> : null}
        {invoice.status === "draft" ? <Button disabled={action.isPending} onClick={() => action.mutate("send")}>Send invoice</Button> : null}
        {invoice.status === "sent" ? <Button disabled={action.isPending} onClick={() => action.mutate("pay")}>Confirm payment manually</Button> : null}
        <Button variant="outline" onClick={() => window.print()}>Download / print</Button>
      </div>
    </div>
    <Sheet open={editOpen} onOpenChange={setEditOpen}><SheetContent className="w-[400px]"><SheetHeader><SheetTitle>Edit invoice</SheetTitle></SheetHeader><form className="mt-6 space-y-4" onSubmit={e=>{e.preventDefault();editInvoice.mutate();}}><div className="space-y-2"><Label>Subtotal</Label><Input type="number" min="0" step="0.01" value={editForm.subtotal} onChange={e=>setEditForm(f=>({...f,subtotal:e.target.value}))}/></div><div className="space-y-2"><Label>Additional charges</Label><Input type="number" min="0" step="0.01" value={editForm.additionalCharges} onChange={e=>setEditForm(f=>({...f,additionalCharges:e.target.value}))}/></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={editForm.dueDate} onChange={e=>setEditForm(f=>({...f,dueDate:e.target.value}))}/></div><div className="space-y-2"><Label>Notes</Label><Input value={editForm.notes} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))}/></div><Button className="w-full" disabled={editInvoice.isPending}>{editInvoice.isPending?'Saving...':'Save invoice changes'}</Button></form></SheetContent></Sheet>

    <article className="invoice-document relative mx-auto flex min-h-[1120px] w-full max-w-[794px] flex-col overflow-hidden bg-white px-[60px] pb-[42px] pt-[58px] text-[14px] leading-[1.45] text-[#142033] shadow-xl print:min-h-0 print:max-w-none print:px-[18mm] print:py-[14mm] print:shadow-none">
      <div className="absolute inset-x-0 top-0 h-3 bg-[#10243e]" />
      <header className="grid grid-cols-[100px_minmax(0,1fr)_210px] items-start gap-2">
        <div className="pr-5 pt-1">
          {(business?.invoiceLogoUrl || business?.businessLogoUrl) ? <img src={business.invoiceLogoUrl || business.businessLogoUrl} alt={`${business.invoiceLegalName || business.name} logo`} className="max-h-[42px] w-full object-contain object-left" /> : null}
        </div>
        <div>
          <h1 className="text-[23px] font-bold leading-tight tracking-[-0.02em] text-[#10243e]">{business?.invoiceLegalName || business?.name || "Business"}</h1>
          <div className="mt-3 space-y-0.5 text-[12px] text-slate-500">
            {business?.invoiceRegistrationNumber ? <p>Company Reg No: {business.invoiceRegistrationNumber}</p> : null}
            {business?.invoiceTaxNumber ? <p>Tax No: {business.invoiceTaxNumber}</p> : null}
            <p>{business?.invoiceEmail || business?.supportEmail}</p>
            {(business?.invoicePhone || business?.phone) ? <p>{business.invoicePhone || business.phone}</p> : null}
            {(business?.invoiceAddress || business?.location) ? <p className="whitespace-pre-line">{business.invoiceAddress || business.location}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-[30px] font-bold tracking-[0.08em] text-[#10243e]">INVOICE</h2>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-slate-500">Invoice number</p><p className="font-semibold">{invoice.invoiceNumber}</p>
          <div className="mt-3 space-y-0.5 text-[12px] text-slate-600">
            <p>Issue Date: {issueDate}</p>
            <p>Due Date: {dueDate}</p>
            <p className="mt-3 inline-block rounded bg-amber-50 px-3 py-1 font-bold tracking-wide text-amber-700">{displayStatus}</p>
          </div>
        </div>
      </header>

      <section className="mt-10 grid grid-cols-2 border-t border-slate-200 pt-5">
        <div><h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Bill To</h3>
        <p className="mt-2 text-[16px] font-bold">{customer?.fullName}</p>
        {customer?.companyName ? <p>{customer.companyName}</p> : null}
        <p className="mt-1 whitespace-pre-line text-slate-500">{customer?.address || "Address not supplied"}</p><p className="mt-1 text-slate-500">{customer?.email}</p>{customer?.phone ? <p className="text-slate-500">{customer.phone}</p> : null}</div>
      </section>

      <section className="mt-7"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Shipment</h3><div className="grid grid-cols-2 overflow-hidden rounded border border-slate-200 text-[12px]">{([
        ["Cargo", order?.cargoType || order?.description || "Not provided"], ["Transport", order?.transportMode ? `${String(order.transportMode).replaceAll("_", " ")} Freight` : "Not provided"],
        ["Weight", order?.weight || "Not provided"], ["Order Reference", order?.orderReference || "Not provided"], ["Olyxee Tracking ID", order?.trackingId || "Not assigned"],
        ["External Tracking Number", order?.supplierTrackingNumber || "Pending tracking number"], ["Origin", order?.origin || "Not provided"], ["Destination", order?.destination || "Not provided"],
      ] as [string,string][]).map(([label,value])=><div key={label} className="grid grid-cols-[145px_1fr] border-b border-slate-100 px-3 py-2 odd:border-r"><span className="text-slate-500">{label}</span><span className="font-semibold capitalize">{value}</span></div>)}</div></section>

      <section className="mt-7"><h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Charges</h3>
        <table className="w-full table-fixed border-collapse text-[14px]">
          <colgroup><col/><col className="w-[62px]"/><col className="w-[110px]"/><col className="w-[120px]"/></colgroup>
          <thead><tr className="bg-[#10243e] text-[11px] uppercase tracking-wider text-white"><th className="rounded-l px-3 py-3 text-left">Description</th><th className="py-3 text-right">Qty</th><th className="py-3 text-right">Rate</th><th className="rounded-r py-3 pr-3 text-right">Amount</th></tr></thead>
          <tbody><tr className="align-top border-b border-slate-200"><td className="px-3 py-4 font-semibold capitalize">{chargeDescription}</td><td className="py-4 text-right">1</td><td className="py-4 text-right">{money(invoice.subtotal)}</td><td className="py-4 pr-3 text-right font-bold">{money(invoice.subtotal)}</td></tr>
          {Number(invoice.additionalCharges) > 0 ? <tr><td className="py-2">Additional charges</td><td className="text-right">1</td><td className="text-right">{money(invoice.additionalCharges)}</td><td className="py-2 text-right">{money(invoice.additionalCharges)}</td></tr> : null}</tbody>
        </table>
        <div className="ml-auto mt-4 grid w-[320px] grid-cols-2 gap-y-1 rounded bg-[#f4f7fb] px-4 py-3 text-[12px] text-[#10243e]"><span>Subtotal</span><span className="text-right">{money(invoice.total)}</span><span>VAT</span><span className="text-right">Not separately charged</span><span className="mt-1 text-[17px] font-bold">Total Due</span><span className="mt-1 text-right text-[17px] font-bold">{money(invoice.total)}</span></div>
      </section>

      <div className="mt-7 grid grid-cols-[1.7fr_1fr] gap-7"><section className="rounded bg-[#f4f7fb] p-5"><h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#10243e]">Payment Details</h3><div className="mt-3 whitespace-pre-line text-[13px]">{business?.invoicePaymentDetails || "Payment details have not been configured. Contact the issuer."}<br/><br/><strong>Payment Reference: {invoice.invoiceNumber}</strong></div></section><section className="p-1"><h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#10243e]">Payment Terms</h3><p className="mt-3 text-slate-600">{business?.invoicePaymentTerms || "Payment due on receipt."}</p><p className="mt-5 text-[11px] font-bold uppercase text-amber-700">Important: Shipment status updates become available after payment has been confirmed.</p></section></div>
      {business?.invoiceFooterNote ? <p className="mt-auto pt-8 text-center text-xs text-slate-500">{business.invoiceFooterNote}</p> : <div className="mt-auto"/>}<footer className="mt-5 border-t border-slate-200 pt-4 text-center text-[11px] text-[#64748b]">{business?.invoiceLegalName || business?.name} · {business?.invoiceEmail || business?.supportEmail} · Page 1 of 1</footer>
    </article>
  </div>;
}
