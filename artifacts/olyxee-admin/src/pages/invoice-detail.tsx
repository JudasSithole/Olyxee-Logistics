import { Link, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["invoice", id], queryFn: () => apiFetch<any>(`/api/invoices/${id}`) });
  const action = useMutation({
    mutationFn: (name: string) => apiFetch(`/api/invoices/${id}/${name}`, { method: "POST" }),
    onSuccess: () => { toast.success("Invoice updated"); queryClient.invalidateQueries({ queryKey: ["invoice", id] }); },
    onError: (error: Error) => toast.error(error.message),
  });
  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-52"/><Skeleton className="h-[700px] w-full"/></div>;
  if (!query.data) return <p>Invoice not found.</p>;
  const invoice = query.data;
  const order = invoice.order;
  const customer = invoice.customer;
  const business = invoice.business;
  const money = (value: string | number) => `${invoice.currency} ${Number(value).toFixed(2)}`;
  const serviceDetails = [order?.transportMode ? `${order.transportMode} FREIGHT` : null, order?.serviceRequired, order?.weight].filter(Boolean).join(" | ");
  const displayStatus = invoice.status === "sent" ? "pending payment" : invoice.status;

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
        {invoice.status === "draft" ? <Button disabled={action.isPending} onClick={() => action.mutate("send")}>Send invoice</Button> : null}
        {invoice.status === "sent" ? <Button disabled={action.isPending} onClick={() => action.mutate("pay")}>Confirm payment manually</Button> : null}
        <Button variant="outline" onClick={() => window.print()}>Download / print</Button>
      </div>
    </div>

    <article className="invoice-document mx-auto flex min-h-[1120px] w-full max-w-[794px] flex-col bg-white px-[60px] py-[46px] text-[15px] leading-[1.45] text-slate-900 shadow-sm print:min-h-0 print:max-w-none print:px-[18mm] print:py-[14mm] print:shadow-none">
      <header className="grid grid-cols-[110px_minmax(0,1fr)_190px] items-start gap-0">
        <div className="pr-5 pt-9">
          {business?.businessLogoUrl ? <img src={business.businessLogoUrl} alt={`${business.name} logo`} className="max-h-[42px] w-full object-contain object-left" /> : null}
        </div>
        <div>
          <h1 className="whitespace-nowrap text-[25px] font-bold leading-tight tracking-[-0.02em]">{business?.name ?? "FreightShift International Logistics"}</h1>
          <div className="mt-3 space-y-0.5 text-[15px]">
            <p>{invoice.invoiceNumber}</p>
            <p>Company Reg No: 2025/924488/07</p>
            <p>{business?.supportEmail}</p>
            {business?.phone ? <p>{business.phone}</p> : null}
            {business?.location ? <p className="whitespace-pre-line">{business.location}</p> : null}
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-[17px] font-bold">Invoice</h2>
          <div className="mt-3 space-y-0.5 text-[15px]">
            <p>Created: {new Date(invoice.createdAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}</p>
            <p>Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "On receipt"}</p>
            <p>Status: <span className="font-semibold capitalize">{displayStatus}</span></p>
            <p>Client: {customer?.fullName}</p>
          </div>
        </div>
      </header>

      <section className="mt-[58px] border-t border-slate-200 pt-4">
        <h3 className="text-[15px] font-bold">Bill To</h3>
        <p>{customer?.fullName}</p>
        {customer?.companyName ? <p>{customer.companyName}</p> : null}
        <p className="whitespace-pre-line">{customer?.address || "Address not supplied"}</p>
      </section>

      <section className="mt-4">
        <table className="w-full table-fixed border-collapse text-[14px]">
          <colgroup><col/><col className="w-[62px]"/><col className="w-[110px]"/><col className="w-[120px]"/></colgroup>
          <thead><tr className="border-b border-slate-200 bg-[#f4f7fa] text-[#64748b]"><th className="px-0 py-2 text-left">Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Rate</th><th className="py-2 text-right">Amount</th></tr></thead>
          <tbody><tr className="align-top"><td className="px-0 py-2"><strong>{order?.cargoType || order?.description || "Cross-border logistics service"}</strong>{serviceDetails ? <p className="mt-1 uppercase text-[#64748b]">{serviceDetails}</p> : null}</td><td className="py-2 text-right">1</td><td className="py-2 text-right">{money(invoice.subtotal)}</td><td className="py-2 text-right font-bold">{money(invoice.subtotal)}</td></tr>
          {Number(invoice.additionalCharges) > 0 ? <tr><td className="py-1">Additional charges</td><td/><td/><td className="py-1 text-right">{money(invoice.additionalCharges)}</td></tr> : null}</tbody>
        </table>
        <div className="ml-auto mt-3 grid w-[300px] grid-cols-2 text-[17px] font-bold"><span>Total</span><span className="text-right">{money(invoice.total)}</span></div>
      </section>

      <section className="mt-7"><h3 className="font-bold">Payment details</h3><div className="mt-1 space-y-0.5"><p>Account name: FREIGHTSHIFT INTERNATIONAL LOGISTICS (PTY) LTD</p><p>Bank: FNB</p><p>Account number: 63214036732</p><p>Branch code: 256505</p><p>Account type: GOLD BUSINESS ACCOUNT</p><p>Reference: {customer?.fullName} ({order?.cargoType || "Service"})</p></div></section>
      <section className="mt-7"><h3 className="font-bold">Notes</h3><p className="mt-1">Payment due within agreed terms.</p></section>
      <footer className="mt-auto pt-12 text-center text-xs text-[#64748b]">Page 1 of 1</footer>
    </article>
  </div>;
}
