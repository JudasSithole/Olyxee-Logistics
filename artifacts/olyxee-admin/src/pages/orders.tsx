import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useOrders, useCustomers, useCreateOrder, useDashboardStats } from "@/hooks/use-supabase-queries";
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
import { Plus, Search, Package, Check, ChevronsUpDown, ArrowRight, ClipboardCheck, Filter, Plane, RotateCcw, Ship, Truck } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ORDER_STATUSES, TRANSPORT_MODES, TRANSPORT_MODE_LABELS, type TransportMode } from "@/lib/order-statuses";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
    jobNumber: "",
    billingType: "PREPAID" as "PREPAID" | "POSTPAID",
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
  // Guided wizard: 1 = customer, 2 = shipment, 3 = billing. Keeps each screen
  // small instead of one long form.
  const [step, setStep] = useState(1);
  const invoiceTotal = (Number(form.invoiceSubtotal) || 0) + (Number(form.invoiceAdditionalCharges) || 0);

  React.useEffect(() => {
    if (open) {
      setStep(1);
      setForm({
        customerId: "",
        jobNumber: "",
        billingType: "PREPAID",
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

  const isPrepaid = form.billingType === "PREPAID";
  // Per-step completeness so "Next" only enables once the step is valid.
  const step1Ok = !!form.customerId;
  const step2Ok = !!form.transportMode && !!form.origin.trim() && !!form.destination.trim() && !!form.cargoType.trim() && !!form.serviceRequired.trim() && !!form.weight.trim();
  const step3Ok = !!form.jobNumber.trim() && (!isPrepaid || !!form.invoiceSubtotal);
  const STEP_LABELS = ["Customer", "Shipment", "Billing"];
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jobNumber.trim()) {
      toast.error("Please enter a Job Number");
      return;
    }
    if (!form.transportMode) {
      toast.error("Please select a transport mode");
      return;
    }
    if (isPrepaid && !form.invoiceSubtotal) {
      toast.error("Enter the invoice subtotal for a prepaid Job");
      return;
    }
    createMutation.mutate(
      {
        business_id: businessId,
        customer_id: form.customerId,
        job_number: form.jobNumber.trim(),
        billing_type: form.billingType,
        description: form.description || undefined,
        estimated_completion: form.estimatedDeliveryDate || undefined,
        cargo_type: form.cargoType || undefined,
        service_required: form.serviceRequired || undefined,
        origin: form.origin || undefined,
        destination: form.destination || undefined,
        weight: form.weight || undefined,
        dimensions: form.dimensions || undefined,
        transport_mode: form.transportMode,
        // PREPAID invoices at creation; POSTPAID is invoiced after delivery.
        invoice_subtotal: isPrepaid ? form.invoiceSubtotal : undefined,
        invoice_additional_charges: isPrepaid ? form.invoiceAdditionalCharges : undefined,
      },
      {
        onSuccess: (created) => {
          const emailStatus = (created as typeof created & { invoice_email_status?: string }).invoice_email_status;
          if (!isPrepaid) {
            toast.success("Job created. Invoice it after delivery.");
          } else if (emailStatus === "sent") {
            toast.success("Job and pending invoice created - invoice emailed to customer");
          } else {
            toast.warning("Job and invoice created, but email delivery failed. Open the invoice to resend it.");
          }
          setOpen(false);
          onSuccess();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create Job"),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Job</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-[760px]">
        <DialogHeader className="border-b border-border/60 px-6 pb-5 pt-6 text-left">
          <DialogTitle className="text-xl">Create a new Job</DialogTitle>
          {/* Progress stepper */}
          <div className="mt-3 flex items-center gap-2">
            {STEP_LABELS.map((lbl, i) => {
              const n = i + 1;
              const done = n < step;
              const active = n === step;
              return (
                <div key={lbl} className="flex flex-1 items-center gap-2">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>{done ? "✓" : n}</span>
                  <span className={`whitespace-nowrap text-xs font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{lbl}</span>
                  {n < 3 && <span className={`h-px flex-1 ${done ? "bg-primary/40" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 px-6 pb-6">
          {step === 1 && (
          <section className="space-y-4 rounded-2xl border border-blue-200/80 bg-blue-50/60 p-5 dark:border-blue-900/60 dark:bg-blue-950/20">
            <div><h3 className="font-semibold text-blue-950 dark:text-blue-100">Who is this Job for?</h3><p className="mt-1 text-xs text-blue-900/65 dark:text-blue-200/70">Choose the customer who receives the invoice and shipment updates.</p></div>
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
          </div></section>
          )}
          {step === 2 && (
          <section className="space-y-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20">
            <div><h3 className="font-semibold text-emerald-950 dark:text-emerald-100">Shipment and cargo</h3><p className="mt-1 text-xs text-emerald-900/65 dark:text-emerald-200/70">Add the route and details customers should see.</p></div>
          {(
            <div className="space-y-2">
              <Label>Transport mode *</Label>
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
          <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Origin *</Label><Input value={form.origin} onChange={e=>setForm(f=>({...f,origin:e.target.value}))} placeholder="China" required/></div><div className="space-y-2"><Label>Destination *</Label><Input value={form.destination} onChange={e=>setForm(f=>({...f,destination:e.target.value}))} placeholder="South Africa" required/></div><div className="space-y-2"><Label>Cargo / invoice item *</Label><Input value={form.cargoType} onChange={e=>setForm(f=>({...f,cargoType:e.target.value}))} placeholder="e.g. Handbags" required /></div><div className="space-y-2"><Label>Service required *</Label><Input value={form.serviceRequired} onChange={e=>setForm(f=>({...f,serviceRequired:e.target.value}))} placeholder="e.g. Customs and tax" required /></div><div className="space-y-2"><Label>Weight *</Label><Input value={form.weight} onChange={e=>setForm(f=>({...f,weight:e.target.value}))} placeholder="e.g. 1.5 kg" required /></div><div className="space-y-2"><Label>Dimensions</Label><Input value={form.dimensions} onChange={e=>setForm(f=>({...f,dimensions:e.target.value}))} placeholder="e.g. 40 × 30 × 25 cm"/></div></div>
          <div className="space-y-2"><Label>Handling notes</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Quantity, packaging, fragile handling, or other useful notes" /></div>
          </section>
          )}
          {step === 3 && (
          <section className="space-y-4 rounded-2xl border border-violet-200/80 bg-violet-50/60 p-5 dark:border-violet-900/60 dark:bg-violet-950/20">
            <div><h3 className="font-semibold text-violet-950 dark:text-violet-100">Job number and billing</h3><p className="mt-1 text-xs text-violet-900/65 dark:text-violet-200/70">Give the Job your own reference and choose how it's billed.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Job Number *</Label>
              <Input
                value={form.jobNumber}
                onChange={e => setForm(f => ({ ...f, jobNumber: e.target.value }))}
                placeholder="e.g. CFS-0024"
                className="font-mono text-sm"
                required
              />
              <p className="text-[11px] text-muted-foreground">Your internal reference. Must be unique in your business.</p>
            </div>
            <div className="space-y-2">
              <Label>Est. Delivery Date</Label>
              <Input type="date" value={form.estimatedDeliveryDate} onChange={e => setForm(f => ({ ...f, estimatedDeliveryDate: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Billing Type *</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              {([
                ["PREPAID", "Invoice Before Delivery", "Invoice and payment are handled before shipment processing."],
                ["POSTPAID", "Invoice After Delivery", "The shipment is completed first and invoiced after delivery."],
              ] as const).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, billingType: value }))}
                  className={`rounded-xl border p-4 text-left transition-colors ${form.billingType === value ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30" : "border-border hover:border-violet-300"}`}
                  data-testid={`billing-${value.toLowerCase()}`}
                >
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
                </button>
              ))}
            </div>
          </div>
          {isPrepaid ? (
            <>
              <div className="rounded-xl border border-border bg-background p-4 space-y-4">
                <div><Label className="font-semibold">Invoice amount (ZAR) *</Label><p className="mt-1 text-xs text-muted-foreground">Enter the quote already accepted by the customer. No online payment is taken.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Service subtotal *</Label><Input type="number" min="0" step="0.01" value={form.invoiceSubtotal} onChange={e=>setForm(f=>({...f,invoiceSubtotal:e.target.value}))} placeholder="600.00" required /></div>
                  <div className="space-y-2"><Label>Additional charges</Label><Input type="number" min="0" step="0.01" value={form.invoiceAdditionalCharges} onChange={e=>setForm(f=>({...f,invoiceAdditionalCharges:e.target.value}))} placeholder="0.00" /></div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-3"><span className="text-sm text-muted-foreground">Invoice total</span><span className="text-xl font-bold">ZAR {invoiceTotal.toFixed(2)}</span></div>
              </div>
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">The invoice starts as <strong>Pending Payment</strong>. Shipment tracking stays locked until an admin confirms payment manually.</div>
            </>
          ) : (
            <div className="rounded-xl bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">No invoice is created yet. The shipment can start immediately, and you'll invoice this Job after it's delivered.</div>
          )}
          </section>
          )}
          <div className="flex items-center gap-3 pt-1">
            {step > 1 && (
              <Button type="button" variant="outline" className="h-12 rounded-xl px-5" onClick={() => setStep(s => s - 1)}>Back</Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                size="lg"
                className="h-12 flex-1 rounded-xl text-[15px]"
                disabled={step === 1 ? !step1Ok : !step2Ok}
                onClick={() => setStep(s => s + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                className="h-12 flex-1 rounded-xl text-[15px]"
                disabled={createMutation.isPending || !step1Ok || !step2Ok || !step3Ok}
              >
                {createMutation.isPending ? (isPrepaid ? "Creating and sending invoice..." : "Creating Job...") : (isPrepaid ? "Create Job & Send Invoice" : "Create Job")}
              </Button>
            )}
          </div>
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
  const { data: orderStats, isLoading: loadingOrderStats } = useDashboardStats(user?.businessId);
  const orderStatusChart = Object.entries(orderStats?.statusBreakdown ?? {})
    .map(([status, count]) => ({
      status,
      label: status.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuerySearch(search);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setQuerySearch("");
    setStatusFilter("all");
    setPage(1);
  };

  const hasActiveFilters = Boolean(querySearch || statusFilter !== "all");

  const transportIcon = (mode: string | null) => {
    if (mode === "AIR") return Plane;
    if (mode === "SEA") return Ship;
    return Truck;
  };

  return (
    <div className="space-y-6 pb-8">
      <section className="rounded-3xl border border-border/70 bg-card p-4 shadow-sm sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(240px,0.7fr)_minmax(420px,1.3fr)] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <ClipboardCheck className="h-4 w-4 text-primary" /> Jobs
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight">Manage jobs</h1>
            <p className="mt-1 max-w-md text-sm leading-5 text-muted-foreground">Create, find and update customer shipments.</p>
            <div className="mt-4"><CreateOrderDialog onSuccess={() => refetch()} businessId={user?.businessId ?? ""} /></div>
          </div>

          <div className="border-t border-border/60 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
              <div><h2 className="text-sm font-semibold">Jobs by status</h2><p className="text-xs text-muted-foreground">A quick workload snapshot</p></div>
              {orderStats && <p className="whitespace-nowrap text-xs text-muted-foreground"><span className="font-semibold text-foreground">{orderStats.totalOrders}</span> total</p>}
            </div>
            <div className="mt-2">
              {loadingOrderStats ? <Skeleton className="h-32 w-full rounded-xl" /> : orderStatusChart.length === 0 ? <div className="grid h-28 place-items-center rounded-xl bg-muted/20 text-center"><p className="text-xs text-muted-foreground">Status activity will appear here.</p></div> : <div className="h-32 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={orderStatusChart} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 0 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))"/><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{fontSize:10,fill:"hsl(var(--muted-foreground))"}}/><YAxis type="category" dataKey="label" width={112} axisLine={false} tickLine={false} tick={{fontSize:10,fill:"hsl(var(--muted-foreground))"}}/><Tooltip cursor={{fill:"hsl(var(--muted) / 0.35)"}} contentStyle={{borderRadius:10,border:"1px solid hsl(var(--border))",background:"hsl(var(--card))",fontSize:11}}/><Bar dataKey="count" name="Orders" fill="hsl(var(--primary))" radius={[0,5,5,0]} maxBarSize={14}/></BarChart></ResponsiveContainer></div>}
            </div>
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="space-y-4 border-b border-border/60 bg-muted/20 p-4 sm:p-5">
          <div className="flex items-end justify-between gap-3">
            <div><h2 className="text-lg font-semibold">All jobs</h2><p className="mt-0.5 text-sm text-muted-foreground">{data?.total ?? 0} {data?.total === 1 ? "job" : "jobs"}{hasActiveFilters ? " found" : " in your workspace"}</p></div>
            {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={clearFilters}><RotateCcw className="h-3.5 w-3.5" /> Clear</Button>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="h-11 rounded-xl border-border/80 bg-background pl-9" placeholder="Search Job number, tracking ID, supplier, or customer" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button type="submit" variant="secondary" className="h-11 rounded-xl px-4">Search</Button>
            </form>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="h-11 w-full rounded-xl bg-background sm:w-[220px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="All statuses" /></SelectTrigger>
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
            <div className="px-5 py-14 text-center sm:py-20">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="h-8 w-8" /></div>
              <h3 className="mt-5 text-lg font-semibold">{hasActiveFilters ? "No matching jobs" : "Your jobs will appear here"}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{hasActiveFilters ? "Try a different search term or clear the filters to see all jobs." : "Create a job once the customer accepts their quote. Prepaid jobs invoice automatically; postpaid jobs invoice after delivery."}</p>
              {hasActiveFilters && <Button variant="outline" className="mt-5 rounded-xl" onClick={clearFilters}>Clear filters</Button>}
            </div>
          ) : (
            <>
              <div className="hidden md:block"><Table>
                <TableHeader>
                  <TableRow className="bg-muted/20 hover:bg-muted/20">
                    <TableHead className="pl-5">Job</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Billing</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Est. Delivery</TableHead>
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
                      <TableCell className="py-4 pl-5">
                        <span className="font-mono text-sm font-semibold">{order.job_number ?? order.order_reference ?? order.tracking_id}</span>
                        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{order.tracking_id}</p>
                      </TableCell>
                      <TableCell><p className="font-medium">{order.customers?.full_name ?? "Unknown customer"}</p><p className="mt-1 text-xs text-muted-foreground">Updated {format(new Date(order.updated_at), "MMM d, HH:mm")}</p></TableCell>
                      <TableCell>{(() => { const Icon = transportIcon(order.transport_mode); return <div className="flex items-center gap-2 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span><span>{order.transport_mode ? TRANSPORT_MODE_LABELS[order.transport_mode as TransportMode] ?? order.transport_mode : "Not set"}</span></div>; })()}</TableCell>
                      <TableCell><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${order.billing_type === "POSTPAID" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{order.billing_type === "POSTPAID" ? "After delivery" : "Before delivery"}</span></TableCell>
                      <TableCell><StatusBadge status={order.current_status} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {order.estimated_delivery_date ? format(new Date(order.estimated_delivery_date), "MMM d, yyyy") : "-"}
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                        <Link href={`/orders/${order.id}`}>
                          <Button size="sm" variant="ghost" className="h-9 gap-1.5 rounded-lg text-xs">
                            Open <ArrowRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table></div>

              <div className="divide-y divide-border/60 md:hidden">
                {data.orders.map(order => {
                  const Icon = transportIcon(order.transport_mode);
                  return <Link key={order.id} href={`/orders/${order.id}`} className="block p-4 transition-colors hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-sm font-semibold">{order.job_number ?? order.order_reference ?? order.tracking_id}</p><p className="mt-1 truncate text-sm text-muted-foreground">{order.customers?.full_name ?? "Unknown customer"}</p></div><StatusBadge status={order.current_status} /></div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{order.transport_mode ? TRANSPORT_MODE_LABELS[order.transport_mode as TransportMode] ?? order.transport_mode : "Transport not set"}</span><span className="flex items-center gap-1 text-foreground">Open <ArrowRight className="h-3.5 w-3.5" /></span></div>
                  </Link>;
                })}
              </div>

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
