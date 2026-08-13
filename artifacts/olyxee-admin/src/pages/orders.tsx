import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useOrders, useCustomers, useCreateOrder } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { StatusBadge } from "@/components/status-badge";
import { Plus, Search, Package, Check, ChevronsUpDown } from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { toast } from "sonner";
import { format } from "date-fns";
import { ORDER_STATUSES, TRANSPORT_MODES, TRANSPORT_MODE_LABELS, type TransportMode } from "@/lib/order-statuses";

function generateOrderReference(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `REF-${yy}${mm}${dd}-${suffix}`;
}

function CreateOrderDialog({ onSuccess, businessId }: { onSuccess: () => void; businessId: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => ({
    customerId: "",
    orderReference: generateOrderReference(),
    description: "",
    estimatedDeliveryDate: "",
    transportMode: "",
    cargoType: "", serviceRequired: "", origin: "China", destination: "South Africa", weight: "", dimensions: "",
    invoiceSubtotal: "", invoiceAdditionalCharges: "0",
  }));
  const createMutation = useCreateOrder();
  // Server-side customer search so every customer is reachable, not just the
  // most recent page. The picker debounces typing before hitting the API.
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(customerSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [customerSearch]);
  const { data: customersData, isFetching: customersFetching } = useCustomers(businessId, {
    limit: 100,
    search: debouncedSearch || undefined,
  });
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; label: string } | null>(null);

  React.useEffect(() => {
    if (open) {
      setForm({
        customerId: "",
        orderReference: generateOrderReference(),
        description: "",
        estimatedDeliveryDate: "",
        transportMode: "",
        cargoType: "", serviceRequired: "", origin: "China", destination: "South Africa", weight: "", dimensions: "",
        invoiceSubtotal: "", invoiceAdditionalCharges: "0",
      });
      setSelectedCustomer(null);
      setCustomerSearch("");
      setDebouncedSearch("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.transportMode) {
      toast.error("Please select a transport mode");
      return;
    }
    createMutation.mutate(
      { business_id: businessId, customer_id: form.customerId, order_reference: form.orderReference || undefined, description: form.description || undefined, estimated_completion: form.estimatedDeliveryDate || undefined, cargo_type: form.cargoType || undefined, service_required: form.serviceRequired || undefined, origin: form.origin || undefined, destination: form.destination || undefined, weight: form.weight || undefined, dimensions: form.dimensions || undefined, transport_mode: form.transportMode, invoice_subtotal: form.invoiceSubtotal, invoice_additional_charges: form.invoiceAdditionalCharges },
      {
        onSuccess: (created) => {
          if ((created as typeof created & { invoice_email_status?: string }).invoice_email_status === "sent") {
            toast.success("Order and pending invoice created - invoice emailed to customer");
          } else {
            toast.warning("Order and invoice created, but email delivery failed. Open the invoice to resend it.");
          }
          setOpen(false);
          onSuccess();
        },
        onError: () => toast.error("Failed to create order"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Order</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerPickerOpen}
                  className="w-full justify-between font-normal"
                  data-testid="button-select-customer"
                >
                  <span className="truncate">
                    {selectedCustomer ? selectedCustomer.label : "Select customer..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name, email or company..."
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                  />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>
                      {customersFetching ? "Searching..." : "No customers found."}
                    </CommandEmpty>
                    {customersData?.customers.map(c => {
                      const label = `${c.full_name} - ${c.email}`;
                      return (
                        <CommandItem
                          key={c.id}
                          value={c.id}
                          onSelect={() => {
                            setForm(f => ({ ...f, customerId: c.id }));
                            setSelectedCustomer({ id: c.id, label });
                            setCustomerPickerOpen(false);
                          }}
                        >
                          <Check className={`mr-2 h-4 w-4 ${form.customerId === c.id ? "opacity-100" : "opacity-0"}`} />
                          <span className="truncate">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          {(
            <div className="space-y-2">
              <Label>Transport Mode *</Label>
              <Select value={form.transportMode} onValueChange={v => setForm(f => ({ ...f, transportMode: v }))}>
                <SelectTrigger><SelectValue placeholder="How is this order shipping?" /></SelectTrigger>
                <SelectContent>
                  {TRANSPORT_MODES.map(m => (
                    <SelectItem key={m} value={m}>{TRANSPORT_MODE_LABELS[m as TransportMode]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Determines the tracking stages your customer will see.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Origin</Label><Input value={form.origin} onChange={e=>setForm(f=>({...f,origin:e.target.value}))}/></div><div className="space-y-2"><Label>Destination</Label><Input value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))}/></div><div className="space-y-2"><Label>Cargo type</Label><Input value={form.cargoType} onChange={e=>setForm(f=>({...f,cargoType:e.target.value}))}/></div><div className="space-y-2"><Label>Service required</Label><Input value={form.serviceRequired} onChange={e=>setForm(f=>({...f,serviceRequired:e.target.value}))}/></div><div className="space-y-2"><Label>Weight</Label><Input value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))}/></div><div className="space-y-2"><Label>Dimensions</Label><Input value={form.dimensions} onChange={e=>setForm(f=>({...f,dimensions:e.target.value}))}/></div></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Order Reference</Label>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, orderReference: generateOrderReference() }))}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  title="Generate a new reference"
                >
                  Regenerate
                </button>
              </div>
              <Input
                value={form.orderReference}
                onChange={e => setForm(f => ({ ...f, orderReference: e.target.value }))}
                placeholder="REF-250517-AB12"
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Est. Delivery Date</Label>
              <Input type="date" value={form.estimatedDeliveryDate} onChange={e => setForm(f => ({ ...f, estimatedDeliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="e.g. 2 pallets electronics, 480 kg, 1.2 CBM — Shanghai to Durban, fragile"
            />
            <p className="text-xs text-muted-foreground">
              Include contents, quantity, weight/volume, origin → destination, and any handling notes.
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div><Label className="font-semibold">Invoice amount (ZAR) *</Label><p className="text-xs text-muted-foreground">The accepted quote amount. A pending invoice will be emailed automatically.</p></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Service subtotal</Label><Input type="number" min="0" step="0.01" value={form.invoiceSubtotal} onChange={e=>setForm(f=>({...f,invoiceSubtotal:e.target.value}))} placeholder="600.00" required /></div>
              <div className="space-y-2"><Label>Additional charges</Label><Input type="number" min="0" step="0.01" value={form.invoiceAdditionalCharges} onChange={e=>setForm(f=>({...f,invoiceAdditionalCharges:e.target.value}))} /></div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Tracking updates begin only after an admin confirms payment.</p>
          <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.customerId || !form.transportMode || !form.invoiceSubtotal}>
            {createMutation.isPending ? "Creating and sending invoice..." : "Create Order & Send Invoice"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function getInitialStatusFromUrl(): string {
  if (typeof window === "undefined") return "all";
  const raw = new URLSearchParams(window.location.search).get("status");
  if (raw && (ORDER_STATUSES as readonly string[]).includes(raw)) return raw;
  return "all";
}

export default function OrdersPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [querySearch, setQuerySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(getInitialStatusFromUrl);
  const [page, setPage] = useState(1);

  const { data, isLoading, refetch } = useOrders(user?.businessId, {
    search: querySearch || undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    page,
    limit: 20,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuerySearch(search);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{data?.total ?? 0} total orders</p>
        </div>
        <CreateOrderDialog onSuccess={() => refetch()} businessId={user?.businessId ?? ""} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <form onSubmit={handleSearch} className="flex gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search tracking ID, reference or customer name..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !data?.orders.length ? (
            <EmptyState
              icon={<Package className="h-12 w-12" />}
              title="No orders found"
              description="Create your first order to get started."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Est. Delivery</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right pr-4"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <TableCell>
                        <span className="font-mono text-sm font-semibold">{order.tracking_id}</span>
                      </TableCell>
                      <TableCell className="font-medium">{order.customers?.full_name ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{order.order_reference ?? "-"}</TableCell>
                      <TableCell><StatusBadge status={order.current_status} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.estimated_delivery_date ? format(new Date(order.estimated_delivery_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(order.updated_at), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                        <Link href={`/orders/${order.id}`}>
                          <Button size="sm" variant="secondary" className="h-8 text-xs">
                            Update
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {data.total > 20 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(data.total / 20)}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(p => p + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
