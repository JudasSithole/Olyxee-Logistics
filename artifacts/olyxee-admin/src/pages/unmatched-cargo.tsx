import { useState } from "react";
import { Link } from "wouter";
import {
  useWarehouseReceipts,
  useMatchWarehouseReceipt,
  type ApiWarehouseReceipt,
} from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/page-loader";
import { PackageSearch, Link2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { OrderMatchPicker } from "./warehouse-receipts";

function MatchDialog({
  receipt,
  businessId,
  onClose,
  onMatched,
}: {
  receipt: ApiWarehouseReceipt;
  businessId: string;
  onClose: () => void;
  onMatched: () => void;
}) {
  const [selectedOrder, setSelectedOrder] = useState<{ id: string; label: string } | null>(null);
  const matchMutation = useMatchWarehouseReceipt();

  const submit = () => {
    if (!selectedOrder) return;
    matchMutation.mutate(
      { receiptId: receipt.id, orderId: selectedOrder.id, businessId },
      {
        onSuccess: (data) => {
          if (data.paymentBlocked) {
            toast.warning("Matched - but this order is still awaiting payment, so it stays blocked");
          } else if (data.statusAdvanced) {
            toast.success("Matched - order advanced to Received from Supplier");
          } else {
            toast.success("Receipt matched to order");
          }
          onMatched();
          onClose();
        },
        onError: (err: unknown) =>
          toast.error(err instanceof Error ? err.message : "Failed to match receipt"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Match Cargo to Order</DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <div className="border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Tracking no.: </span>
            <span className="font-mono font-semibold">{receipt.supplierTrackingNumber}</span>
            <span className="text-muted-foreground"> · received {format(new Date(receipt.receivedAt), "MMM d, yyyy")}</span>
          </div>
          <OrderMatchPicker value={selectedOrder} onSelect={setSelectedOrder} />
          <p className="text-xs text-muted-foreground">
            Matching stamps this tracking number on the order. If the order's invoice is unpaid, it stays blocked until payment is confirmed.
          </p>
          <Button className="w-full" disabled={!selectedOrder || matchMutation.isPending} onClick={submit}>
            {matchMutation.isPending ? "Matching..." : "Match to Order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UnmatchedCargoPage() {
  const { user } = useAuth();
  const { data: receipts, isLoading, refetch } = useWarehouseReceipts(user?.businessId, { status: "UNMATCHED" });
  const [matching, setMatching] = useState<ApiWarehouseReceipt | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Unmatched Cargo</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Cargo at the China warehouse that isn't linked to an order yet.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !receipts?.length ? (
            <EmptyState
              icon={<PackageSearch className="h-12 w-12" />}
              title="No unmatched cargo"
              description="Everything received at the warehouse is linked to an order."
              action={
                <Link href="/warehouse-receipts">
                  <Button variant="outline" size="sm">View all receipts</Button>
                </Link>
              }
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tracking No.</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Packages</TableHead>
                  <TableHead>Weight</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm font-semibold">{r.supplierTrackingNumber}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(r.receivedAt), "MMM d, yyyy · HH:mm")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.packageCount ?? "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.weightKg ? `${r.weightKg} kg` : "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{r.notes ?? "-"}</TableCell>
                    <TableCell className="text-right pr-4">
                      <Button size="sm" variant="secondary" className="h-8 text-xs gap-1" onClick={() => setMatching(r)}>
                        <Link2 className="h-3 w-3" /> Match
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {matching && (
        <MatchDialog
          receipt={matching}
          businessId={user?.businessId ?? ""}
          onClose={() => setMatching(null)}
          onMatched={() => refetch()}
        />
      )}
    </div>
  );
}
