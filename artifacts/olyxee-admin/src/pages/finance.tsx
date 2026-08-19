import { useMemo, useState, type ElementType } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  AlertTriangle, Clock, PackageCheck, TrendingDown, ReceiptText,
  Plane, Ship, Plus, Trash2, ArrowRight, Wallet, CheckCircle2,
  Send, Printer, Package, TrendingUp,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/page-loader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InvoiceDocument } from "@/components/invoice-document";
import { toast } from "sonner";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  FREIGHT: "Freight / Carrier",
  CUSTOMS_CLEARING: "Customs / Clearing",
  WAREHOUSE: "Warehouse",
  LOCAL_TRANSPORT: "Local transport / Delivery",
  AGENT_SUPPLIER: "Agent / Supplier",
  OTHER: "Other",
};
const CATEGORIES = Object.keys(CATEGORY_LABELS);

function money(currency: string, n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const field =
  "h-10 w-full rounded-lg border border-border bg-muted/40 px-2.5 text-sm text-foreground outline-none transition focus:border-foreground/25 focus:bg-background focus:ring-2 focus:ring-ring/30";

function ModeIcon({ mode }: { mode: string | null }) {
  if (mode === "AIR") return <Plane className="h-3.5 w-3.5 text-muted-foreground" />;
  if (mode === "SEA") return <Ship className="h-3.5 w-3.5 text-muted-foreground" />;
  return null;
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvoiceRow {
  id: string; invoiceNumber: string; trackingId: string | null;
  orderReference: string | null; jobNumber: string | null; billingStatus: string | null;
  orderId: string; customerName: string | null; customerCompany: string | null;
  status: string; currency: string; total: string;
  dueDate: string | null; paidAt: string | null; createdAt: string;
}

interface JobRow {
  orderId: string; jobNumber: string; trackingId: string; customerName: string;
  transportMode: string | null; route: string | null; currentStatus: string;
  billingStatus: string; delivered: boolean; deliveredAt: string | null;
  invoiceId: string | null; invoiceNumber: string | null; invoiceStatus: string | null;
  dueDate: string | null; overdue: boolean;
  revenue: number | null; currency: string; totalCost: number; costCount: number;
  hasCosts: boolean; grossProfit: number | null; marginPct: number | null;
}

interface Summary {
  primaryCurrency: string; mixedCurrencies: boolean; lowMarginThreshold: number;
  totals: { invoiced: number; received: number; outstanding: number; overdueValue: number; overdueCount: number };
  grossProfit: {
    currency: string; total: number; revenue: number; cost: number; marginPct: number | null; jobCount: number;
    trend: { month: string; value: number }[];
  };
  attention: {
    overdue: { invoiceId: string; invoiceNumber: string; orderId: string; customerName: string; total: number; currency: string; daysOverdue: number }[];
    awaitingConfirmation: { invoiceId: string; invoiceNumber: string; orderId: string; customerName: string; total: number; currency: string }[];
    completedNotInvoiced: { orderId: string; jobNumber: string; customerName: string; transportMode: string | null; route: string | null }[];
    missingCosts: { orderId: string; jobNumber: string; customerName: string; revenue: number | null; currency: string }[];
    lowMargin: { orderId: string; jobNumber: string; customerName: string; revenue: number | null; grossProfit: number | null; marginPct: number | null; currency: string }[];
  };
}

// Derive the invoice status shown to the user, computing Overdue dynamically
// (the DB never persists `overdue` reliably — see finance.ts).
function invoiceStatus(inv: { status: string; dueDate: string | null }): { label: string; cls: string } {
  const past = !!inv.dueDate && new Date(inv.dueDate).getTime() < Date.now();
  if (inv.status === "paid") return { label: "Paid", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
  if (inv.status === "cancelled") return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
  if (inv.status === "sent" && past) return { label: "Overdue", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" };
  if (inv.status === "sent") return { label: "Awaiting payment", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
  if (inv.status === "draft") return { label: "Draft", cls: "bg-muted text-muted-foreground" };
  return { label: inv.status, cls: "bg-muted text-muted-foreground" };
}

// ─── The one Finance KPI: Gross profit (chart) ───────────────────────────────
// Deliberately the only headline metric, and one the dashboard does NOT have
// (the dashboard shows revenue, never cost/profit).

function GrossProfitKPI({ gp }: { gp: Summary["grossProfit"] }) {
  const [, navigate] = useLocation();
  const cur = gp.currency;
  const positive = gp.total >= 0;
  const line = positive ? "#10b981" : "#dc2626";

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Gross profit
          </p>
          <p className={`mt-1 text-[26px] font-bold tracking-tight tabular-nums ${positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>{money(cur, gp.total)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {gp.jobCount > 0
              ? <>{gp.marginPct ?? 0}% margin · {money(cur, gp.revenue)} revenue − {money(cur, gp.cost)} costs · {gp.jobCount} job{gp.jobCount > 1 ? "s" : ""}</>
              : "Across invoiced jobs that have costs recorded"}
          </p>
        </div>
      </div>

      {gp.jobCount === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 py-8 text-center">
          <Wallet className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm font-medium">No profit to show yet</p>
          <p className="max-w-xs text-xs text-muted-foreground">Add costs to an invoiced job and its profit appears here.</p>
          <Button size="sm" variant="outline" className="mt-1" onClick={() => navigate("/finance/jobs")}>Go to jobs</Button>
        </div>
      ) : (
        <div className="mt-4" style={{ height: 168 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={gp.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={line} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={line} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} width={36} tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v: number) => [money(cur, Number(v)), "Gross profit"]} />
              <Area type="monotone" dataKey="value" stroke={line} strokeWidth={2.5} fill="url(#gpFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Needs attention (opens the right dialog in place) ───────────────────────

interface Attn { key: string; icon: ElementType; tone: string; title: string; sub: string; open: () => void; }

function FinanceHeader({ summary, onOpenInvoice, onOpenCosts }: { summary: Summary | undefined; onOpenInvoice: (id: string) => void; onOpenCosts: (orderId: string) => void }) {
  const [, navigate] = useLocation();
  if (!summary) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const a = summary.attention;
  const items: Attn[] = [];
  for (const o of a.overdue) items.push({ key: "ov" + o.invoiceId, icon: AlertTriangle, tone: "text-red-500", title: `${o.customerName} owes ${money(o.currency, o.total)}`, sub: `${o.invoiceNumber} · ${o.daysOverdue} day${o.daysOverdue === 1 ? "" : "s"} overdue`, open: () => onOpenInvoice(o.invoiceId) });
  for (const j of a.completedNotInvoiced) items.push({ key: "cni" + j.orderId, icon: PackageCheck, tone: "text-blue-500", title: `${j.jobNumber} is delivered — invoice it`, sub: j.customerName + (j.route ? ` · ${j.route}` : ""), open: () => navigate(`/orders/${j.orderId}`) });
  for (const o of a.awaitingConfirmation) items.push({ key: "aw" + o.invoiceId, icon: Clock, tone: "text-amber-500", title: `${o.customerName} — awaiting payment`, sub: `${o.invoiceNumber} · ${money(o.currency, o.total)}`, open: () => onOpenInvoice(o.invoiceId) });
  for (const j of a.missingCosts) items.push({ key: "mc" + j.orderId, icon: ReceiptText, tone: "text-violet-500", title: `${j.jobNumber} has no costs recorded`, sub: `${j.customerName} · add costs to see profit`, open: () => onOpenCosts(j.orderId) });
  for (const j of a.lowMargin) items.push({ key: "lm" + j.orderId, icon: TrendingDown, tone: "text-rose-500", title: `${j.jobNumber} is low margin (${j.marginPct}%)`, sub: `${j.customerName} · review its costs`, open: () => onOpenCosts(j.orderId) });
  const shown = items.slice(0, 5);

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <GrossProfitKPI gp={summary.grossProfit} />

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card">
          <div className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
            <span className="text-[13px] font-semibold">Needs attention</span>
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{items.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {shown.map((it) => (
              <button key={it.key} onClick={it.open} className="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40">
                <it.icon className={`h-4 w-4 shrink-0 ${it.tone}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{it.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{it.sub}</span>
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
          {items.length > shown.length ? <p className="px-4 py-2 text-xs text-muted-foreground">+{items.length - shown.length} more</p> : null}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl border border-border/70 bg-card px-4 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nothing needs attention right now.
        </div>
      )}
    </div>
  );
}

// ─── Sub-tab navigation ──────────────────────────────────────────────────────

function SubTabs({ active }: { active: string }) {
  const tabs = [
    { key: "invoices", label: "Invoices", href: "/finance" },
    { key: "jobs", label: "Jobs", href: "/finance/jobs" },
  ];
  return (
    <div className="inline-flex gap-1 rounded-xl border border-border/70 bg-muted/40 p-1">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${active === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// ─── Invoice quick-view popup (real branded invoice) ─────────────────────────

function InvoiceDialog({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["invoice", invoiceId], queryFn: () => apiFetch<any>(`/api/invoices/${invoiceId}`) });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
    qc.invalidateQueries({ queryKey: ["finance"] });
  };
  const action = useMutation({
    mutationFn: (name: "send" | "pay") => apiFetch(`/api/invoices/${invoiceId}/${name}`, { method: "POST" }),
    onSuccess: (_d, name) => { toast.success(name === "pay" ? "Payment confirmed" : "Invoice sent to the customer"); invalidate(); if (name === "pay") onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const inv = q.data;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-[860px]">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-3 pr-12 backdrop-blur print:hidden">
          <DialogHeader className="space-y-0"><DialogTitle className="font-mono text-sm">{inv?.invoiceNumber ?? "Invoice"}</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {inv?.status === "draft" ? <Button size="sm" className="gap-1.5" disabled={action.isPending} onClick={() => action.mutate("send")}><Send className="h-3.5 w-3.5" /> Send to customer</Button> : null}
            {inv?.status === "sent" ? <Button size="sm" className="gap-1.5" disabled={action.isPending} onClick={() => action.mutate("pay")}><CheckCircle2 className="h-3.5 w-3.5" /> Confirm payment</Button> : null}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print / PDF</Button>
            {inv ? <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/orders/${inv.orderId}`)}><Package className="h-3.5 w-3.5" /> Open job</Button> : null}
          </div>
        </div>
        <div className="bg-slate-100 p-4 dark:bg-neutral-900 sm:p-6">
          {q.isLoading ? <Skeleton className="mx-auto h-[600px] w-full max-w-[794px]" /> : inv ? <InvoiceDocument invoice={inv} /> : <p className="py-8 text-center text-sm text-muted-foreground">Invoice not found.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Job cost editor (dialog) ────────────────────────────────────────────────

interface CostLine { id: string; category: string; amount: number; currency: string; note: string | null; createdAt: string; }
interface CostsResponse { order: { orderId: string; jobNumber: string; customerName: string; transportMode: string | null; route: string | null; revenue: number | null; currency: string; invoiceStatus: string | null }; costs: CostLine[]; totalCost: number; }

function JobCostEditor({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["finance", "costs", orderId], queryFn: () => apiFetch<CostsResponse>(`/api/finance/jobs/${orderId}/costs`) });
  const [cat, setCat] = useState("FREIGHT");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["finance", "costs", orderId] });
    qc.invalidateQueries({ queryKey: ["finance", "jobs"] });
    qc.invalidateQueries({ queryKey: ["finance", "summary"] });
  };
  const addCost = useMutation({
    mutationFn: () => apiFetch(`/api/finance/jobs/${orderId}/costs`, { method: "POST", body: { category: cat, amount: Number(amount), note: note.trim() || null } }),
    onSuccess: () => { setAmount(""); setNote(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const patchCost = useMutation({
    mutationFn: (v: { id: string; body: Record<string, unknown> }) => apiFetch(`/api/finance/costs/${v.id}`, { method: "PATCH", body: v.body }),
    onSuccess: invalidate, onError: (e: Error) => toast.error(e.message),
  });
  const delCost = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/finance/costs/${id}`, { method: "DELETE" }),
    onSuccess: invalidate, onError: (e: Error) => toast.error(e.message),
  });

  const order = q.data?.order;
  const costs = q.data?.costs ?? [];
  const total = q.data?.totalCost ?? 0;
  const cur = order?.currency ?? "ZAR";
  const revenue = order?.revenue ?? null;
  const profit = revenue != null && costs.length ? revenue - total : null;
  const margin = revenue != null && costs.length && revenue ? Math.round((profit! / revenue) * 1000) / 10 : null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[600px] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><span className="font-mono">{order?.jobNumber ?? "Job"}</span>{order?.transportMode ? <ModeIcon mode={order.transportMode} /> : null}</DialogTitle>
          <p className="text-sm text-muted-foreground">{order?.customerName}{order?.route ? ` · ${order.route}` : ""}</p>
        </DialogHeader>

        {q.isLoading ? (
          <div className="space-y-2 py-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {costs.length === 0 ? <p className="text-sm text-muted-foreground">No costs recorded yet. Add the first one below.</p> : null}
              {costs.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <select className={field} value={c.category} onChange={(e) => patchCost.mutate({ id: c.id, body: { category: e.target.value } })}>
                    {CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
                  </select>
                  <Input type="number" min="0" step="0.01" defaultValue={c.amount} className="h-10 rounded-lg text-right"
                    onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== c.amount) patchCost.mutate({ id: c.id, body: { amount: v } }); }} />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => delCost.mutate(c.id)} aria-label="Delete cost"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {costs.map((c) => c.note ? <p key={`n-${c.id}`} className="pl-1 text-xs text-muted-foreground">{CATEGORY_LABELS[c.category]}: {c.note}</p> : null)}
            </div>

            <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2 border-t border-border pt-3">
              <select className={field} value={cat} onChange={(e) => setCat(e.target.value)}>
                {CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
              </select>
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} className="h-10 rounded-lg text-right"
                onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && amount) addCost.mutate(); }} />
              <Button size="icon" className="h-9 w-9" disabled={!amount || addCost.isPending} onClick={() => addCost.mutate()} aria-label="Add cost"><Plus className="h-4 w-4" /></Button>
            </div>
            <Input placeholder="Optional note for the cost above" value={note} className="h-9 rounded-lg text-sm" onChange={(e) => setNote(e.target.value)} />

            <div className="space-y-1.5 rounded-xl bg-muted/40 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total costs</span><span className="font-semibold tabular-nums">{money(cur, total)}</span></div>
              {revenue != null ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Revenue (invoice)</span><span className="tabular-nums">{money(cur, revenue)}</span></div>
                  {profit != null ? (
                    <div className="flex justify-between border-t border-border pt-1.5"><span className="font-medium">Gross profit</span><span className={`font-semibold tabular-nums ${profit < 0 ? "text-red-600" : "text-emerald-600"}`}>{money(cur, profit)}{margin != null ? ` · ${margin}%` : ""}</span></div>
                  ) : <p className="border-t border-border pt-1.5 text-xs text-muted-foreground">Add costs to see profit.</p>}
                </>
              ) : (
                <p className="border-t border-border pt-1.5 text-xs text-muted-foreground">This job isn't invoiced yet — profit will appear once it has an invoice.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoices tab ────────────────────────────────────────────────────────────

function InvoicesTab({ onOpen }: { onOpen: (id: string) => void }) {
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => apiFetch<{ data: InvoiceRow[]; total: number }>("/api/invoices") });
  if (q.isLoading) return <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (q.isError) return <Card><CardContent className="p-8 text-center"><p className="font-medium">Unable to load invoices</p><Button className="mt-4" variant="outline" onClick={() => q.refetch()}>Retry</Button></CardContent></Card>;
  const rows = q.data?.data ?? [];
  if (!rows.length) return <Card><CardContent className="p-0"><EmptyState icon={<ReceiptText className="h-12 w-12" />} title="No invoices yet" description="Open a job to generate its first invoice." /></CardContent></Card>;

  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Job</TableHead>
          <TableHead className="text-right">Amount</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right" />
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((inv) => {
            const st = invoiceStatus(inv);
            const job = inv.jobNumber || inv.orderReference || inv.trackingId || "—";
            return (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => onOpen(inv.id)}>
                <TableCell className="font-mono text-sm font-semibold">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.customerCompany || inv.customerName || "—"}</TableCell>
                <TableCell><Link href={`/orders/${inv.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-sm text-muted-foreground hover:text-primary hover:underline">{job}</Link></TableCell>
                <TableCell className="text-right font-medium tabular-nums">{money(inv.currency, Number(inv.total))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{inv.dueDate ? fmtDate(inv.dueDate) : "On receipt"}</TableCell>
                <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="ghost" className="text-primary hover:text-primary" onClick={() => onOpen(inv.id)}>Open</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

// ─── Jobs tab (money per job + inline cost entry) ────────────────────────────

type JobFilter = "all" | "invoiced" | "missing" | "low" | "AIR" | "SEA";

function JobsTab({ onEditCosts }: { onEditCosts: (orderId: string) => void }) {
  const q = useQuery({ queryKey: ["finance", "jobs"], queryFn: () => apiFetch<{ data: JobRow[]; lowMarginThreshold: number }>("/api/finance/jobs") });
  const [filter, setFilter] = useState<JobFilter>("all");
  const threshold = q.data?.lowMarginThreshold ?? 15;

  const rows = useMemo(() => {
    const all = q.data?.data ?? [];
    switch (filter) {
      case "invoiced": return all.filter((r) => r.revenue != null);
      case "missing": return all.filter((r) => r.revenue != null && !r.hasCosts);
      case "low": return all.filter((r) => r.marginPct != null && r.marginPct <= threshold);
      case "AIR": return all.filter((r) => r.transportMode === "AIR");
      case "SEA": return all.filter((r) => r.transportMode === "SEA");
      default: return all;
    }
  }, [q.data, filter, threshold]);

  if (q.isLoading) return <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const filters: { key: JobFilter; label: string }[] = [
    { key: "all", label: "All" }, { key: "invoiced", label: "Invoiced" }, { key: "missing", label: "Missing costs" },
    { key: "low", label: "Low margin" }, { key: "AIR", label: "Air" }, { key: "SEA", label: "Sea" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{f.label}</button>
        ))}
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        {!rows.length ? (
          <EmptyState icon={<Wallet className="h-12 w-12" />} title="No jobs to show" description="Create a job, then record its costs and invoice to track profit." />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Job</TableHead><TableHead>Customer</TableHead>
              <TableHead className="text-right">Revenue</TableHead><TableHead className="text-right">Costs</TableHead>
              <TableHead className="text-right">Profit</TableHead><TableHead className="text-right">Margin</TableHead><TableHead className="text-right" />
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.orderId}>
                  <TableCell className="font-mono text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><ModeIcon mode={j.transportMode} />{j.jobNumber}</span></TableCell>
                  <TableCell>{j.customerName}</TableCell>
                  <TableCell className="text-right tabular-nums">{j.revenue != null ? money(j.currency, j.revenue) : <span className="text-muted-foreground">Not invoiced</span>}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{j.costCount ? money(j.currency, j.totalCost) : "—"}</TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${j.grossProfit == null ? "" : j.grossProfit < 0 ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {j.grossProfit != null ? money(j.currency, j.grossProfit) : j.revenue != null ? <span className="text-xs font-normal text-amber-600 dark:text-amber-400">Add costs</span> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right">{j.marginPct != null ? <Badge className={j.marginPct <= threshold ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}>{j.marginPct}%</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant={j.costCount ? "ghost" : "secondary"} className={j.costCount ? "text-primary hover:text-primary" : ""} onClick={() => onEditCosts(j.orderId)}>{j.costCount ? "Edit costs" : "Add costs"}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}

// ─── Page shell ──────────────────────────────────────────────────────────────

export default function FinancePage({ tab }: { tab: "invoices" | "jobs" }) {
  const summaryQ = useQuery({ queryKey: ["finance", "summary"], queryFn: () => apiFetch<Summary>("/api/finance/summary") });
  const [invoiceFor, setInvoiceFor] = useState<string | null>(null);
  const [costsFor, setCostsFor] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Finance</h1>

      <FinanceHeader summary={summaryQ.data} onOpenInvoice={setInvoiceFor} onOpenCosts={setCostsFor} />

      <div className="space-y-3">
        <SubTabs active={tab} />
        {tab === "invoices" ? <InvoicesTab onOpen={setInvoiceFor} /> : <JobsTab onEditCosts={setCostsFor} />}
      </div>

      {invoiceFor ? <InvoiceDialog invoiceId={invoiceFor} onClose={() => setInvoiceFor(null)} /> : null}
      {costsFor ? <JobCostEditor orderId={costsFor} onClose={() => setCostsFor(null)} /> : null}
    </div>
  );
}
