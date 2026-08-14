import { Link } from "wouter";
import { useDashboardStats, useOrders } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CircleDollarSign, Clock3, Crown, Package, Plus, Truck } from "lucide-react";
import { format } from "date-fns";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  helper: string;
  icon: typeof Package;
  href: string;
}) {
  return (
    <Link href={href} className="group block">
      <Card className="h-full rounded-3xl border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:bg-muted/25">
        <CardContent className="flex items-start gap-4 p-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted text-foreground"><Icon className="h-5 w-5" /></div>
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
          <p className="mt-1 text-sm text-muted-foreground">See what needs attention and continue working.</p>
        </div>
        <Button asChild className="h-11 gap-2 rounded-xl px-5"><Link href="/orders"><Plus className="h-4 w-4" /> New order</Link></Button>
      </div>

      {loadingSummary ? (
        <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Unpaid invoices" value={summary.unpaidInvoices} helper="Waiting for manual confirmation" icon={CircleDollarSign} href="/invoices" />
          <StatCard label="Active deliveries" value={summary.activeDeliveries} helper="Shipments currently in progress" icon={Truck} href={`/orders?status=${encodeURIComponent("In transit")}`} />
          <StatCard label="Delayed" value={summary.delayedOrders} helper="Orders that may need follow-up" icon={Clock3} href="/orders?status=Delayed" />
        </div>
      ) : null}

      {!loadingSummary && summary && (
        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="rounded-3xl border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <CardHeader className="pb-2"><CardTitle className="text-base">Orders by product</CardTitle><p className="text-xs text-muted-foreground">Most frequently shipped cargo</p></CardHeader>
            <CardContent>
              {summary.productBreakdown.length ? <div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.productBreakdown} layout="vertical" margin={{ left: 8, right: 12 }}><CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.25} /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} /><YAxis dataKey="name" type="category" width={90} axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.35 }} formatter={(value) => [`${value} orders`, "Orders"]} /><Bar dataKey="orderCount" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} maxBarSize={28} /></BarChart></ResponsiveContainer></div> : <div className="flex h-56 items-center justify-center text-center"><div><Package className="mx-auto h-8 w-8 text-muted-foreground/30" /><p className="mt-3 text-sm font-medium">No product data yet</p><p className="mt-1 text-xs text-muted-foreground">Cargo types will appear after orders are created.</p></div></div>}
            </CardContent>
          </Card>
          <Card className="rounded-3xl border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2"><div><CardTitle className="text-base">Paid revenue</CardTitle><p className="mt-1 text-xs text-muted-foreground">Confirmed invoices · last 6 months</p></div><div className="text-right"><p className="text-xl font-bold">{money(summary.paidRevenue)}</p>{summary.topCustomer && <Link href={`/customers/${summary.topCustomer.id}`} className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground hover:text-foreground"><Crown className="h-3 w-3" />{summary.topCustomer.companyName || summary.topCustomer.name}</Link>}</div></CardHeader>
            <CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><AreaChart data={summary.revenueByMonth} margin={{ left: 0, right: 8, top: 12 }}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} width={34} /><Tooltip formatter={(value) => [money(Number(value)), "Paid revenue"]} /><Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revenueFill)" /></AreaChart></ResponsiveContainer></div></CardContent>
          </Card>
        </section>
      )}

      <div>
        <Card className="overflow-hidden rounded-3xl border-border/60 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
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

      </div>
    </div>
  );
}
