import { useMemo, useState, type ElementType, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Clock, PackageCheck, TrendingDown, ReceiptText,
  Plane, Ship, Plus, Trash2, ArrowRight, Wallet, CheckCircle2,
  Send, Printer, Package,
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

// Never mixes currencies — every amount is rendered with its own currency code.
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
  attention: {
    overdue: { invoiceId: string; invoiceNumber: string; orderId: string; customerName: string; total: number; currency: string; daysOverdue: number }[];
    awaitingConfirmation: { invoiceId: string; invoiceNumber: string; orderId: string; customerName: string; total: number; currency: string }[];
    completedNotInvoiced: { orderId: string; jobNumber: string; customerName: string; transportMode: string | null; route: string | null }[];
    missingCosts: { orderId: string; jobNumber: string; customerName: string; revenue: number | null; currency: string }[];
    lowMargin: { orderId: string; jobNumber: string; customerName: string; revenue: number | null; grossProfit: number | null; marginPct: number | null; currency: string }[];
  };
}

// Derive the customer-facing invoice status, computing Overdue dynamically (the
// DB never persists `overdue` reliably — see finance.ts).
function invoiceStatus(inv: { status: string; dueDate: string | null }): { label: string; cls: string } {
  const past = !!inv.dueDate && new Date(inv.dueDate).getTime() < Date.now();
  if (inv.status === "paid") return { label: "Paid", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
  if (inv.status === "cancelled") return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
  if (inv.status === "sent" && past) return { label: "Overdue", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" };
  if (inv.status === "sent") return { label: "Awaiting payment", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
  if (inv.status === "draft") return { label: "Draft", cls: "bg-muted text-muted-foreground" };
  return { label: inv.status, cls: "bg-muted text-muted-foreground" };
}

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

// ─── Needs financial attention + totals header ───────────────────────────────

function StatTile({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold tracking-tight ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

function AttentionGroup({
  icon: Icon, tone, title, count, children,
}: { icon: ElementType; tone: string; title: string; count: number; children: ReactNode }) {
  if (!count) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[13px] font-semibold">
        <Icon className={`h-4 w-4 ${tone}`} /> {title} <span className="text-muted-foreground">· {count}</span>
      </div>
      <div className="space-y-1 pl-6">{children}</div>
    </div>
  );
}

function AttnRow({ href, primary, secondary }: { href: string; primary: string; secondary?: string }) {
  return (
    <Link href={href} className="group flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 -mx-2 text-sm hover:bg-muted/50">
      <span className="min-w-0 truncate">
        <span className="font-medium">{primary}</span>
        {secondary ? <span className="text-muted-foreground"> · {secondary}</span> : null}
      </span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function FinanceHeader({ summary }: { summary: Summary | undefined }) {
  if (!summary) {
    return <div className="grid gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>;
  }
  const { totals, attention, primaryCurrency } = summary;
  const cur = primaryCurrency;
  const attnCount =
    attention.overdue.length + attention.completedNotInvoiced.length +
    attention.awaitingConfirmation.length + attention.missingCosts.length + attention.lowMargin.length;

  const cap = <T,>(arr: T[]) => arr.slice(0, 4);
  const more = (n: number) => (n > 4 ? <p className="pl-2 text-xs text-muted-foreground">+{n - 4} more</p> : null);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="Invoiced" value={money(cur, totals.invoiced)} />
        <StatTile label="Received" value={money(cur, totals.received)} accent="text-emerald-600 dark:text-emerald-400" />
        <StatTile label="Outstanding" value={money(cur, totals.outstanding)} accent={totals.outstanding > 0 ? "text-amber-600 dark:text-amber-400" : ""} />
        <StatTile label={`Overdue${totals.overdueCount ? ` (${totals.overdueCount})` : ""}`} value={money(cur, totals.overdueValue)} accent={totals.overdueValue > 0 ? "text-red-600 dark:text-red-400" : ""} />
      </div>
      {summary.mixedCurrencies ? (
        <p className="text-xs text-muted-foreground">Totals show {cur} only — invoices in other currencies are excluded to avoid mixing them.</p>
      ) : null}

      <Card>
        <CardContent className="p-4 sm:p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Needs financial attention</p>
          {attnCount === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Nothing needs attention — you're all caught up.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AttentionGroup icon={AlertTriangle} tone="text-red-500" title="Overdue invoices" count={attention.overdue.length}>
                {cap(attention.overdue).map((o) => (
                  <AttnRow key={o.invoiceId} href={`/invoices/${o.invoiceId}`} primary={`${o.invoiceNumber} · ${o.customerName}`} secondary={`${money(o.currency, o.total)} · ${o.daysOverdue}d late`} />
                ))}
                {more(attention.overdue.length)}
              </AttentionGroup>

              <AttentionGroup icon={PackageCheck} tone="text-blue-500" title="Completed, not invoiced" count={attention.completedNotInvoiced.length}>
                {cap(attention.completedNotInvoiced).map((j) => (
                  <AttnRow key={j.orderId} href={`/orders/${j.orderId}`} primary={j.jobNumber} secondary={`${j.customerName} — delivered`} />
                ))}
                {more(attention.completedNotInvoiced.length)}
              </AttentionGroup>

              <AttentionGroup icon={Clock} tone="text-amber-500" title="Awaiting payment" count={attention.awaitingConfirmation.length}>
                {cap(attention.awaitingConfirmation).map((o) => (
                  <AttnRow key={o.invoiceId} href={`/invoices/${o.invoiceId}`} primary={`${o.invoiceNumber} · ${o.customerName}`} secondary={money(o.currency, o.total)} />
                ))}
                {more(attention.awaitingConfirmation.length)}
              </AttentionGroup>

              <AttentionGroup icon={ReceiptText} tone="text-violet-500" title="Invoiced, missing costs" count={attention.missingCosts.length}>
                {cap(attention.missingCosts).map((j) => (
                  <AttnRow key={j.orderId} href="/finance/costs" primary={j.jobNumber} secondary={`${j.customerName} — no costs recorded`} />
                ))}
                {more(attention.missingCosts.length)}
              </AttentionGroup>

              <AttentionGroup icon={TrendingDown} tone="text-rose-500" title={`Low margin (≤ ${summary.lowMarginThreshold}%)`} count={attention.lowMargin.length}>
                {cap(attention.lowMargin).map((j) => (
                  <AttnRow key={j.orderId} href="/finance/profit" primary={j.jobNumber} secondary={`${j.customerName} · ${j.marginPct}% margin`} />
                ))}
                {more(attention.lowMargin.length)}
              </AttentionGroup>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sub-tab navigation ──────────────────────────────────────────────────────

function SubTabs({ active }: { active: string }) {
  const tabs = [
    { key: "invoices", label: "Invoices", href: "/finance" },
    { key: "costs", label: "Job Costs", href: "/finance/costs" },
    { key: "profit", label: "Job Profit", href: "/finance/profit" },
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href}
          className={`flex-1 rounded-lg py-2 text-center text-sm font-medium transition-colors ${active === t.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

// ─── Invoice quick-view popup ────────────────────────────────────────────────

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
    onSuccess: (_d, name) => {
      toast.success(name === "pay" ? "Payment confirmed" : "Invoice sent to the customer");
      invalidate();
      if (name === "pay") onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const inv = q.data;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      {/* Wide + scrollable so the real branded A4 invoice shows in full. */}
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-0 sm:max-w-[860px]">
        {/* Action bar — hidden when printing so only the invoice prints. Clear,
            labelled buttons; the main action for this invoice's state comes first. */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-3 pr-12 backdrop-blur print:hidden">
          <DialogHeader className="space-y-0">
            <DialogTitle className="font-mono text-sm">{inv?.invoiceNumber ?? "Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            {inv?.status === "draft" ? (
              <Button size="sm" className="gap-1.5" disabled={action.isPending} onClick={() => action.mutate("send")}><Send className="h-3.5 w-3.5" /> Send to customer</Button>
            ) : null}
            {inv?.status === "sent" ? (
              <Button size="sm" className="gap-1.5" disabled={action.isPending} onClick={() => action.mutate("pay")}><CheckCircle2 className="h-3.5 w-3.5" /> Confirm payment</Button>
            ) : null}
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}><Printer className="h-3.5 w-3.5" /> Print / PDF</Button>
            {inv ? <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/orders/${inv.orderId}`)}><Package className="h-3.5 w-3.5" /> Open job</Button> : null}
          </div>
        </div>
        {/* Grey mat behind the white page, like a real invoice preview. */}
        <div className="bg-slate-100 p-4 dark:bg-neutral-900 sm:p-6">
          {q.isLoading ? (
            <Skeleton className="mx-auto h-[600px] w-full max-w-[794px]" />
          ) : inv ? (
            <InvoiceDocument invoice={inv} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Invoice not found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Invoices tab ────────────────────────────────────────────────────────────

function InvoicesTab() {
  const q = useQuery({ queryKey: ["invoices"], queryFn: () => apiFetch<{ data: InvoiceRow[]; total: number }>("/api/invoices") });
  const [selected, setSelected] = useState<string | null>(null);
  if (q.isLoading) return <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  if (q.isError) return <Card><CardContent className="p-8 text-center"><p className="font-medium">Unable to load invoices</p><Button className="mt-4" variant="outline" onClick={() => q.refetch()}>Retry</Button></CardContent></Card>;
  const rows = q.data?.data ?? [];
  if (!rows.length) return <Card><CardContent className="p-0"><EmptyState icon={<ReceiptText className="h-12 w-12" />} title="No invoices yet" description="Open a job to generate its first invoice." /></CardContent></Card>;

  return (
    <>
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Invoice</TableHead><TableHead>Customer</TableHead><TableHead>Job</TableHead>
          <TableHead className="text-right">Amount</TableHead><TableHead>Issued</TableHead><TableHead>Due</TableHead>
          <TableHead>Status</TableHead><TableHead className="text-right" />
        </TableRow></TableHeader>
        <TableBody>
          {rows.map((inv) => {
            const st = invoiceStatus(inv);
            const job = inv.jobNumber || inv.orderReference || inv.trackingId || "—";
            return (
              <TableRow key={inv.id} className="cursor-pointer" onClick={() => setSelected(inv.id)}>
                <TableCell className="font-mono text-sm font-semibold">{inv.invoiceNumber}</TableCell>
                <TableCell>{inv.customerCompany || inv.customerName || "—"}</TableCell>
                <TableCell><Link href={`/orders/${inv.orderId}`} onClick={(e) => e.stopPropagation()} className="font-mono text-sm hover:text-primary hover:underline">{job}</Link></TableCell>
                <TableCell className="text-right font-medium">{money(inv.currency, Number(inv.total))}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{fmtDate(inv.createdAt)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{inv.dueDate ? fmtDate(inv.dueDate) : "On receipt"}</TableCell>
                <TableCell><Badge className={st.cls}>{st.label}</Badge></TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="secondary" onClick={() => setSelected(inv.id)}>View</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </CardContent></Card>
    {selected ? <InvoiceDialog invoiceId={selected} onClose={() => setSelected(null)} /> : null}
    </>
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
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{order?.jobNumber ?? "Job"}</span>
            {order?.transportMode ? <ModeIcon mode={order.transportMode} /> : null}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{order?.customerName}{order?.route ? ` · ${order.route}` : ""}</p>
        </DialogHeader>

        {q.isLoading ? (
          <div className="space-y-2 py-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* existing cost lines — direct-edit, auto-save on blur */}
            <div className="space-y-2">
              {costs.length === 0 ? <p className="text-sm text-muted-foreground">No costs recorded yet. Add the first one below.</p> : null}
              {costs.map((c) => (
                <div key={c.id} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <select className={field} value={c.category} onChange={(e) => patchCost.mutate({ id: c.id, body: { category: e.target.value } })}>
                    {CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
                  </select>
                  <Input type="number" min="0" step="0.01" defaultValue={c.amount}
                    className="h-10 rounded-lg text-right"
                    onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== c.amount) patchCost.mutate({ id: c.id, body: { amount: v } }); }} />
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-destructive" onClick={() => delCost.mutate(c.id)} aria-label="Delete cost"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {costs.map((c) => c.note ? (
                <p key={`n-${c.id}`} className="pl-1 text-xs text-muted-foreground">{CATEGORY_LABELS[c.category]}: {c.note}</p>
              ) : null)}
            </div>

            {/* add row */}
            <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2 border-t border-border pt-3">
              <select className={field} value={cat} onChange={(e) => setCat(e.target.value)}>
                {CATEGORIES.map((k) => <option key={k} value={k}>{CATEGORY_LABELS[k]}</option>)}
              </select>
              <Input type="number" min="0" step="0.01" placeholder="Amount" value={amount} className="h-10 rounded-lg text-right"
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && amount) addCost.mutate(); }} />
              <Button size="icon" className="h-9 w-9" disabled={!amount || addCost.isPending} onClick={() => addCost.mutate()} aria-label="Add cost"><Plus className="h-4 w-4" /></Button>
            </div>
            <Input placeholder="Optional note for the cost above" value={note} className="h-9 rounded-lg text-sm" onChange={(e) => setNote(e.target.value)} />

            {/* totals */}
            <div className="space-y-1.5 rounded-xl bg-muted/40 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total costs</span><span className="font-semibold">{money(cur, total)}</span></div>
              {revenue != null ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Revenue (invoice)</span><span>{money(cur, revenue)}</span></div>
                  {profit != null ? (
                    <div className="flex justify-between border-t border-border pt-1.5"><span className="font-medium">Gross profit</span><span className={`font-semibold ${profit < 0 ? "text-red-600" : "text-emerald-600"}`}>{money(cur, profit)}{margin != null ? ` · ${margin}%` : ""}</span></div>
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

// ─── Job Costs tab ───────────────────────────────────────────────────────────

function JobCostsTab() {
  const q = useQuery({ queryKey: ["finance", "jobs"], queryFn: () => apiFetch<{ data: JobRow[] }>("/api/finance/jobs") });
  const [editing, setEditing] = useState<string | null>(null);
  if (q.isLoading) return <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;
  const rows = q.data?.data ?? [];
  if (!rows.length) return <Card><CardContent className="p-0"><EmptyState icon={<Wallet className="h-12 w-12" />} title="No jobs yet" description="Create a job to start recording its costs." /></CardContent></Card>;

  return (
    <>
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Job</TableHead><TableHead>Customer</TableHead><TableHead>Route</TableHead>
            <TableHead className="text-right">Costs</TableHead><TableHead>Invoiced</TableHead><TableHead className="text-right" />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((j) => (
              <TableRow key={j.orderId}>
                <TableCell className="font-mono text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><ModeIcon mode={j.transportMode} />{j.jobNumber}</span></TableCell>
                <TableCell>{j.customerName}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{j.route ?? "—"}</TableCell>
                <TableCell className="text-right">{j.costCount ? money(j.currency, j.totalCost) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>{j.invoiceId ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">Invoiced</Badge> : <Badge className="bg-muted text-muted-foreground">Not invoiced</Badge>}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="secondary" onClick={() => setEditing(j.orderId)}>{j.costCount ? "Edit costs" : "Add costs"}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      {editing ? <JobCostEditor orderId={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

// ─── Job Profit tab ──────────────────────────────────────────────────────────

type ProfitFilter = "all" | "high" | "low" | "missing" | "AIR" | "SEA";

function JobProfitTab() {
  const q = useQuery({ queryKey: ["finance", "jobs"], queryFn: () => apiFetch<{ data: JobRow[]; lowMarginThreshold: number }>("/api/finance/jobs") });
  const [filter, setFilter] = useState<ProfitFilter>("all");
  const threshold = q.data?.lowMarginThreshold ?? 15;

  const rows = useMemo(() => {
    const invoiced = (q.data?.data ?? []).filter((r) => r.revenue != null);
    switch (filter) {
      case "high": return invoiced.filter((r) => r.marginPct != null && r.marginPct > threshold);
      case "low": return invoiced.filter((r) => r.marginPct != null && r.marginPct <= threshold);
      case "missing": return invoiced.filter((r) => !r.hasCosts);
      case "AIR": return invoiced.filter((r) => r.transportMode === "AIR");
      case "SEA": return invoiced.filter((r) => r.transportMode === "SEA");
      default: return invoiced;
    }
  }, [q.data, filter, threshold]);

  if (q.isLoading) return <div className="space-y-3 p-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>;

  const filters: { key: ProfitFilter; label: string }[] = [
    { key: "all", label: "All" }, { key: "high", label: "High margin" }, { key: "low", label: "Low margin" },
    { key: "missing", label: "Missing costs" }, { key: "AIR", label: "Air" }, { key: "SEA", label: "Sea" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {f.label}
          </button>
        ))}
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
        {!rows.length ? (
          <EmptyState icon={<Wallet className="h-12 w-12" />} title="No invoiced jobs to show" description="Profit appears once a job has an invoice. Adjust the filter or invoice a completed job." />
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Job</TableHead><TableHead>Customer</TableHead><TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Costs</TableHead><TableHead className="text-right">Gross profit</TableHead><TableHead className="text-right">Margin</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.orderId}>
                  <TableCell className="font-mono text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><ModeIcon mode={j.transportMode} />{j.jobNumber}</span></TableCell>
                  <TableCell>{j.customerName}</TableCell>
                  <TableCell className="text-right">{money(j.currency, j.revenue)}</TableCell>
                  {j.hasCosts ? (
                    <>
                      <TableCell className="text-right">{money(j.currency, j.totalCost)}</TableCell>
                      <TableCell className={`text-right font-medium ${(j.grossProfit ?? 0) < 0 ? "text-red-600" : "text-emerald-600 dark:text-emerald-400"}`}>{money(j.currency, j.grossProfit)}</TableCell>
                      <TableCell className="text-right">
                        <Badge className={j.marginPct != null && j.marginPct <= threshold ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"}>{j.marginPct}%</Badge>
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={3} className="text-right"><span className="text-sm text-amber-600 dark:text-amber-400">Cost information incomplete</span></TableCell>
                  )}
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

export default function FinancePage({ tab }: { tab: "invoices" | "costs" | "profit" }) {
  const summaryQ = useQuery({ queryKey: ["finance", "summary"], queryFn: () => apiFetch<Summary>("/api/finance/summary") });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Who owes you, what each job cost, and what you actually made.</p>
      </div>

      <FinanceHeader summary={summaryQ.data} />

      <SubTabs active={tab} />

      {tab === "invoices" ? <InvoicesTab /> : tab === "costs" ? <JobCostsTab /> : <JobProfitTab />}
    </div>
  );
}
