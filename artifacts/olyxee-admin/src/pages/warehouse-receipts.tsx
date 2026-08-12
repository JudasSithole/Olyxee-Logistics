import React, { useState } from "react";
import { Link } from "wouter";
import {
  useWarehouseReceipts,
  useCreateWarehouseReceipt,
  useOrderMatchSearch,
  type ApiWarehouseReceipt,
} from "@/hooks/use-supabase-queries";
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
import { EmptyState } from "@/components/page-loader";
import { Plus, Warehouse, Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Order picker (shared with unmatched-cargo page) ─────────────────────────

export function OrderMatchPicker({
  value,
  onSelect,
}: {
  value: { id: string; label: string } | null;
  onSelect: (v: { id: string; label: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const { data: candidates, isFetching } = useOrderMatchSearch(debounced);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{value ? value.label : "Search order by tracking ID, ref or customer..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type to search orders..." value={search} onValueChange={setSearch} />
          <CommandList className="max-h-64 overflow-y-auto">
            <CommandEmpty>
              {isFetching ? "Searching..." : debounced ? "No matching orders." : "Type to search."}
            </CommandEmpty>
            {(candidates ?? []).map((o) => {
              const label = `${o.trackingId}${o.customer ? ` · ${o.customer.fullName}` : ""}${o.orderReference ? ` · ${o.orderReference}` : ""}`;
              return (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  disabled={!!o.supplierTrackingNumber}
                  onSelect={() => {
                    onSelect({ id: o.id, label });
                    setOpen(false);
                  }}
                >
                  <Check className={`mr-2 h-4 w-4 ${value?.id === o.id ? "opacity-100" : "opacity-0"}`} />
                  <div className="min-w-0">
                    <span className="truncate block">{label}</span>
                    {o.supplierTrackingNumber && (
                      <span className="text-xs text-muted-foreground">Already has tracking no. {o.supplierTrackingNumber}</span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Record receipt dialog ────────────────────────────────────────────────────

function RecordReceiptDialog({ businessId, onSuccess }: { businessId: string; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ trackingNumber: "", packageCount: "", weightKg: "", notes: "" });
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; label: string } | null>(null);
  const createMutation = useCreateWarehouseReceipt();

  React.useEffect(() => {
    if (open) {
      setForm({ trackingNumber: "", packageCount: "", weightKg: "", notes: "" });
      setSelectedOrder(null);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.trackingNumber.trim()) {
      toast.error("Supplier tracking number is required");
      return;
    }
    createMutation.mutate(
      {
        businessId,
        supplierTrackingNumber: form.trackingNumber,
        orderId: selectedOrder?.id,
        packageCount: form.packageCount.trim() ? parseInt(form.packageCount, 10) : undefined,
        weightKg: form.weightKg.trim() || undefined,
        notes: form.notes.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          if (data.receipt.status === "MATCHED") {
            toast.success(
              data.paymentBlocked
                ? "Cargo received and matched - but the order is still awaiting payment"
                : "Cargo received and matched to order",
            );
          } else if (selectedOrder) {
            toast.warning("Receipt saved, but the match failed - find it in Unmatched Cargo");
          } else {
            toast.success("Receipt saved to Unmatched Cargo - match it to an order when known");
          }
          setOpen(false);
          onSuccess();
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Failed to record receipt"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Record Cargo Receipt</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Record Cargo Receipt</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="mt-2 space-y-4">
          <div className="space-y-1.5">
            <Label>Supplier tracking number *</Label>
            <Input
              value={form.trackingNumber}
              onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))}
              placeholder="e.g. SF1234567890"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Match to order <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <OrderMatchPicker value={selectedOrder} onSelect={setSelectedOrder} />
            <p className="text-xs text-muted-foreground">
              Leave empty if the order isn't known yet - the receipt goes to Unmatched Cargo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Packages</Label>
              <Input inputMode="numeric" placeholder="1" value={form.packageCount} onChange={e => setForm(f => ({ ...f, packageCount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Weight (kg)</Label>
              <Input inputMode="decimal" placeholder="12.5" value={form.weightKg} onChange={e => setForm(f => ({ ...f, weightKg: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Internal notes</Label>
            <Textarea rows={2} placeholder="e.g. box damaged on one corner" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <p className="text-xs text-muted-foreground">Never shown to customers.</p>
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending || !form.trackingNumber.trim()}>
            {createMutation.isPending ? "Saving..." : "Record Receipt"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function WarehouseReceiptsPage() {
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: receipts, isLoading, refetch } = useWarehouseReceipts(user?.businessId, {
    status: statusFilter === "all" ? undefined : (statusFilter as "UNMATCHED" | "MATCHED"),
  });

  const unmatchedCount = (receipts ?? []).filter((r: ApiWarehouseReceipt) => r.status === "UNMATCHED").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Warehouse Receipts</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Cargo received at the China warehouse.
          </p>
        </div>
        <RecordReceiptDialog businessId={user?.businessId ?? ""} onSuccess={() => refetch()} />
      </div>

      {statusFilter === "all" && unmatchedCount > 0 && (
        <Link href="/unmatched-cargo" className="flex items-center gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 hover:bg-amber-100 transition-colors">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {unmatchedCount} unmatched {unmatchedCount === 1 ? "receipt needs" : "receipts need"} to be matched to an order →
        </Link>
      )}

      <Card>
        <CardHeader className="pb-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All receipts</SelectItem>
              <SelectItem value="UNMATCHED">Unmatched</SelectItem>
              <SelectItem value="MATCHED">Matched</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !receipts?.length ? (
            <EmptyState
              icon={<Warehouse className="h-12 w-12" />}
              title="No receipts yet"
              description="Record cargo as it arrives at the China warehouse."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking No.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Packages</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Order</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r: ApiWarehouseReceipt) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm font-semibold">{r.supplierTrackingNumber}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 border ${
                        r.status === "MATCHED"
                          ? "text-green-700 border-green-200 bg-green-50"
                          : "text-amber-700 border-amber-200 bg-amber-50"
                      }`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(r.receivedAt), "MMM d, yyyy · HH:mm")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.packageCount ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.weightKg ? `${r.weightKg} kg` : "-"}</TableCell>
                    <TableCell>
                      {r.orderId ? (
                        <Link href={`/orders/${r.orderId}`} className="text-sm text-primary hover:underline">View order</Link>
                      ) : (
                        <Link href="/unmatched-cargo" className="text-sm text-amber-700 hover:underline">Match →</Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
