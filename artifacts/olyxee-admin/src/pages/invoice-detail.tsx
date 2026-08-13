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
    <div className="print:hidden flex flex-wrap items-center justify-between gap-3">
      <Link href={`/orders/${invoice.orderId}`}><Button variant="ghost">← Order</Button></Link>
      <div className="flex gap-2">
        {invoice.status === "draft" ? <Button disabled={action.isPending} onClick={() => action.mutate("send")}>Send invoice</Button> : null}
        {invoice.status === "sent" ? <Button disabled={action.isPending} onClick={() => action.mutate("pay")}>Confirm payment manually</Button> : null}
        <Button variant="outline" onClick={() => window.print()}>Download / print</Button>
      </div>
    </div>

    <article className="min-h-[980px] bg-white p-8 text-slate-900 shadow-sm sm:p-12 print:min-h-0 print:p-0 print:shadow-none">
      <header className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{business?.name ?? "FreightShift International Logistics"}</h1>
          <div className="mt-4 space-y-1 text-sm">
            <p>{invoice.invoiceNumber}</p>
            <p>Company Reg No: 2025/924488/07</p>
            <p>{business?.supportEmail}</p>
            {business?.phone ? <p>{business.phone}</p> : null}
            {business?.location ? <p className="whitespace-pre-line">{business.location}</p> : null}
          </div>
        </div>
        <div className="sm:text-right">
          <h2 className="text-xl font-bold">Invoice</h2>
          <div className="mt-4 space-y-1 text-sm">
            <p>Created: {new Date(invoice.createdAt).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" })}</p>
            <p>Due: {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("en-ZA", { day: "2-digit", month: "short", year: "numeric" }) : "On receipt"}</p>
            <p>Status: <span className="font-semibold capitalize">{displayStatus}</span></p>
            <p>Client: {customer?.fullName}</p>
          </div>
        </div>
      </header>

      <section className="mt-14 border-t pt-6">
        <h3 className="font-bold">Bill To</h3>
        <p className="mt-1">{customer?.fullName}</p>
        {customer?.companyName ? <p>{customer.companyName}</p> : null}
        <p className="whitespace-pre-line">{customer?.address || "Address not supplied"}</p>
      </section>

      <section className="mt-7">
        <table className="w-full border-collapse text-sm">
          <thead><tr className="bg-slate-100 text-slate-500"><th className="p-3 text-left">Item</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr></thead>
          <tbody><tr className="align-top"><td className="p-3"><strong>{order?.cargoType || order?.description || "Cross-border logistics service"}</strong>{serviceDetails ? <p className="mt-2 uppercase text-slate-500">{serviceDetails}</p> : null}</td><td className="p-3 text-right">1</td><td className="p-3 text-right">{money(invoice.subtotal)}</td><td className="p-3 text-right font-bold">{money(invoice.subtotal)}</td></tr>
          {Number(invoice.additionalCharges) > 0 ? <tr><td className="p-3">Additional charges</td><td/><td/><td className="p-3 text-right">{money(invoice.additionalCharges)}</td></tr> : null}</tbody>
        </table>
        <div className="ml-auto mt-5 flex w-full max-w-xs justify-between text-lg font-bold"><span>Total</span><span>{money(invoice.total)}</span></div>
      </section>

      <section className="mt-9"><h3 className="font-bold">Payment details</h3><div className="mt-2 space-y-1 text-sm"><p>Account name: FREIGHTSHIFT INTERNATIONAL LOGISTICS (PTY) LTD</p><p>Bank: FNB</p><p>Account number: 63214036732</p><p>Branch code: 256505</p><p>Account type: GOLD BUSINESS ACCOUNT</p><p>Reference: {customer?.fullName} ({order?.cargoType || "Service"})</p></div></section>
      <section className="mt-8"><h3 className="font-bold">Notes</h3><p className="mt-2 text-sm">Payment due within agreed terms. Tracking updates begin after payment is confirmed.</p></section>
      <footer className="mt-24 text-center text-xs text-slate-500">Page 1 of 1</footer>
    </article>
  </div>;
}
