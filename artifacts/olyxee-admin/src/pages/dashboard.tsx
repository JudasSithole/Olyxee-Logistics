import { Link } from "wouter";
import { useDashboardStats, useOrders } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, CheckCircle2, CircleDollarSign, Clock3, Crown, MapPinned, Package, Plus, Sparkles, TrendingUp, Truck } from "lucide-react";
import { format } from "date-fns";

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  href,
  tone,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Package;
  href: string;
  tone: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full rounded-2xl border-border/70 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
        <CardContent className="flex items-start gap-4 p-5">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium text-muted-foreground">{label}</p><ArrowRight className="h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" /></div>
            <p className="mt-1 text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: loadingSummary } = useDashboardStats(user?.businessId);
  const { data: recentOrdersData, isLoading: loadingOrders } = useOrders(user?.businessId, { limit: 6 });
  const firstName = user?.name?.trim().split(/\s+/)[0] || "there";
  const recentOrders = recentOrdersData?.orders ?? [];
  const money = (value: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(value);
  const priority = !summary ? null
    : summary.delayedOrders > 0
      ? { title: `Follow up on ${summary.delayedOrders} delayed ${summary.delayedOrders === 1 ? "shipment" : "shipments"}`, detail: "These orders are most likely to need an admin decision or customer communication.", href: "/orders?status=Delayed", action: "Review delayed orders", tone: "amber" }
      : summary.unpaidInvoices > 0
        ? { title: `Confirm ${summary.unpaidInvoices} pending ${summary.unpaidInvoices === 1 ? "payment" : "payments"}`, detail: "Shipment updates stay locked until staff confirms these invoice payments.", href: "/invoices", action: "Review invoices", tone: "amber" }
        : summary.ordersAwaitingSupplierTracking > 0
          ? { title: `${summary.ordersAwaitingSupplierTracking} ${summary.ordersAwaitingSupplierTracking === 1 ? "order is" : "orders are"} waiting on the warehouse`, detail: "Record internal tracking when cargo reaches the China warehouse.", href: "/orders", action: "Review orders", tone: "blue" }
          : summary.activeDeliveries > 0
            ? { title: `${summary.activeDeliveries} active ${summary.activeDeliveries === 1 ? "delivery is" : "deliveries are"} moving`, detail: "Everything urgent is clear. Keep shipment updates current for customers.", href: "/orders", action: "View active orders", tone: "blue" }
            : summary.totalOrders === 0
              ? { title: "Create the first accepted order", detail: "Once a quote is accepted, add the order and its invoice will be generated automatically.", href: "/orders", action: "Create an order", tone: "blue" }
              : { title: "You’re caught up", detail: "There are no delayed shipments or pending payments needing action right now.", href: "/orders", action: "View all orders", tone: "green" };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Operations overview</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Good day, {firstName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your priority briefing and the business signals behind it.</p>
        </div>
        <Button asChild className="h-11 gap-2 rounded-xl px-5"><Link href="/orders"><Plus className="h-4 w-4" /> New order</Link></Button>
      </div>

      {loadingSummary ? <Skeleton className="h-28 rounded-3xl" /> : priority ? (
        <div className={`flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center sm:justify-between ${priority.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-100" : priority.tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100" : "border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100"}`}>
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 dark:bg-background/30"><Sparkles className="h-5 w-5" /></div><div><p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-65">Your next best action</p><p className="mt-1 text-lg font-bold">{priority.title}</p><p className="mt-1 max-w-2xl text-sm leading-6 opacity-75">{priority.detail}</p></div></div>
          <Button asChild className="shrink-0 rounded-xl"><Link href={priority.href}>{priority.action} <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
        </div>
      ) : null}

      {loadingSummary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Unpaid invoices" value={summary.unpaidInvoices} helper="Waiting for manual confirmation" icon={CircleDollarSign} href="/invoices" tone="bg-amber-500/10 text-amber-700 dark:text-amber-300" />
          <StatCard label="Active deliveries" value={summary.activeDeliveries} helper="Shipments currently in progress" icon={Truck} href={`/orders?status=${encodeURIComponent("In transit")}`} tone="bg-blue-500/10 text-blue-700 dark:text-blue-300" />
          <StatCard label="Delayed" value={summary.delayedOrders} helper="Orders that may need follow-up" icon={Clock3} href="/orders?status=Delayed" tone="bg-red-500/10 text-red-700 dark:text-red-300" />
          <StatCard label="Delivered" value={summary.deliveredOrders} helper="Successfully completed orders" icon={CheckCircle2} href="/orders?status=Delivered" tone="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
        </div>
      ) : null}

      {!loadingSummary && summary && (
        <section className="space-y-3">
          <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /><div><h2 className="text-lg font-semibold">Business intelligence</h2><p className="mt-0.5 text-xs text-muted-foreground">Calculated from your orders and confirmed paid invoices.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl border-border/70 shadow-sm"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700"><Package className="h-5 w-5" /></div><p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Most shipped product</p><p className="mt-1 truncate text-lg font-bold">{summary.topProduct?.name ?? "Not enough data"}</p><p className="mt-1 text-xs text-muted-foreground">{summary.topProduct ? `${summary.topProduct.orderCount} orders` : "Add cargo details to orders"}</p></CardContent></Card>
            <Card className="rounded-2xl border-border/70 shadow-sm"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700"><MapPinned className="h-5 w-5" /></div><p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Busiest route</p><p className="mt-1 truncate text-lg font-bold" title={summary.topRoute?.name}>{summary.topRoute?.name ?? "Not enough data"}</p><p className="mt-1 text-xs text-muted-foreground">{summary.topRoute ? `${summary.topRoute.orderCount} shipments` : "Add origins and destinations"}</p></CardContent></Card>
            <Link href={summary.topCustomer ? `/customers/${summary.topCustomer.id}` : "/customers"} className="block"><Card className="h-full rounded-2xl border-border/70 shadow-sm transition-colors hover:border-primary/25"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700"><Crown className="h-5 w-5" /></div><p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Top paying client</p><p className="mt-1 truncate text-lg font-bold">{summary.topCustomer?.companyName || summary.topCustomer?.name || "Not enough data"}</p><p className="mt-1 text-xs text-muted-foreground">{summary.topCustomer ? `${money(summary.topCustomer.paidAmount)} confirmed` : "Based on paid invoices"}</p></CardContent></Card></Link>
            <Card className="rounded-2xl border-border/70 shadow-sm"><CardContent className="p-5"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700"><TrendingUp className="h-5 w-5" /></div><p className="mt-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">Confirmed revenue</p><p className="mt-1 truncate text-lg font-bold">{money(summary.paidRevenue)}</p><p className="mt-1 text-xs text-muted-foreground">Paid invoices only</p></CardContent></Card>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden rounded-3xl border-border/70 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 p-5">
            <div><CardTitle className="text-lg">Recent orders</CardTitle><p className="mt-1 text-xs text-muted-foreground">Your latest shipment activity</p></div>
            <Button asChild variant="ghost" size="sm" className="gap-1.5 rounded-xl"><Link href="/orders">View all <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {loadingOrders ? (
              <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : recentOrders.length === 0 ? (
              <div className="px-5 py-14 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="h-7 w-7" /></div><p className="mt-4 font-semibold">No orders yet</p><p className="mt-1 text-sm text-muted-foreground">Create your first order after a quote is accepted.</p></div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentOrders.map(order => (
                  <Link key={order.id} href={`/orders/${order.id}`} className="group flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/30">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Package className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1"><p className="truncate font-mono text-sm font-semibold">{order.order_reference ?? order.tracking_id}</p><p className="mt-1 truncate text-xs text-muted-foreground">{order.customers?.full_name ?? "Unknown customer"} · {format(new Date(order.created_at), "MMM d, h:mm a")}</p></div>
                    <StatusBadge status={order.current_status} />
                    <ArrowRight className="hidden h-4 w-4 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:block" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-lg">Next actions</CardTitle><p className="text-xs text-muted-foreground">The normal order workflow</p></CardHeader>
          <CardContent className="space-y-2">
            {[
              { number: 1, title: "Create accepted order", detail: "Generate and send its invoice", href: "/orders" },
              { number: 2, title: "Confirm payment", detail: `${summary?.unpaidInvoices ?? 0} waiting now`, href: "/invoices" },
              { number: 3, title: "Update shipments", detail: `${summary?.activeDeliveries ?? 0} active deliveries`, href: "/orders" },
            ].map(action => <Link key={action.number} href={action.href} className="group flex items-center gap-3 rounded-2xl border border-border/60 p-3.5 transition-colors hover:bg-muted/40"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{action.number}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{action.title}</span><span className="block truncate text-xs text-muted-foreground">{action.detail}</span></span><ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground" /></Link>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
