import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useOrder,
  useBusiness,
  useUpdateOrderStatus,
  useSendNotification,
  useNotificationLogs,
} from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/status-badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft,
  Copy,
  Check,
  Mail,
  RefreshCw,
  MapPin,
  ExternalLink,
  House,
  PackageX,
  ChevronDown,
  Building2,
  Phone,
  Clock,
  Activity,
  Package,
  User,
  Send,
  CheckCircle2,
  Edit,
  ReceiptText,
  Trash2,
  Warehouse,
} from "lucide-react";
import { EmptyState } from "@/components/page-loader";
import { toast } from "sonner";
import { format } from "date-fns";
import { apiFetch } from "@/lib/api";
import {
  statusChoices,
  isTerminal,
  getStatusVisual,
  isLogisticsTerminal,
  logisticsStatusLabel,
  nextLogisticsStatus,
  remainingLogisticsStatuses,
  TRANSPORT_MODE_LABELS,
  type TransportMode,
} from "@/lib/order-statuses";

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors border hover:bg-muted/50"
      title={copied ? "Copied" : "Copy to clipboard"}
      aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
    >
      {copied
        ? <Check className="h-3.5 w-3.5 text-green-600" />
        : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

// ─── Status picker ────────────────────────────────────────────────────────────

function StatusPicker({
  currentStatus,
  selected,
  onSelect,
  transportMode,
}: {
  currentStatus: string;
  selected: string;
  onSelect: (s: string) => void;
  transportMode?: string | null;
}) {
  // Transport-aware orders follow their mode's fixed flow: the next stage is
  // primary, later stages are offered as "skip ahead" options (e.g. combining
  // steps), and generic exception statuses don't apply.
  let primaryStep: string;
  let exceptionSteps: string[];
  let exceptionsHeading = "Exceptions";
  if (transportMode) {
    const next = nextLogisticsStatus(transportMode, currentStatus);
    if (!next) return null;
    primaryStep = next;
    exceptionSteps = remainingLogisticsStatuses(transportMode, currentStatus).filter(
      (s) => s !== next,
    );
    exceptionsHeading = "Skip ahead";
  } else {
    const choices = statusChoices(currentStatus);
    if (!choices) return null;
    primaryStep = choices.primary;
    exceptionSteps = choices.exceptions;
  }

  const renderButton = (step: string, isPrimary: boolean) => {
    const cfg = getStatusVisual(step);
    const Icon = cfg.icon;
    const isSelected = selected === step;

    return (
      <button
        key={step}
        type="button"
        onClick={() => onSelect(isSelected ? "" : step)}
        className={`group relative flex items-center gap-3 w-full px-4 py-3 border-2 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          isSelected
            ? "bg-foreground border-foreground"
            : isPrimary
            ? "bg-background border-foreground hover:bg-muted/40"
            : `${cfg.bg} ${cfg.border} hover:opacity-90`
        }`}
      >
        <span className={`flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0 ${
          isSelected
            ? "bg-background/20"
            : isPrimary
            ? `${cfg.bg} border ${cfg.border}`
            : "bg-white/60"
        }`}>
          <Icon className={`h-4 w-4 ${
            isSelected
              ? "text-background"
              : cfg.iconColor
          }`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${
            isSelected ? "text-background" : "text-foreground"
          }`}>{cfg.label}</p>
          {isPrimary && !isSelected && (
            <p className="text-xs text-muted-foreground">Recommended next step</p>
          )}
        </div>
        {isSelected && (
          <Check className="h-4 w-4 text-background flex-shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="space-y-2">
      {renderButton(primaryStep, true)}
      {exceptionSteps.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider pt-1">
            {exceptionsHeading}
          </p>
          <div className="flex flex-wrap gap-2">
            {exceptionSteps.map((step) => {
              const cfg = getStatusVisual(step);
              const Icon = cfg.icon;
              const isSelected = selected === step;
              return (
                <button
                  key={step}
                  type="button"
                  onClick={() => onSelect(isSelected ? "" : step)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isSelected
                      ? "bg-foreground text-background border-foreground"
                      : `${cfg.bg} ${cfg.border} ${cfg.iconColor} hover:opacity-80`
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isSelected ? "text-background" : ""}`} />
                  <span className={isSelected ? "text-background" : ""}>{cfg.label}</span>
                  {isSelected && <Check className="h-3 w-3 text-background ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: order, isLoading, refetch } = useOrder(id);
  const { data: business } = useBusiness(user?.businessId);
  const { data: notificationLogs } = useNotificationLogs(id);
  const updateStatusMutation = useUpdateOrderStatus();
  const resendMutation = useSendNotification();

  const [statusForm, setStatusForm] = useState({
    status: "",
    location: "",
  });
  const [supplierTracking, setSupplierTracking] = useState("");
  const [savingSupplierTracking, setSavingSupplierTracking] = useState(false);
  const [invoiceSubtotal, setInvoiceSubtotal] = useState("");
  const [invoiceCharges, setInvoiceCharges] = useState("0");
  const [invoiceCost, setInvoiceCost] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [editOpen,setEditOpen]=useState(false);
  const [editForm,setEditForm]=useState({orderReference:"",description:"",cargoType:"",serviceRequired:"",origin:"",destination:"",weight:"",dimensions:"",estimatedDeliveryDate:""});
  const editOrder=useMutation({mutationFn:()=>apiFetch(`/api/orders/${id}`,{method:"PUT",body:editForm}),onSuccess:async()=>{await queryClient.invalidateQueries({queryKey:["order",id]});toast.success("Order updated");setEditOpen(false);refetch();},onError:(error:Error)=>toast.error(error.message)});
  const openOrderEdit=()=>{if(!order)return;setEditForm({orderReference:order.order_reference??"",description:order.description??"",cargoType:order.cargo_type??"",serviceRequired:order.service_required??"",origin:order.origin??"",destination:order.destination??"",weight:order.weight??"",dimensions:order.dimensions??"",estimatedDeliveryDate:order.estimated_delivery_date??""});setEditOpen(true);};
  const deleteOrder = useMutation({ mutationFn: () => apiFetch(`/api/orders/${id}`, { method: "DELETE" }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ["orders"] }); toast.success("Order and its linked invoice deleted"); navigate("/orders"); }, onError: (error: Error) => toast.error(error.message) });
  const invoiceStatus = (order as (typeof order & { invoice_status?: string | null }))?.invoice_status ?? null;
  const isPostpaid = order?.billing_type === "POSTPAID";
  const companyName = business?.name ?? "Company";
  const isDelivered = order?.current_status === "DELIVERED_COLLECTED" || order?.current_status === "DELIVERED";
  // Billing status is tracked separately from the shipment status. Prefer the
  // stored billing_status; fall back to deriving from the invoice for legacy
  // Jobs whose column wasn't backfilled.
  const rawBilling = order?.billing_status ?? "NOT_INVOICED";
  const billingStatus =
    rawBilling === "NOT_INVOICED" && order?.invoice_id
      ? invoiceStatus === "paid" ? "PAID" : invoiceStatus === "sent" || invoiceStatus === "overdue" ? "AWAITING_PAYMENT" : "INVOICED"
      : rawBilling;
  const BILLING_LABEL: Record<string, string> = { NOT_INVOICED: "Not yet invoiced", INVOICED: "Invoiced", AWAITING_PAYMENT: "Awaiting payment", PAID: "Paid" };
  const billingLabel = BILLING_LABEL[billingStatus] ?? "Not yet invoiced";
  // POSTPAID Jobs are never gated on payment - they're invoiced after delivery.
  // PREPAID Jobs need a paid (or absent, for legacy) invoice before the shipment
  // can progress. Billing and shipment are otherwise independent.
  const paymentConfirmed = isPostpaid || !order?.invoice_id || billingStatus === "PAID";
  // Supplier tracking is optional and never blocks shipment progression.
  const shipmentUpdatesUnlocked = paymentConfirmed;
  const saveSupplierTracking = async () => {
    if (!id || !supplierTracking.trim()) return;
    setSavingSupplierTracking(true);
    try {
      await apiFetch(`/api/orders/${id}/supplier-tracking`, { method: "POST", body: { supplierTrackingNumber: supplierTracking } });
      toast.success("Supplier tracking number saved"); setSupplierTracking(""); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save supplier tracking number"); }
    finally { setSavingSupplierTracking(false); }
  };
  const createInvoice = async (send = false) => {
    if (!id || !invoiceSubtotal.trim()) return;
    setCreatingInvoice(true);
    try {
      const invoice = await apiFetch<{id:string}>("/api/invoices", { method: "POST", body: { orderId: id, subtotal: invoiceSubtotal, additionalCharges: invoiceCharges, currency: "ZAR", ...(invoiceCost.trim() ? { cost: invoiceCost.trim() } : {}) } });
      if (send) {
        // Close-the-job flow: create the invoice and email it to the customer
        // in one action, then open it so the admin can confirm payment later.
        try {
          await apiFetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
          toast.success("Invoice created and emailed to the customer");
        } catch {
          toast.warning("Invoice created, but the email couldn't be sent. Open it to resend.");
        }
      } else {
        toast.success("Draft invoice generated");
      }
      refetch();
      window.location.href = `${import.meta.env.BASE_URL}invoices/${invoice.id}`;
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to generate invoice"); }
    finally { setCreatingInvoice(false); }
  };

  const handleStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!statusForm.status) return;
    updateStatusMutation.mutate(
      {
        orderId: id!,
        businessId: user!.businessId,
        status: statusForm.status,
        location: statusForm.location || undefined,
        userId: user!.id,
      },
      {
        onSuccess: (data) => {
          if (data?.emailStatus === "limit_reached") {
            toast.warning(
              `Status updated, but the status update wasn't sent - you've reached this month's status-update limit (${data.emailUsage ?? ""}/${data.emailLimit ?? ""}). Upgrade to keep notifying customers.`,
            );
          } else if (data?.emailStatus === "failed") {
            toast.warning(`Status updated to "${statusForm.status}", but the status update failed to send.`);
          } else {
            toast.success(`Status updated to "${statusForm.status}". Customer will be notified.`);
          }
          setStatusForm({ status: "", location: "" });
          refetch();
        },
        onError: () => toast.error("Failed to update status"),
      }
    );
  };

  const handleResend = () => {
    resendMutation.mutate(
      { orderId: id! },
      {
        onSuccess: (data) => {
          if (data?.emailStatus === "limit_reached") {
            toast.warning(
              data.message ||
                "Monthly status-update limit reached. Upgrade to send more.",
            );
          } else if (!data?.success) {
            toast.error(data?.message || "Failed to resend status update");
          } else {
            toast.success("Status update resent to customer");
          }
          refetch();
        },
        onError: () => toast.error("Failed to resend status update"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-6xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-5">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {    return (
      <EmptyState
        icon={<PackageX className="h-12 w-12" />}
        title="Order not found"
        description="This order may have been deleted or the tracking link is incorrect."
        action={
          <Link href="/orders">
            <Button variant="outline" size="sm" className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to orders
            </Button>
          </Link>
        }
      />
    );
  }

  const lastEvent = (order.tracking_events as any[])?.[0];
  return (
    <div className="space-y-6 max-w-6xl pb-8">

      {/* Nav + resend */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Orders
          </Button>
        </Link>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" className="rounded-xl" onClick={openOrderEdit}><Edit className="mr-1 h-3.5 w-3.5"/>Edit order</Button><Button
          variant="outline"
          size="sm"
          className="gap-2 rounded-xl"
          onClick={handleResend}
          disabled={resendMutation.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
          Resend update
        </Button><Button variant="ghost" size="sm" className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={deleteOrder.isPending} onClick={() => { if (window.confirm(`Permanently delete order ${order.tracking_id}, its invoice, and tracking history?`)) deleteOrder.mutate(); }}><Trash2 className="mr-1 h-3.5 w-3.5"/>Delete</Button></div>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen}><SheetContent className="w-[420px] overflow-y-auto"><SheetHeader><SheetTitle>Edit order</SheetTitle></SheetHeader><form className="mt-6 space-y-3" onSubmit={e=>{e.preventDefault();editOrder.mutate();}}>{([['orderReference','Reference'],['description','Description'],['cargoType','Cargo / invoice item'],['serviceRequired','Service required'],['origin','Origin'],['destination','Destination'],['weight','Weight'],['dimensions','Dimensions'],['estimatedDeliveryDate','Estimated delivery date']] as const).map(([key,label])=><div className="space-y-1.5" key={key}><Label>{label}</Label><Input type={key==='estimatedDeliveryDate'?'date':'text'} value={editForm[key]} onChange={e=>setEditForm(f=>({...f,[key]:e.target.value}))}/></div>)}<Button className="w-full" disabled={editOrder.isPending}>{editOrder.isPending?'Saving...':'Save order changes'}</Button></form></SheetContent></Sheet>

      {/* Order identity */}
      <div className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm">
        <div className="bg-gradient-to-br from-primary/[0.09] via-background to-background p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary">Job overview</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{order.job_number ?? order.order_reference ?? order.tracking_id}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{companyName} Tracking ID: {order.tracking_id}</span><span>•</span><span>Created {format(new Date(order.created_at), "MMM d, yyyy · HH:mm")}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2"><StatusBadge status={order.current_status} />{order.transport_mode && <span className="rounded-lg border bg-background/70 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{TRANSPORT_MODE_LABELS[order.transport_mode as TransportMode] ?? order.transport_mode}</span>}</div>
          </div>
        </div>
        <div className="grid border-t border-border/60 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-4 sm:p-5 border-b border-border/60 sm:border-r lg:border-b-0"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><ReceiptText className="h-4 w-4"/>Billing</div><p className={`mt-2 text-sm font-semibold ${billingStatus === "PAID" ? "text-emerald-700" : billingStatus === "AWAITING_PAYMENT" ? "text-amber-700" : "text-foreground"}`}>{isPostpaid ? "POSTPAID" : "PREPAID"} · {billingLabel}</p><p className="mt-0.5 text-xs text-muted-foreground">{isPostpaid ? "Invoiced after delivery" : "Payment before shipment"}</p>{order.invoice_id && <Link href={`/invoices/${order.invoice_id}`} className="mt-1 inline-block text-xs text-primary hover:underline">View invoice</Link>}</div>
          <div className="p-4 sm:p-5 border-b border-border/60 lg:border-b-0 lg:border-r"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Package className="h-4 w-4"/>Shipment</div><p className="mt-2 text-sm font-semibold">{order.transport_mode ? logisticsStatusLabel(order.current_status) : order.current_status}</p><p className="mt-1 text-xs text-muted-foreground">{shipmentUpdatesUnlocked ? "Updates available" : paymentConfirmed ? "Waiting for warehouse" : "Starts after payment"}</p></div>
          <div className="p-4 sm:p-5 border-b border-border/60 sm:border-r sm:border-b-0"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><MapPin className="h-4 w-4"/>Route</div><p className="mt-2 truncate text-sm font-semibold">{order.origin || "Origin not added"} → {order.destination || "Destination not added"}</p>{order.estimated_delivery_date && <p className="mt-1 text-xs text-muted-foreground">ETA {format(new Date(order.estimated_delivery_date), "MMM d, yyyy")}</p>}</div>
          <div className="p-4 sm:p-5"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><User className="h-4 w-4"/>Customer</div>{order.customers ? <><Link href={`/customers/${order.customers.id}`} className="mt-2 flex items-center gap-1 text-sm font-semibold hover:text-primary">{order.customers.full_name}<ExternalLink className="h-3 w-3"/></Link><p className="mt-1 truncate text-xs text-muted-foreground">{order.customers.company_name || order.customers.email}</p></> : <p className="mt-2 text-sm text-muted-foreground">No customer linked</p>}</div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left - main actions */}
        <div className="lg:col-span-2 space-y-6">

          {/* Operations Control */}
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">What happens next</CardTitle>
              <p className="text-xs text-muted-foreground">
                This area only shows the action currently available to staff.
              </p>
            </CardHeader>
            <CardContent>
              {!paymentConfirmed ? (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-5 space-y-3">
                  <div>
                    <p className="font-semibold text-amber-950">Invoice has not been paid</p>
                    <p className="mt-1 text-sm text-amber-800">Confirm payment from the linked invoice before shipment status updates can begin.</p>
                  </div>
                  {order.invoice_id ? <Link href={`/invoices/${order.invoice_id}`}><Button className="rounded-xl"><ReceiptText className="mr-2 h-4 w-4" />Open invoice and confirm payment</Button></Link> : null}
                </div>
              ) : !shipmentUpdatesUnlocked ? (
                <div className="rounded-2xl border bg-muted/30 px-4 py-6 text-center">
                  <Warehouse className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
                  <p className="text-sm font-semibold">Waiting for the China warehouse</p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-muted-foreground">Payment is confirmed. Record the supplier tracking number in Internal handling when the cargo arrives; customer shipment updates will then unlock.</p>
                </div>
              ) : (order.transport_mode
                ? isLogisticsTerminal(order.current_status)
                : isTerminal(order.current_status)) ? (
                <div className="border bg-muted/40 px-4 py-8 text-center space-y-1">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm font-medium">
                    This order is{" "}
                    <span className="font-semibold">
                      {order.transport_mode
                        ? logisticsStatusLabel(order.current_status)
                        : order.current_status}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">No further updates are possible.</p>
                </div>
              ) : (
                <form onSubmit={handleStatusUpdate} className="space-y-5">

                  {/* Status selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Select Next Status
                    </Label>
                    <StatusPicker
                      currentStatus={order.current_status}
                      selected={statusForm.status}
                      onSelect={(s) => setStatusForm(f => ({ ...f, status: s }))}
                      transportMode={order.transport_mode}
                    />
                    {!statusForm.status && (
                      <p className="text-xs text-muted-foreground">
                        Click a status above to enable the update.
                      </p>
                    )}
                  </div>

                  {/* Location */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-normal text-muted-foreground">
                      Location{" "}
                      <span className="text-muted-foreground/60">(optional - shown in timeline)</span>
                    </Label>
                    <Input
                      value={statusForm.location}
                      onChange={e => setStatusForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Johannesburg Hub"
                    />
                  </div>

                  {/* Submit */}
                  <Button
                    type="submit"
                    disabled={!statusForm.status || updateStatusMutation.isPending}
                    size="lg"
                    className={`w-full gap-2 h-11 font-semibold transition-all ${
                      statusForm.status && !updateStatusMutation.isPending
                        ? "bg-foreground text-background hover:bg-foreground/90 border-transparent"
                        : ""
                    }`}
                  >
                    <Send className="h-4 w-4" />
                    {updateStatusMutation.isPending
                      ? "Updating and notifying customer…"
                      : statusForm.status
                      ? `Update status and notify ${order.customers?.full_name?.split(" ")[0] ?? "customer"}`
                      : "Update status and notify customer"}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {!(order.tracking_events as any[])?.length ? (
                <div className="text-center py-6">
                  <Activity className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">No tracking events yet.</p>
                </div>
              ) : (
                <ol className="space-y-0">
                  {(order.tracking_events as any[]).map((event: any, idx: number) => {
                    const cfg = getStatusVisual(event.status);
                    const Icon = cfg.icon;
                    const isLatest = idx === 0;
                    const isLast = idx === (order.tracking_events as any[]).length - 1;

                    return (
                      <li key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center w-10 flex-shrink-0">
                          <div className={`h-9 w-9 flex items-center justify-center border-2 ${
                            isLatest ? `${cfg.bg} ${cfg.border}` : "bg-background border-border"
                          }`}>
                            <Icon className={`h-4 w-4 ${isLatest ? cfg.iconColor : "text-muted-foreground/40"}`} />
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-border min-h-[1.5rem]" />}
                        </div>
                        <div className={`min-w-0 flex-1 pt-1 ${isLast ? "" : "pb-6"}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${!isLatest ? "text-muted-foreground" : ""}`}>
                              {cfg.label}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground border px-1.5 py-0.5">
                                Latest
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {format(new Date(event.created_at), "MMM d, yyyy · HH:mm")}
                            </span>
                          </div>
                          {order.current_status === "Delivered" && (
                            <div className="mt-2 inline-flex items-center gap-2 px-2.5 py-1 bg-green-50 border border-green-200 w-fit">
                              <House className="h-3.5 w-3.5 text-green-600" />
                              <span className="text-[11px] font-semibold text-green-700 tracking-wide uppercase">
                                Package received by customer
                              </span>
                            </div>
                          )}
                          {event.message && (
                            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                              {event.message}
                            </p>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1.5">
                              <MapPin className="h-3 w-3" /> {event.location}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Email History */}
          <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-base font-semibold">Status updates</span>
                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 border">
                      {notificationLogs?.length ?? 0}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-2 pt-0">
                  {!notificationLogs?.length ? (
                    <p className="text-sm text-muted-foreground">No status updates sent yet.</p>
                  ) : (
                    notificationLogs.map((notif: any) => (
                      <div key={notif.id} className="flex items-start justify-between gap-3 p-3 border bg-muted/20">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{notif.subject}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">To: {notif.recipient_email}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(notif.created_at), "MMM d, yyyy · HH:mm")}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 flex-shrink-0 border ${
                          notif.status === "sent"
                            ? "text-green-700 border-green-200 bg-green-50"
                            : notif.status === "failed"
                            ? "text-red-700 border-red-200 bg-red-50"
                            : "text-muted-foreground border-border bg-muted"
                        }`}>
                          {notif.status}
                        </span>
                      </div>
                    ))
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">

          {/* Customer */}
          {order.customers && (
            <Card className="rounded-3xl border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Customer contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <Link
                    href={`/customers/${order.customers.id}`}
                    className="text-sm font-semibold hover:text-primary transition-colors flex items-center gap-1"
                  >
                    {order.customers.full_name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                  {order.customers.company_name && (
                    <p className="text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {order.customers.company_name}
                    </p>
                  )}
                </div>
                <Separator />
                <div className="space-y-1.5">
                  {order.customers.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{order.customers.email}</span>
                    </div>
                  )}
                  {order.customers.phone && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Phone className="h-3 w-3 flex-shrink-0" />
                      {order.customers.phone}
                    </div>
                  )}
                  {order.customers.address && (
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="h-3 w-3 flex-shrink-0 mt-0.5" />
                      <span className="leading-snug">{order.customers.address}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order details */}
          <Card className="rounded-3xl border-border/70 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />
                Shipment details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              {order.description && (
                <div>
                  <p className="text-muted-foreground uppercase font-medium mb-0.5">Description</p>
                  <p className="text-sm">{order.description}</p>
                </div>
              )}
              {order.estimated_delivery_date && (
                <div>
                  <p className="text-muted-foreground uppercase font-medium mb-0.5">Est. Delivery</p>
                  <p className="text-sm">{format(new Date(order.estimated_delivery_date), "MMMM d, yyyy")}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">Last Updated</p>
                <p className="text-sm">{format(new Date(order.updated_at), "MMM d, yyyy · HH:mm")}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">Job Number</p>
                <p className="text-sm font-mono">{order.job_number ?? order.order_reference ?? "-"}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">Billing Type</p>
                <p className="text-sm">{isPostpaid ? "Invoice After Delivery" : "Invoice Before Delivery"}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">{companyName} Tracking ID</p>
                <p className="text-sm font-mono">{order.tracking_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">Supplier Tracking Number</p>
                {order.supplier_tracking_number ? (
                  <div className="rounded-xl bg-muted/40 p-3"><p className="text-[11px] text-muted-foreground">From the supplier / warehouse / courier · staff only</p><p className="mt-1 text-sm font-mono font-semibold">{order.supplier_tracking_number}</p></div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Optional. Add it whenever the supplier, warehouse, or courier provides one - it never blocks the shipment.</p>
                    {/* Supplier tracking is optional and can be added at any pre-delivery
                        stage. For PREPAID it still requires payment first (the API
                        enforces that); POSTPAID can add it any time. */}
                    {order.transport_mode && !isDelivered && (isPostpaid || paymentConfirmed) ? (
                      <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                        <Input value={supplierTracking} onChange={e => setSupplierTracking(e.target.value)} placeholder="Enter supplier tracking number"/>
                        <Button className="w-full rounded-xl" size="sm" disabled={savingSupplierTracking || !supplierTracking.trim()} onClick={saveSupplierTracking}>{order.current_status === "PENDING_TRACKING_NUMBER" ? "Save & mark received from supplier" : "Save supplier tracking number"}</Button>
                        <p className="text-[11px] leading-4 text-muted-foreground">This number is internal and is never shown to the customer.</p>
                      </div>
                    ) : !paymentConfirmed && !isPostpaid ? (
                      <p className="text-[11px] text-amber-700">Confirm payment first to record a supplier tracking number.</p>
                    ) : null}
                  </div>
                )}
              </div>
              {order.invoice_id && <div className="space-y-2 rounded-xl border p-3"><p className="text-muted-foreground uppercase font-medium">Invoice</p><p className={`text-sm font-semibold ${invoiceStatus === "paid" ? "text-green-700" : "text-amber-700"}`}>{invoiceStatus === "paid" ? "Paid · manually confirmed" : "Pending payment · confirmation required"}</p><Link className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline" href={`/invoices/${order.invoice_id}`}>Open invoice <ExternalLink className="h-3 w-3" /></Link></div>}
              {!order.invoice_id && <div className={`space-y-2 rounded-xl border p-3 ${isPostpaid && isDelivered ? "border-primary/50 bg-primary/[0.05]" : "border-t"}`}>
                <p className={`uppercase font-medium ${isPostpaid && isDelivered ? "text-primary" : "text-muted-foreground"}`}>{isPostpaid && isDelivered ? "Final step - invoice & close this Job" : "Generate invoice"}</p>
                {isPostpaid && isDelivered && <p className="text-xs text-muted-foreground">Delivered. Enter the final amount and we’ll create the invoice and email it to the customer. Confirm payment afterwards to fully close the Job.</p>}
                <div className="space-y-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Charge the customer</p>
                  <Input value={invoiceSubtotal} onChange={e=>setInvoiceSubtotal(e.target.value)} placeholder="Subtotal (ZAR)"/>
                  <Input value={invoiceCharges} onChange={e=>setInvoiceCharges(e.target.value)} placeholder="Additional charges"/>
                </div>
                <div className="space-y-1 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 p-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Your cost for this job <span className="normal-case text-muted-foreground/70">· internal only</span></p>
                  <Input value={invoiceCost} onChange={e=>setInvoiceCost(e.target.value)} placeholder="What this job cost you (optional)"/>
                  <p className="text-[11px] leading-4 text-muted-foreground">Never shown to the customer or on the invoice. Feeds the Finance tab so you can see profit per job. You can leave this blank and add costs later.</p>
                </div>
                <Button size="sm" disabled={creatingInvoice||!invoiceSubtotal.trim()} onClick={()=>createInvoice(isPostpaid && isDelivered)}>{creatingInvoice ? "Working…" : isPostpaid && isDelivered ? "Create & send invoice" : "Generate draft invoice"}</Button>
              </div>}
              {isDelivered && order.invoice_id && invoiceStatus === "paid" && <div className="flex items-center gap-2 rounded-xl border border-green-500/40 bg-green-50 p-3 text-sm font-semibold text-green-700 dark:bg-green-950/30 dark:text-green-300"><CheckCircle2 className="h-4 w-4"/>Job complete - delivered &amp; paid.</div>}
              {(order.origin || order.destination) && <div><p className="text-muted-foreground uppercase font-medium mb-0.5">Route</p><p className="text-sm">{order.origin || "-"} → {order.destination || "-"}</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
