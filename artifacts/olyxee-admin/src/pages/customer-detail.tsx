import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useCustomer, useCustomerOrders, useUpdateCustomer } from "@/hooks/use-supabase-queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { ArrowLeft, ArrowRight, Edit, Package, Mail, Phone, Building, MapPin, ReceiptText, Trash2, UserX } from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

function displayDate(value: string | Date | null | undefined, fallback = "-") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? format(date, "MMM d, yyyy") : fallback;
}

export default function CustomerDetailPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading, refetch } = useCustomer(id ?? "");
  const { data: orders, isLoading: ordersLoading } = useCustomerOrders(id ?? "");
  const updateMutation = useUpdateCustomer();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", company_name: "", address: "" });
  const invoices = useQuery({ queryKey: ["customer-invoices", id], queryFn: () => apiFetch<{data:any[]}>("/api/invoices", { query: { customerId: id } }), enabled: !!id });
  const deleteMutation = useMutation({ mutationFn: () => apiFetch(`/api/customers/${id}`, { method: "DELETE" }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["customers"] }); toast.success("Customer deleted"); navigate("/customers"); }, onError: (error: Error) => toast.error(error.message) });

  const openEdit = () => {
    if (customer) {
      setForm({ full_name: customer.full_name, email: customer.email, phone: customer.phone ?? "", company_name: customer.company_name ?? "", address: customer.address ?? "" });
      setEditOpen(true);
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      { id: id!, business_id: customer!.business_id, full_name: form.full_name, email: form.email, phone: form.phone || undefined, company_name: form.company_name || undefined, address: form.address || undefined },
      {
        onSuccess: () => { toast.success("Customer updated"); setEditOpen(false); refetch(); },
        onError: () => toast.error("Failed to update customer"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-40" />
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <EmptyState
        icon={<UserX className="h-12 w-12" />}
        title="Customer not found"
        description="This customer may have been deleted or the link is incorrect."
        action={
          <Link href="/customers">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to customers
            </Button>
          </Link>
        }
      />
    );
  }

  const initials = customer.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "C";
  const invoiceList = invoices.data?.data ?? [];
  const unpaidInvoices = invoiceList.filter(invoice => invoice.status !== "paid").length;

  return (
    <div className="space-y-6 max-w-6xl pb-8">
      {/* Back */}
      <Link href="/customers">
        <Button variant="ghost" size="sm" className="gap-2 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Customers
        </Button>
      </Link>

      {/* Header */}
      <div
        className="relative flex min-h-48 flex-col justify-end gap-5 overflow-hidden rounded-3xl border border-black/10 bg-cover bg-center p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6"
        style={{ backgroundImage: "url('/customer-port-background.jpg')" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20" />
        <div className="relative z-10 flex items-center gap-4 sm:gap-5">
          {/* Avatar */}
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-xl font-bold text-white shadow-sm backdrop-blur-sm sm:h-20 sm:w-20">{initials}</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">Customer profile</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">{customer.full_name}</h1>
            {customer.company_name && (
              <p className="mt-0.5 text-sm text-white/80">{customer.company_name}</p>
            )}
            <p className="mt-1 text-xs text-white/65">
              Customer since {displayDate(customer.created_at, "date unavailable")}
            </p>
          </div>
        </div>

        <div className="relative z-10 flex gap-2"><Sheet open={editOpen} onOpenChange={setEditOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="flex-shrink-0 gap-2 rounded-xl border-white/25 bg-white/90 text-slate-950 hover:bg-white" onClick={openEdit}>
              <Edit className="h-4 w-4" /> Edit profile
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px]">
            <SheetHeader><SheetTitle>Edit Customer</SheetTitle></SheetHeader>
            <form onSubmit={handleUpdate} className="mt-6 space-y-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Email *</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Company</Label><Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </SheetContent>
        </Sheet><Button variant="ghost" className="rounded-xl bg-black/20 text-white hover:bg-destructive/80 hover:text-white" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Delete ${customer.full_name}? This is permanent and requires their orders to be deleted first.`)) deleteMutation.mutate(); }}><Trash2 className="mr-1.5 h-4 w-4" />Delete</Button></div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contact and billing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span>{customer.email}</span>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.company_name && (
              <div className="flex items-center gap-3 text-sm">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span>{customer.company_name}</span>
              </div>
            )}
            {customer.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">{customer.address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Account summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-2xl bg-muted/40 p-3"><Package className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-2xl font-bold">{orders?.length ?? 0}</p><p className="text-xs text-muted-foreground">Orders</p></div>
            <div className="rounded-2xl bg-muted/40 p-3"><ReceiptText className="h-4 w-4 text-muted-foreground" /><p className="mt-2 text-2xl font-bold">{invoiceList.length}</p><p className="text-xs text-muted-foreground">Invoices</p></div>
            <div className="rounded-2xl bg-amber-500/10 p-3"><ReceiptText className="h-4 w-4 text-amber-700" /><p className="mt-2 text-2xl font-bold">{unpaidInvoices}</p><p className="text-xs text-muted-foreground">Unpaid</p></div>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card className="rounded-3xl border-border/70 shadow-sm"><CardHeader><CardTitle className="text-base">Invoices</CardTitle><p className="text-xs text-muted-foreground">Billing history for this customer</p></CardHeader><CardContent className="space-y-2">{invoiceList.length ? invoiceList.map(i => <Link key={i.id} href={`/invoices/${i.id}`} className="flex items-center justify-between rounded-xl border p-3 text-sm transition-colors hover:bg-muted/30"><span className="font-mono font-semibold">{i.invoiceNumber}</span><span className="flex items-center gap-2"><span className="capitalize text-muted-foreground">{i.status}</span><ArrowRight className="h-4 w-4" /></span></Link>) : <p className="py-4 text-center text-sm text-muted-foreground">No invoices yet.</p>}</CardContent></Card>
      </div>

      {/* Orders table */}
      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {ordersLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : !orders?.length ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-10 w-10 text-muted-foreground/20 mb-3" />
              <p className="text-muted-foreground text-sm">No orders yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking ID</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Est. Delivery</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.id} className="cursor-pointer hover:bg-muted/40">
                    <TableCell>
                      <Link href={`/orders/${order.id}`} className="font-mono font-semibold text-sm hover:text-primary transition-colors">
                        {order.tracking_id}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{order.order_reference ?? "-"}</TableCell>
                    <TableCell><StatusBadge status={order.current_status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {displayDate(order.estimated_delivery_date)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {displayDate(order.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
