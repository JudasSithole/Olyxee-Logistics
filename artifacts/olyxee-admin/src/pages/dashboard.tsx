import { useEffect, useState, useMemo } from "react";
import { Link } from "wouter";
import { useDashboardStats, useOrders } from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import {
  Package, Truck, CheckCircle, Mail, AlertTriangle,
  ChevronLeft, ChevronRight, CalendarDays, ArrowRight,
  Phone, PhoneIncoming, Receipt, BadgeCheck, PackageSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isToday,
  addMonths, subMonths, startOfDay,
} from "date-fns";

// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-right select-none">
      <p className="text-3xl font-mono font-semibold tabular-nums tracking-tight leading-none">
        {format(now, "HH:mm:ss")}
      </p>
      <p className="text-xs text-muted-foreground mt-1 tracking-wide">
        {format(now, "EEEE, MMMM d, yyyy")}
      </p>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────
// Simple month grid: dates show a small "X deliveries" pill, and hovering
// (or focusing) any day pops up the full list of orders with click-through
// links. No selected-day state, no detail panel below - the hover popover
// is the whole interaction so the widget stays compact and obvious.
type OrderSummary = {
  id: string;
  tracking_id: string;
  current_status: string;
  customers?: { full_name: string } | null;
};

// We only care about one thing visually in the cell: does this day have any
// orders that need attention? Everything else can be a single neutral count.
function needsAttention(status: string): boolean {
  return status === "Delayed" || status === "Failed delivery";
}

