import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/page-loader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Invoice = {
  id: string;
  invoiceNumber: string;
  trackingId: string | null;
  orderReference: string | null;
  customerName: string | null;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  currency: string;
  total: string;
  createdAt: string;
};

const statusStyles: Record<Invoice["status"], string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  cancelled: "bg-muted text-muted-foreground",
};

export default function InvoicesPage() {
  const [, navigate] = useLocation();
  const query = useQuery({
    queryKey: ["invoices"],
    queryFn: () => apiFetch<{ data: Invoice[]; total: number }>("/api/invoices"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {query.data?.total ?? 0} total invoices · generated from accepted orders
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="space-y-3 p-6" role="status" aria-label="Loading invoices">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}
            </div>
          ) : query.isError ? (
            <div className="p-8 text-center">
              <p className="font-medium">Unable to load invoices</p>
              <p className="mt-1 text-sm text-muted-foreground">Please try again.</p>
              <Button className="mt-4" variant="outline" onClick={() => query.refetch()}>Retry</Button>
            </div>
          ) : !query.data?.data.length ? (
            <EmptyState
              icon={<FileText className="h-12 w-12" />}
              title="No invoices yet"
              description="Open an accepted order to generate its first draft invoice."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.data.map((invoice) => (
                  <TableRow key={invoice.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                    <TableCell className="font-mono font-semibold">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.customerName ?? "—"}</TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{invoice.trackingId ?? "—"}</div>
                      {invoice.orderReference ? <div className="text-xs text-muted-foreground">{invoice.orderReference}</div> : null}
                    </TableCell>
                    <TableCell><Badge className={statusStyles[invoice.status]}>{invoice.status}</Badge></TableCell>
                    <TableCell className="font-medium">{invoice.currency} {Number(invoice.total).toFixed(2)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(invoice.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                      <Link href={`/invoices/${invoice.id}`}><Button size="sm" variant="secondary">View</Button></Link>
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
