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
import { Plus, Search, Package, Check, ChevronsUpDown, ArrowRight, ClipboardCheck, Filter, Plane, RotateCcw, Ship, Truck } from "lucide-react";
import { toast } from "sonner";
import { format, isValid } from "date-fns";
import { ORDER_STATUSES, TRANSPORT_MODES, TRANSPORT_MODE_LABELS, type TransportMode } from "@/lib/order-statuses";

function displayDate(value: string | Date | null | undefined, pattern = "MMM d, yyyy", fallback = "-") {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? format(date, pattern) : fallback;
}

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
  const STEP_SUBTITLES = ["Who is this Job for?", "Where's it going and what's inside?", "Reference and how it's billed"];
  // Clean, Apple-style field: tall, soft-filled, gentle focus.
  const field = "h-11 rounded-xl border-transparent bg-muted/50 shadow-none focus-visible:bg-background focus-visible:border-border focus-visible:ring-0";
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
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-[560px]">
        <DialogHeader className="space-y-0 px-7 pb-0 pt-7 text-left">
          <DialogTitle className="text-[22px] font-semibold tracking-tight">New Job</DialogTitle>
          <p className="pt-1 text-[15px] text-muted-foreground">{STEP_SUBTITLES[step - 1]}</p>
          {/* Slim segmented progress */}
          <div className="flex items-center gap-1.5 pt-5">
            {STEP_LABELS.map((lbl, i) => (
              <div key={lbl} className={`h-1.5 flex-1 rounded-full transition-colors ${i + 1 <= step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="pt-2 text-xs font-medium text-muted-foreground">Step {step} of 3 · {STEP_LABELS[step - 1]}</p>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-7 py-6">
          {step === 1 && (
          <div className="space-y-2.5">
            <Label className="text-[13px] font-medium text-muted-foreground">Customer</Label>
            <Popover open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerPickerOpen}
                  className={`w-full justify-between px-3.5 font-normal ${field}`}
                  data-testid="button-select-customer"
                >
                  <span className={`truncate ${selectedCustomer ? "" : "text-muted-foreground"}`}>
                    {selectedCustomer ? selectedCustomer.label : "Select a customer"}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-40" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] rounded-xl p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search by name, email or company…"
                    value={customerSearch}
                    onValueChange={setCustomerSearch}
                  />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty>
                      {customersFetching ? "Searching…" : "No customers found."}
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
            <p className="text-[13px] text-muted-foreground">They'll receive the invoice and shipment updates.</p>
          </div>
          )}
          {step === 2 && (
          <div className="space-y-6">
            <div className="space-y-2.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Transport mode</Label>
              <div className="grid grid-cols-2 gap-2.5">
                {TRANSPORT_MODES.map(m => {
                  const on = form.transportMode === m;
                  const Icon = m === "AIR" ? Plane : Ship;
                  return (
                    <button key={m} type="button" onClick={() => setForm(f => ({ ...f, transportMode: m }))} className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-all ${on ? "border-primary bg-primary/[0.06] text-foreground shadow-sm" : "border-border/70 bg-muted/30 text-muted-foreground hover:border-border"}`}>
                      <Icon className="h-4 w-4" />{TRANSPORT_MODE_LABELS[m as TransportMode]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["origin", "Origin", "China"],
                ["destination", "Destination", "South Africa"],
                ["cargoType", "Cargo / invoice item", "e.g. Handbags"],
                ["serviceRequired", "Service required", "e.g. Customs & tax"],
                ["weight", "Weight", "e.g. 1.5 kg"],
                ["dimensions", "Dimensions (optional)", "e.g. 40 × 30 × 25 cm"],
              ] as const).map(([key, label, ph]) => (
                <div key={key} className="space-y-2">
                  <Label className="text-[13px] font-medium text-muted-foreground">{label}</Label>
                  <Input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} className={field} />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-muted-foreground">Handling notes (optional)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Quantity, packaging, fragile handling…" className="rounded-xl border-transparent bg-muted/50 focus-visible:border-border focus-visible:bg-background focus-visible:ring-0" />
            </div>
          </div>
          )}
          {step === 3 && (
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-muted-foreground">Job Number</Label>
                <Input value={form.jobNumber} onChange={e => setForm(f => ({ ...f, jobNumber: e.target.value }))} placeholder="CFS-0024" className={`font-mono ${field}`} />
              </div>
              <div className="space-y-2">
                <Label className="text-[13px] font-medium text-muted-foreground">Est. delivery (optional)</Label>
                <Input type="date" value={form.estimatedDeliveryDate} onChange={e => setForm(f => ({ ...f, estimatedDeliveryDate: e.target.value }))} className={field} />
              </div>
            </div>
            <div className="space-y-2.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Billing</Label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {([
                  ["PREPAID", "Invoice before delivery", "Invoice and payment before the shipment moves."],
                  ["POSTPAID", "Invoice after delivery", "Ship first, invoice once it's delivered."],
                ] as const).map(([value, title, desc]) => {
                  const on = form.billingType === value;
                  return (
                    <button key={value} type="button" onClick={() => setForm(f => ({ ...f, billingType: value }))} className={`relative rounded-2xl border p-4 text-left transition-all ${on ? "border-primary bg-primary/[0.05] shadow-sm" : "border-border/70 bg-muted/30 hover:border-border"}`} data-testid={`billing-${value.toLowerCase()}`}>
                      <span className={`absolute right-3 top-3 grid h-4 w-4 place-items-center rounded-full border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{on && <Check className="h-3 w-3" />}</span>
                      <div className="pr-5 text-sm font-semibold">{title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            {isPrepaid ? (
              <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
                <div className="flex items-center justify-between">
                  <Label className="text-[13px] font-medium">Invoice amount (ZAR)</Label>
                  <span className="text-lg font-semibold">ZAR {invoiceTotal.toFixed(2)}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="number" min="0" step="0.01" value={form.invoiceSubtotal} onChange={e => setForm(f => ({ ...f, invoiceSubtotal: e.target.value }))} placeholder="Subtotal" className="h-11 rounded-xl bg-background" />
                  <Input type="number" min="0" step="0.01" value={form.invoiceAdditionalCharges} onChange={e => setForm(f => ({ ...f, invoiceAdditionalCharges: e.target.value }))} placeholder="Additional charges" className="h-11 rounded-xl bg-background" />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">Sent as <strong className="font-medium text-foreground">Pending payment</strong>. The shipment stays locked until you confirm payment.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-muted/40 px-4 py-3.5 text-xs leading-relaxed text-muted-foreground">No invoice yet - the shipment can start right away, and you'll invoice this Job after it's delivered.</div>
            )}
          </div>
          )}
          <div className="mt-8 flex items-center gap-2.5">
            {step > 1 && (
              <Button type="button" variant="ghost" className="h-12 rounded-xl px-5 text-muted-foreground hover:text-foreground" onClick={() => setStep(s => s - 1)}>Back</Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                className="h-12 flex-1 rounded-xl text-[15px] font-medium"
                disabled={step === 1 ? !step1Ok : !step2Ok}
                onClick={() => setStep(s => s + 1)}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                className="h-12 flex-1 rounded-xl text-[15px] font-medium"
                disabled={createMutation.isPending || !step1Ok || !step2Ok || !step3Ok}
              >
                {createMutation.isPending ? "Creating…" : isPrepaid ? "Create Job & send invoice" : "Create Job"}
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
      <section
        className="relative min-h-[290px] overflow-hidden rounded-3xl border border-black/10 bg-cover bg-center p-4 shadow-sm sm:p-6"
        style={{ backgroundImage: "url('/jobs-directory-background.jpg')", backgroundPosition: "center 46%" }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-950/50 to-slate-950/25" />
        <div className="relative z-10 grid min-h-[242px] items-end gap-6 pt-16 lg:grid-cols-[minmax(240px,0.7fr)_minmax(420px,1.3fr)]">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              <ClipboardCheck className="h-4 w-4 text-white" /> Job workspace
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Jobs</h1>
            <p className="mt-1 max-w-md text-sm leading-5 text-white/75">Create a job after a quote is accepted, then manage its invoice and shipment updates here.</p>
          </div>
          <div className="w-full rounded-2xl border border-white/15 bg-black/25 p-3 backdrop-blur-sm">
            <p className="mb-2 text-xs font-semibold text-white">Find an existing job</p>
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input className="h-11 rounded-xl border-white/30 bg-white/95 pl-9 text-slate-950 placeholder:text-slate-500" placeholder="Job number, tracking ID or customer" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Button type="submit" className="h-11 rounded-xl bg-white px-5 text-slate-950 hover:bg-white/90">Find job</Button>
            </form>
          </div>
          <div className="absolute right-0 top-0 rounded-xl shadow-lg">
            <CreateOrderDialog onSuccess={() => refetch()} businessId={user?.businessId ?? ""} />
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-muted/20 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h2 className="text-lg font-semibold">Your jobs</h2><p className="mt-0.5 text-sm text-muted-foreground">{hasActiveFilters ? `${data?.total ?? 0} matching ${data?.total === 1 ? "job" : "jobs"}` : `${data?.total ?? 0} ${data?.total === 1 ? "job" : "jobs"} · Open one to see its next action`}</p></div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && <Button type="button" variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={clearFilters}><RotateCcw className="h-3.5 w-3.5" /> Clear</Button>}
              <span className="hidden text-xs font-medium text-muted-foreground sm:inline">Show</span>
              <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="h-10 w-full rounded-xl bg-background sm:w-[220px]"><Filter className="mr-2 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="All statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {ORDER_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
                      <TableCell><p className="font-medium">{order.customers?.full_name ?? "Unknown customer"}</p><p className="mt-1 text-xs text-muted-foreground">Updated {displayDate(order.updated_at, "MMM d, HH:mm", "recently")}</p></TableCell>
                      <TableCell>{(() => { const Icon = transportIcon(order.transport_mode); return <div className="flex items-center gap-2 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="h-4 w-4" /></span><span>{order.transport_mode ? TRANSPORT_MODE_LABELS[order.transport_mode as TransportMode] ?? order.transport_mode : "Not set"}</span></div>; })()}</TableCell>
                      <TableCell><span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${order.billing_type === "POSTPAID" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"}`}>{order.billing_type === "POSTPAID" ? "After delivery" : "Before delivery"}</span></TableCell>
                      <TableCell><StatusBadge status={order.current_status} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {displayDate(order.estimated_delivery_date)}
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