const DAY_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function DayCell({
  day, orders, inMonth, isTodayCell,
}: {
  day: Date;
  orders: OrderSummary[];
  inMonth: boolean;
  isTodayCell: boolean;
}) {
  const total = orders.length;
  const attentionCount = orders.filter((o) => needsAttention(o.current_status)).length;

  // Plain, decorative-only cell when empty - no hover popover to avoid noise.
  if (total === 0) {
    return (
      <div
        className={`
          relative flex items-center justify-center h-10 text-xs tabular-nums select-none
          ${!inMonth ? "text-muted-foreground/40" : "text-muted-foreground"}
          ${isTodayCell ? "font-bold text-primary" : ""}
        `}
      >
        {format(day, "d")}
        {isTodayCell && (
          <span className="absolute bottom-0.5 h-0.5 w-4 bg-primary" aria-hidden="true" />
        )}
      </div>
    );
  }

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          aria-label={`${format(day, "EEEE, MMMM d")} - ${total} ${total === 1 ? "delivery" : "deliveries"}${
            attentionCount > 0 ? `, ${attentionCount} needs attention` : ""
          }`}
          className={`
            relative flex flex-col items-center justify-center gap-0.5 h-10 px-1 text-xs tabular-nums
            border transition-colors
            ${attentionCount > 0
              ? "border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900"
              : "border-border bg-muted/30 hover:bg-muted/70 text-foreground"}
            ${!inMonth ? "opacity-50" : ""}
            ${isTodayCell ? "ring-1 ring-primary ring-offset-1 ring-offset-background z-10" : ""}
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary
          `}
        >
          <span className={isTodayCell ? "font-bold text-primary" : "font-medium"}>
            {format(day, "d")}
          </span>
          <span className="text-[9px] font-semibold leading-none">
            {total} {total === 1 ? "order" : "orders"}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="center"
        side="top"
        sideOffset={6}
        className="w-72 p-0 border bg-popover"
      >
        <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate">
              {format(day, "EEEE, MMMM d")}
              {isTodayCell && (
                <span className="ml-2 text-[10px] font-semibold text-primary uppercase tracking-wider">
                  Today
                </span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {total} {total === 1 ? "delivery" : "deliveries"} due
            </p>
          </div>
          {attentionCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 flex-shrink-0">
              <AlertTriangle className="h-3 w-3" />
              {attentionCount}
            </span>
          )}
        </div>
        <div className="divide-y max-h-[260px] overflow-y-auto">
          {orders.map((o) => (
            <Link key={o.id} href={`/orders/${o.id}`}>
              <div className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/60 transition-colors cursor-pointer">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono font-semibold truncate">{o.tracking_id}</p>
                  {o.customers?.full_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{o.customers.full_name}</p>
                  )}
                </div>
                <StatusBadge status={o.current_status} />
                <ArrowRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground transition-colors flex-shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function CalendarWidget({ ordersByDate }: { ordersByDate: Map<string, OrderSummary[]> }) {
  const [month, setMonth] = useState(() => startOfDay(new Date()));
  const today = useMemo(() => startOfDay(new Date()), []);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const totalThisMonth = useMemo(() => {
    let n = 0;
    for (const day of days) {
      if (!isSameMonth(day, month)) continue;
      n += ordersByDate.get(format(day, "yyyy-MM-dd"))?.length ?? 0;
    }
    return n;
  }, [days, month, ordersByDate]);

  const isCurrentMonth = isSameMonth(month, today);

  return (
    <div className="space-y-3">
      {/* Month nav */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold">{format(month, "MMMM yyyy")}</p>
          <p className="text-[10px] text-muted-foreground">
            {totalThisMonth} {totalThisMonth === 1 ? "delivery" : "deliveries"} scheduled
          </p>
        </div>
        <Button
          variant="ghost" size="sm" className="h-8 w-8 p-0"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline" size="sm" className="h-8 px-2 gap-1 text-xs"
          onClick={() => setMonth(startOfDay(new Date()))}
          disabled={isCurrentMonth}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1">
        {DAY_HEADERS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-semibold text-muted-foreground py-1 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid - days without orders are quiet, days with orders are clickable
          tiles that reveal their order list on hover/focus. */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const orders = ordersByDate.get(key) ?? [];
          return (
            <DayCell
              key={key}
              day={day}
              orders={orders}
              inMonth={isSameMonth(day, month)}
              isTodayCell={isToday(day)}
            />
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-1">
        Hover any highlighted day to see what's due.
      </p>
    </div>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
// A compact stat card. When `href` is provided it becomes a clickable shortcut
// into the filtered orders list, with a clear hover affordance.
function KpiCard({
  label, value, icon, href, valueClassName,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href?: string;
  valueClassName?: string;
}) {
  const card = (
    <Card
      className={
        href
          ? "h-full transition-colors hover:bg-muted/40 hover:border-muted-foreground/30 cursor-pointer"
          : "h-full"
      }
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold ${valueClassName ?? ""}`}>{value}</div>
        {href && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            View orders <ArrowRight className="h-3 w-3" />
          </p>
        )}
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading: loadingSummary } = useDashboardStats(user?.businessId);
  const { data: recentOrdersData, isLoading: loadingOrders } = useOrders(user?.businessId, { limit: 8 });
  const { data: allOrders } = useOrders(user?.businessId, { limit: 300 });

  const recentOrders = recentOrdersData?.orders;
  const statusBreakdown = summary?.statusBreakdown;

  const ordersByDate = useMemo(() => {
    const map = new Map<string, OrderSummary[]>();
    for (const o of allOrders?.orders ?? []) {
      if (!o.estimated_delivery_date) continue;
      const key = format(new Date(o.estimated_delivery_date), "yyyy-MM-dd");
      const existing = map.get(key) ?? [];
      map.set(key, [...existing, o as unknown as OrderSummary]);
    }
    return map;
  }, [allOrders]);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Overview of your logistics operations.</p>
        </div>
        <LiveClock />
      </div>

      {/* KPI cards */}
      {loadingSummary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : summary ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <KpiCard
            label="Total orders"
            value={summary.totalOrders}
            icon={<Package className="h-4 w-4 text-muted-foreground" />}
            href="/orders"
          />
          <KpiCard
            label="Active deliveries"
            value={summary.activeDeliveries}
            icon={<Truck className="h-4 w-4 text-blue-500" />}
            href={`/orders?status=${encodeURIComponent("In transit")}`}
          />
          <KpiCard
            label="Delayed"
            value={summary.delayedOrders}
            valueClassName="text-yellow-600"
            icon={<AlertTriangle className="h-4 w-4 text-yellow-500" />}
            href="/orders?status=Delayed"
          />
          <KpiCard
            label="Delivered"
            value={summary.deliveredOrders}
            valueClassName="text-green-600"
            icon={<CheckCircle className="h-4 w-4 text-green-500" />}
            href="/orders?status=Delivered"
          />
          <KpiCard
            label="Awaiting payment"
            value={summary.ordersAwaitingPayment}
            valueClassName={summary.ordersAwaitingPayment > 0 ? "text-amber-600" : undefined}
            icon={<Receipt className="h-4 w-4 text-amber-500" />}
            href="/orders?status=AWAITING_PAYMENT"
          />
          <KpiCard
            label="Paid, not activated"
            value={summary.paidAwaitingActivation}
            valueClassName={summary.paidAwaitingActivation > 0 ? "text-blue-600" : undefined}
            icon={<BadgeCheck className="h-4 w-4 text-blue-500" />}
            href="/orders?status=AWAITING_PAYMENT"
          />
          <KpiCard
            label="Unmatched cargo"
            value={summary.unmatchedCargo}
            valueClassName={summary.unmatchedCargo > 0 ? "text-amber-600" : undefined}
            icon={<PackageSearch className="h-4 w-4 text-amber-500" />}
            href="/unmatched-cargo"
          />
          <KpiCard
            label="Cargo before payment"
            value={summary.cargoBeforePayment}
            valueClassName={summary.cargoBeforePayment > 0 ? "text-red-600" : undefined}
            icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
            href="/orders?status=AWAITING_PAYMENT"
          />
          {summary.failedInvoiceDeliveries > 0 && (
            <KpiCard
              label="Invoice emails failed"
              value={summary.failedInvoiceDeliveries}
              valueClassName="text-red-600"
              icon={<Mail className="h-4 w-4 text-red-500" />}
            />
          )}
          <KpiCard
            label="Emails today"
            value={summary.emailsSentToday}
            icon={<Mail className="h-4 w-4 text-muted-foreground" />}
          />
          {summary.escalatedCallsToday > 0 && (
            <KpiCard
              label="Escalations"
              value={summary.escalatedCallsToday}
              valueClassName="text-red-600"
              icon={<PhoneIncoming className="h-4 w-4 text-red-500" />}
              href="/calls"
            />
          )}
          <KpiCard
            label="Calls today"
            value={summary.callsToday}
            icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            href="/calls"
          />
        </div>
      ) : null}

      {/* Main row */}
      <div className="grid gap-6 lg:grid-cols-7">
        {/* Recent Orders */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Recent orders</CardTitle>
            <Link
              href="/orders"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : recentOrders?.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No recent orders found.</p>
            ) : (
              <div className="space-y-2">
                {recentOrders?.map(order => (
                  <Link key={order.id} href={`/orders/${order.id}`}>
                    <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3 hover:bg-muted/60 transition-colors cursor-pointer">
                      <div>
                        <p className="font-mono font-semibold text-sm">{order.tracking_id}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {order.customers?.full_name} · {format(new Date(order.created_at), "MMM d, h:mm a")}
                        </p>
                      </div>
                      <StatusBadge status={order.current_status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Calendar */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <CalendarWidget ordersByDate={ordersByDate} />
          </CardContent>
        </Card>
      </div>

      {/* Status breakdown - horizontal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Status breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSummary ? (
            <div className="flex gap-4">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 flex-1" />)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {statusBreakdown && Object.entries(statusBreakdown).map(([status, count]) => (
                <Link
                  key={status}
                  href={`/orders?status=${encodeURIComponent(status)}`}
                  className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-2.5 flex-1 min-w-[160px] hover:bg-muted/60 transition-colors"
                >
                  <StatusBadge status={status} />
                  <span className="text-lg font-semibold ml-auto">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
