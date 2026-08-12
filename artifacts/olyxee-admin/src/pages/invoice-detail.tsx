import { Link, useParams } from "wouter";
import {
  useInvoice,
  useBusiness,
  useSendInvoice,
  useMarkInvoicePaid,
  formatMoneyMinor,
} from "@/hooks/use-supabase-queries";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/page-loader";
import { ArrowLeft, Printer, Send, BadgeCheck, FileX } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "text-muted-foreground border-border bg-muted",
  SENT: "text-blue-700 border-blue-200 bg-blue-50",
  PAID: "text-green-700 border-green-200 bg-green-50",
  CANCELLED: "text-red-700 border-red-200 bg-red-50",
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: invoice, isLoading, refetch } = useInvoice(id);
  const { data: business } = useBusiness(user?.businessId);
  const sendMutation = useSendInvoice();
  const markPaidMutation = useMarkInvoicePaid();

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <EmptyState
        icon={<FileX className="h-12 w-12" />}
        title="Invoice not found"
        description="This invoice may have been removed."
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

  const isPaid = invoice.status === "PAID";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Toolbar (hidden when printing) */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={invoice.orderId ? `/orders/${invoice.orderId}` : "/orders"}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Order
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print / PDF
          </Button>
          {!isPaid && invoice.status !== "CANCELLED" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={sendMutation.isPending}
                onClick={() =>
                  sendMutation.mutate(
                    { invoiceId: invoice.id, orderId: invoice.orderId },
                    {
                      onSuccess: (d) => {
                        d.success ? toast.success("Invoice emailed to customer") : toast.error(d.message || "Invoice email failed");
                        refetch();
                      },
                      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to send invoice"),
                    },
                  )
                }
              >
                <Send className="h-3.5 w-3.5" /> {invoice.status === "SENT" ? "Resend" : "Send"}
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={markPaidMutation.isPending}
                onClick={() =>
                  markPaidMutation.mutate(
                    { invoiceId: invoice.id, orderId: invoice.orderId },
                    {
                      onSuccess: () => {
                        toast.success("Invoice marked as paid");
                        refetch();
                      },
                      onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to mark paid"),
                    },
                  )
                }
              >
                <BadgeCheck className="h-3.5 w-3.5" /> Mark as paid
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Printable invoice document */}
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="p-8 space-y-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold">{business?.name ?? "Invoice"}</h1>
              {business?.support_email && (
                <p className="text-sm text-muted-foreground">{business.support_email}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg font-bold font-mono">{invoice.invoiceNumber}</p>
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 border ${STATUS_STYLES[invoice.status] ?? ""}`}>
                {invoice.status}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Billed to</p>
              {invoice.customer ? (
                <>
                  <p className="font-semibold">{invoice.customer.fullName}</p>
                  <p className="text-muted-foreground">{invoice.customer.email}</p>
                  {invoice.customer.companyName && (
                    <p className="text-muted-foreground">{invoice.customer.companyName}</p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </div>
            <div className="text-right space-y-1">
              <p>
                <span className="text-muted-foreground">Issued: </span>
                {format(new Date(invoice.createdAt), "MMM d, yyyy")}
              </p>
              {invoice.dueDate && (
                <p>
                  <span className="text-muted-foreground">Due: </span>
                  {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                </p>
              )}
              {invoice.order?.trackingId && (
                <p>
                  <span className="text-muted-foreground">Order: </span>
                  <span className="font-mono">{invoice.order.trackingId}</span>
                </p>
              )}
            </div>
          </div>

          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground uppercase">
                  <th className="py-2 font-medium">Description</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">
                    Freight & logistics services
                    {invoice.order?.orderReference ? ` — ${invoice.order.orderReference}` : ""}
                  </td>
                  <td className="py-3 text-right font-mono">
                    {formatMoneyMinor(invoice.subtotalMinor, invoice.currency)}
                  </td>
                </tr>
                {invoice.additionalChargesMinor > 0 && (
                  <tr className="border-b">
                    <td className="py-3">Additional charges</td>
                    <td className="py-3 text-right font-mono">
                      {formatMoneyMinor(invoice.additionalChargesMinor, invoice.currency)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex justify-end mt-4">
              <div className="w-56 space-y-2 text-sm">
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="font-mono">{formatMoneyMinor(invoice.totalMinor, invoice.currency)}</span>
                </div>
                {invoice.paidAt && (
                  <p className="text-xs text-green-700 text-right">
                    Paid {format(new Date(invoice.paidAt), "MMM d, yyyy · HH:mm")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div className="text-sm">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Notes</p>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
