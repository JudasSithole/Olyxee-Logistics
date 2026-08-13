export function canConfirmInvoicePaid(status: string): boolean {
  return status === "sent" || status === "overdue" || status === "paid";
}
