import { Link,useParams } from "wouter";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function InvoiceDetailPage(){
 const {id}=useParams<{id:string}>();const qc=useQueryClient();
 const q=useQuery({queryKey:["invoice",id],queryFn:()=>apiFetch<any>(`/api/invoices/${id}`)});
 const act=useMutation({mutationFn:(a:string)=>apiFetch(`/api/invoices/${id}/${a}`,{method:"POST"}),onSuccess:()=>{toast.success("Invoice updated");qc.invalidateQueries({queryKey:["invoice",id]})},onError:(e:Error)=>toast.error(e.message)});
 if(!q.data)return <p>Loading invoice...</p>;const i=q.data;
 return <div className="space-y-6 max-w-3xl"><Link href={`/orders/${i.orderId}`}><Button variant="ghost">← Order</Button></Link><div><h1 className="text-2xl font-bold">{i.invoiceNumber}</h1><p className="capitalize text-muted-foreground">{i.status}</p></div><Card><CardHeader><CardTitle>Invoice</CardTitle></CardHeader><CardContent className="space-y-3"><Row k="Subtotal" v={`${i.currency} ${i.subtotal}`}/><Row k="Additional charges" v={`${i.currency} ${i.additionalCharges}`}/><Row k="Total" v={`${i.currency} ${i.total}`}/><Row k="Due" v={i.dueDate?new Date(i.dueDate).toLocaleDateString():"Not set"}/><Row k="Sent" v={i.sentAt?new Date(i.sentAt).toLocaleString():"Not sent"}/><Row k="Payment confirmed" v={i.paidAt?new Date(i.paidAt).toLocaleString():"Not paid"}/><div className="flex gap-2 pt-4">{i.status==="draft"&&<Button onClick={()=>act.mutate("send")}>Send invoice</Button>}{i.status==="sent"&&<Button onClick={()=>act.mutate("pay")}>Confirm payment manually</Button>}<Button variant="outline" onClick={()=>window.print()}>Download / print</Button></div></CardContent></Card></div>
}
function Row({k,v}:{k:string;v:string}){return <div className="flex justify-between border-b pb-2"><span className="text-muted-foreground">{k}</span><strong>{v}</strong></div>}
