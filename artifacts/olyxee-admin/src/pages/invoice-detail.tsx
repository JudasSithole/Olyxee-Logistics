import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { InvoiceDocument } from "@/components/invoice-document";
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      // After confirming payment, jump straight to the Job so the admin can
      // carry on with the shipment (which just unlocked for prepaid Jobs).
      if (name === "pay") {
        toast.success("Payment confirmed - opening the Job");
        const orderId = query.data?.orderId;
        if (orderId) navigate(`/orders/${orderId}`);
      } else {
        toast.success("Invoice updated");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const deleteInvoice = useMutation({ mutationFn: () => apiFetch(`/api/invoices/${id}`, { method: "DELETE" }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["invoices"] }); await queryClient.invalidateQueries({ queryKey: ["finance"] }); toast.success("Invoice deleted"); navigate("/finance"); }, onError: (error: Error) => toast.error(error.message) });
  const editInvoice=useMutation({mutationFn:()=>apiFetch(`/api/invoices/${id}`,{method:"PUT",body:{...editForm,dueDate:editForm.dueDate||null}}),onSuccess:()=>{toast.success("Invoice updated");setEditOpen(false);query.refetch();},onError:(error:Error)=>toast.error(error.message)});
  if (query.isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-52"/><Skeleton className="h-[700px] w-full"/></div>;
  if (!query.data) return <p>Invoice not found.</p>;
  const invoice = query.data;
  const openEdit=()=>{setEditForm({subtotal:String(invoice.subtotal),additionalCharges:String(invoice.additionalCharges),dueDate:invoice.dueDate?String(invoice.dueDate).slice(0,10):"",notes:invoice.notes??""});setEditOpen(true);};

  return <div className="mx-auto max-w-4xl space-y-5">
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

    <InvoiceDocument invoice={invoice} />
  </div>;
}
