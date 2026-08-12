import { Resend } from "resend";
import { logger } from "./logger";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) resendClient = new Resend(apiKey);
  return resendClient;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format integer minor units as a human amount, e.g. (123456, "ZAR") -> "ZAR 1,234.56". */
export function formatMoneyMinor(minor: number, currency: string): string {
  const major = minor / 100;
  const formatted = major.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

export interface SendInvoiceEmailParams {
  customerEmail: string;
  customerName: string;
  businessName: string;
  supportEmail: string;
  invoiceNumber: string;
  trackingId: string;
  orderReference: string | null;
  subtotalMinor: number;
  additionalChargesMinor: number;
  totalMinor: number;
  currency: string;
  dueDate: string | null;
  notes: string | null;
}

export function buildInvoiceEmailBody(p: SendInvoiceEmailParams): {
  subject: string;
  body: string;
} {
  const subject = `Invoice ${p.invoiceNumber} from ${p.businessName} - ${p.trackingId}`;
  const lines = [
    `Hi ${p.customerName},`,
    "",
    `Thanks for your order. Please find your invoice below. Shipping begins once payment is confirmed.`,
    "",
    `Invoice number: ${p.invoiceNumber}`,
    `Order tracking ID: ${p.trackingId}`,
    ...(p.orderReference ? [`Order reference: ${p.orderReference}`] : []),
    "",
    `Subtotal: ${formatMoneyMinor(p.subtotalMinor, p.currency)}`,
    `Additional charges: ${formatMoneyMinor(p.additionalChargesMinor, p.currency)}`,
    `Total due: ${formatMoneyMinor(p.totalMinor, p.currency)}`,
    ...(p.dueDate ? ["", `Due date: ${p.dueDate}`] : []),
    ...(p.notes && p.notes.trim() ? ["", p.notes.trim()] : []),
    "",
    p.supportEmail
      ? `Questions? Reply to this email or contact ${p.supportEmail}.`
      : "Questions? Just reply to this email.",
    "",
    `- ${p.businessName}`,
  ];
  return { subject, body: lines.join("\n") };
}

function buildHtml(p: SendInvoiceEmailParams): string {
  const b = escapeHtml(p.businessName);
  const row = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:6px 0;font-size:14px;color:#52525b;">${label}</td><td align="right" style="padding:6px 0;font-size:14px;color:#18181b;${bold ? "font-weight:700;" : ""}">${escapeHtml(value)}</td></tr>`;
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;line-height:1.5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;">
<tr><td style="padding:24px 32px 0;"><p style="margin:0 0 16px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;font-weight:600;">${b}</p></td></tr>
<tr><td style="padding:8px 32px 0;">
<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;">Invoice ${escapeHtml(p.invoiceNumber)}</h1>
<p style="margin:0 0 8px;font-size:15px;color:#27272a;">Hi ${escapeHtml(p.customerName)},</p>
<p style="margin:0 0 16px;font-size:15px;color:#52525b;">Thanks for your order. Shipping begins once payment is confirmed.</p>
</td></tr>
<tr><td style="padding:0 32px 8px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e4e4e7;border-bottom:1px solid #e4e4e7;">
${row("Order tracking ID", p.trackingId)}
${p.orderReference ? row("Order reference", p.orderReference) : ""}
${row("Subtotal", formatMoneyMinor(p.subtotalMinor, p.currency))}
${row("Additional charges", formatMoneyMinor(p.additionalChargesMinor, p.currency))}
${row("Total due", formatMoneyMinor(p.totalMinor, p.currency), true)}
${p.dueDate ? row("Due date", p.dueDate) : ""}
</table>
</td></tr>
${p.notes && p.notes.trim() ? `<tr><td style="padding:8px 32px 0;"><p style="margin:0;font-size:14px;color:#52525b;white-space:pre-wrap;">${escapeHtml(p.notes.trim())}</p></td></tr>` : ""}
<tr><td style="padding:24px 32px;">
<p style="margin:0 0 4px;font-size:13px;color:#52525b;">Questions about this invoice?</p>
<p style="margin:0;font-size:13px;color:#71717a;">${p.supportEmail ? `Reply to this email or contact <a href="mailto:${escapeHtml(p.supportEmail)}" style="color:#18181b;">${escapeHtml(p.supportEmail)}</a>.` : "Just reply to this email."}</p>
</td></tr>
<tr><td style="padding:0 32px 24px;"><p style="margin:0;font-size:12px;color:#a1a1aa;">Sent by ${b}</p></td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendInvoiceEmail(p: SendInvoiceEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const resend = getResend();
  if (!resend) {
    logger.warn("Resend API key not configured - invoice email not sent");
    return { success: false, error: "Email provider not configured" };
  }
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromAddress) {
    logger.warn("EMAIL_FROM_ADDRESS not configured - invoice email not sent");
    return { success: false, error: "Email sender not configured" };
  }
  const escapedName = p.businessName.replace(/["\\]/g, " ").trim() || "Olyxee";
  const from = `${escapedName} <${fromAddress}>`;
  const replyTo =
    p.supportEmail && /.+@.+\..+/.test(p.supportEmail) ? p.supportEmail : undefined;
  const { subject, body } = buildInvoiceEmailBody(p);
  try {
    const result = await resend.emails.send({
      from,
      to: [p.customerEmail],
      subject,
      text: body,
      html: buildHtml(p),
      ...(replyTo ? { replyTo } : {}),
    });
    if (result.error) {
      logger.error({ error: result.error }, "Failed to send invoice email via Resend");
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    logger.error({ err }, "Exception sending invoice email");
    return { success: false, error: "Failed to send email" };
  }
}
