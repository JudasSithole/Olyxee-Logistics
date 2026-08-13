import { useState } from "react";
import { Link, useParams } from "wouter";
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
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const invoiceStatus = (order as (typeof order & { invoice_status?: string | null }))?.invoice_status ?? null;
  const paymentConfirmed = !order?.invoice_id || invoiceStatus === "paid";
  const shipmentUpdatesUnlocked = paymentConfirmed && (!order?.transport_mode || !!order?.supplier_tracking_number);
  const saveSupplierTracking = async () => {
    if (!id || !supplierTracking.trim()) return;
    setSavingSupplierTracking(true);
    try {
      await apiFetch(`/api/orders/${id}/supplier-tracking`, { method: "POST", body: { supplierTrackingNumber: supplierTracking } });
      toast.success("Supplier tracking number saved"); setSupplierTracking(""); refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed to save supplier tracking number"); }
    finally { setSavingSupplierTracking(false); }
  };
  const createInvoice = async () => {
    if (!id || !invoiceSubtotal.trim()) return;
    setCreatingInvoice(true);
    try {
      const invoice = await apiFetch<{id:string}>("/api/invoices", { method: "POST", body: { orderId: id, subtotal: invoiceSubtotal, additionalCharges: invoiceCharges, currency: "ZAR" } });
      toast.success("Draft invoice generated"); refetch(); window.location.href = `${import.meta.env.BASE_URL}invoices/${invoice.id}`;
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
              `Status updated, but the email wasn't sent - you've reached this month's email limit (${data.emailUsage ?? ""}/${data.emailLimit ?? ""}). Upgrade to keep notifying customers.`,
            );
          } else if (data?.emailStatus === "failed") {
            toast.warning(`Status updated to "${statusForm.status}", but the email failed to send.`);
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
                "Monthly email limit reached. Upgrade to send more emails.",
            );
          } else if (!data?.success) {
            toast.error(data?.message || "Failed to resend email");
          } else {
            toast.success("Email resent to customer");
          }
          refetch();
        },
        onError: () => toast.error("Failed to resend email"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl">
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
    <div className="space-y-6 max-w-5xl">

      {/* Nav + resend */}
      <div className="flex items-center justify-between">
        <Link href="/orders">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Orders
          </Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={handleResend}
          disabled={resendMutation.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${resendMutation.isPending ? "animate-spin" : ""}`} />
          Resend Email
        </Button>
      </div>

      {/* Order identity */}
      <div className="pb-5 border-b">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold font-mono tracking-tight">{order.tracking_id}</h1>
          <StatusBadge status={order.current_status} />
          {order.transport_mode && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 border text-xs font-semibold uppercase tracking-wide text-muted-foreground bg-muted/40">
              {TRANSPORT_MODE_LABELS[order.transport_mode as TransportMode] ?? order.transport_mode}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {order.order_reference && (
            <span className="flex items-center gap-1">
              <span className="text-xs">Ref:</span> {order.order_reference}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {format(new Date(order.created_at), "MMM d, yyyy · HH:mm")}
          </span>
          {order.estimated_delivery_date && (
            <span>
              ETA: {format(new Date(order.estimated_delivery_date), "MMM d, yyyy")}
            </span>
          )}
          {order.customers && (
            <Link
              href={`/customers/${order.customers.id}`}
              className="flex items-center gap-1 text-primary hover:underline"
            >
              {order.customers.full_name}
              {order.customers.company_name && ` · ${order.customers.company_name}`}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Left - main actions */}
        <div className="lg:col-span-2 space-y-6">

          {/* Operations Control */}
          <Card className="border-2 border-foreground/10">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Operations Control</CardTitle>
              <p className="text-xs text-muted-foreground">
                Manage delivery execution, customer communication, and tracking updates from one place.
              </p>
            </CardHeader>
            <CardContent>
              {!paymentConfirmed ? (
                <div className="border-2 border-amber-300 bg-amber-50 px-4 py-5 space-y-3">
                  <div>
                    <p className="font-semibold text-amber-950">Invoice has not been paid</p>
                    <p className="mt-1 text-sm text-amber-800">Confirm payment from the linked invoice before shipment status updates can begin.</p>
                  </div>
                  {order.invoice_id ? <Link href={`/invoices/${order.invoice_id}`}><Button>View invoice and confirm payment</Button></Link> : null}
                </div>
              ) : !shipmentUpdatesUnlocked ? (
                <div className="border bg-muted/40 px-4 py-6 text-center">
                  <p className="text-sm font-semibold">Payment confirmed</p>
                  <p className="mt-1 text-xs text-muted-foreground">Shipment updates unlock after the China warehouse records the internal supplier tracking number.</p>
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
          <Card>
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
          <Card>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="group w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-base font-semibold">Email History</span>
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
                    <p className="text-sm text-muted-foreground">No emails sent yet.</p>
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
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Customer
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Package className="h-3.5 w-3.5" />
                Order Details
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
              {order.order_reference && (
                <div>
                  <p className="text-muted-foreground uppercase font-medium mb-0.5">Reference</p>
                  <p className="text-sm font-mono">{order.order_reference}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">Public tracking ID</p>
                <p className="text-sm font-mono">{order.tracking_id}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase font-medium mb-0.5">Supplier tracking number</p>
                {order.supplier_tracking_number ? (
                  <p className="text-sm font-mono">{order.supplier_tracking_number}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-700">{order.current_status === "PENDING_TRACKING_NUMBER" ? "Payment confirmed - waiting for the China warehouse to receive the cargo" : "Tracking number entry unlocks after payment confirmation"}</p>
                    {order.transport_mode && order.current_status === "PENDING_TRACKING_NUMBER" ? <div className="flex gap-2"><Input value={supplierTracking} onChange={e => setSupplierTracking(e.target.value)} placeholder="Supplier tracking number"/><Button size="sm" disabled={savingSupplierTracking || !supplierTracking.trim()} onClick={saveSupplierTracking}>Cargo received - save tracking</Button></div> : null}
                  </div>
                )}
              </div>
              {order.invoice_id && <div className="space-y-1"><p className="text-muted-foreground uppercase font-medium mb-0.5">Invoice</p><Link className="text-sm underline" href={`/invoices/${order.invoice_id}`}>View linked invoice</Link><p className={`text-sm font-semibold ${invoiceStatus === "paid" ? "text-green-700" : "text-amber-700"}`}>{invoiceStatus === "paid" ? "Paid - manually confirmed" : "Unpaid - confirmation required"}</p></div>}
              {!order.invoice_id && <div className="space-y-2 border-t pt-3"><p className="text-muted-foreground uppercase font-medium">Generate invoice</p><Input value={invoiceSubtotal} onChange={e=>setInvoiceSubtotal(e.target.value)} placeholder="Subtotal (ZAR)"/><Input value={invoiceCharges} onChange={e=>setInvoiceCharges(e.target.value)} placeholder="Additional charges"/><Button size="sm" disabled={creatingInvoice||!invoiceSubtotal.trim()} onClick={createInvoice}>Generate draft invoice</Button></div>}
              {(order.origin || order.destination) && <div><p className="text-muted-foreground uppercase font-medium mb-0.5">Route</p><p className="text-sm">{order.origin || "—"} → {order.destination || "—"}</p></div>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
