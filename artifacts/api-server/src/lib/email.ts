import { Resend } from "resend";
import { logger } from "./logger";
import { statusCopy } from "@workspace/order-statuses";

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export interface SendStatusEmailParams {
  customerEmail: string;
  customerName: string;
  trackingId: string;
  status: string;
  statusMessage: string | null;
  trackingLink: string;
  businessName: string;
  supportEmail: string;
  // Admin-customizable copy (from Settings). All optional; sensible defaults
  // are applied below so an empty value never produces an empty email.
  //   emailGreeting    - opening line, `{name}` is replaced with customer name.
  //   emailSignature   - sign-off block, `{businessName}` is replaced.
  //   emailFooterNote  - single paragraph above the support email line.
  emailGreeting?: string | null;
  emailSignature?: string | null;
  emailFooterNote?: string | null;
}

// ─── Customization helpers ──────────────────────────────────────────────────
function renderGreeting(template: string | null | undefined, customerName: string): string {
  const t = (template ?? "").trim() || "Hi {name},";
  return t.replace(/\{name\}/gi, customerName);
}

function renderSignature(template: string | null | undefined, businessName: string): string {
  const t = (template ?? "").trim() || "- {businessName}";
  return t.replace(/\{businessName\}/gi, businessName);
}

function renderFooterNote(template: string | null | undefined): string {
  return (template ?? "").trim();
}

// Status copy is now sourced from @workspace/order-statuses so the admin
// preview and the actual outgoing email cannot drift.
const copyFor = statusCopy;

// Only allow safe URL schemes through to the email so a malicious
// `websiteUrl` (e.g. `javascript:`) can't end up as a clickable link in
// the customer's inbox. Returns the original URL if safe, otherwise "".
function safeTrackingLink(url: string): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : "";
  } catch {
    return "";
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── Templates ───────────────────────────────────────────────────────────────
function buildSubject(p: SendStatusEmailParams): string {
  const c = copyFor(p.status);
  // Subject must work in inbox previews. Lead with the headline + tracking ID.
  return `${c.headline} - ${p.trackingId}`;
}

function buildText(p: SendStatusEmailParams): string {
  const c = copyFor(p.status);
  const greeting = renderGreeting(p.emailGreeting, p.customerName);
  const signature = renderSignature(p.emailSignature, p.businessName);
  const footerNote = renderFooterNote(p.emailFooterNote);

  const lines = [
    greeting,
    "",
    c.headline + ".",
    c.intro,
    "",
    `Tracking ID: ${p.trackingId}`,
    `Status: ${p.status}`,
  ];
  if (p.statusMessage && p.statusMessage.trim()) {
    lines.push("", "Note from our team:", p.statusMessage.trim());
  }
  const safeLink = safeTrackingLink(p.trackingLink);
  if (safeLink) {
    lines.push("", "Track your order:", safeLink);
  }
  if (footerNote) {
    lines.push("", footerNote);
  }
  if (p.supportEmail) {
    lines.push("", `Questions? Reply to this email or contact ${p.supportEmail}.`);
  }
  lines.push("", signature);
  return lines.join("\n");
}

function buildHtml(p: SendStatusEmailParams): string {
  const c = copyFor(p.status);
  // p.customerName is escaped inside renderGreeting() via safeGreeting below.
  const safeBusiness = escapeHtml(p.businessName);
  const safeTracking = escapeHtml(p.trackingId);
  const safeStatus = escapeHtml(p.status);
  const safeMessage = p.statusMessage?.trim() ? escapeHtml(p.statusMessage.trim()) : "";
  const safeSupport = p.supportEmail ? escapeHtml(p.supportEmail) : "";
  // Only http(s) URLs survive `safeTrackingLink`; anything else becomes "".
  const validLink = safeTrackingLink(p.trackingLink);
  const safeLink = validLink ? escapeHtml(validLink) : "";

  // Customizable copy - placeholders substituted before escaping so admins
  // can edit wording in Settings without writing HTML.
  const safeGreeting = escapeHtml(renderGreeting(p.emailGreeting, p.customerName));
  // Signature is multi-line: convert newlines to <br> AFTER escaping.
  const safeSignature = escapeHtml(renderSignature(p.emailSignature, p.businessName))
    .replace(/\n/g, "<br />");
  const safeFooterNote = renderFooterNote(p.emailFooterNote)
    ? escapeHtml(renderFooterNote(p.emailFooterNote)).replace(/\n/g, "<br />")
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(buildSubject(p))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;line-height:1.5;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;">

          <!-- Brand header -->
          <tr>
            <td style="padding:24px 32px 0;border-bottom:1px solid #f4f4f5;">
              <p style="margin:0 0 16px;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;font-weight:600;">
                ${safeBusiness}
              </p>
            </td>
          </tr>

          <!-- Status badge + headline -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <span style="display:inline-block;padding:4px 10px;background:${c.accent};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
                ${safeStatus}
              </span>
              <h1 style="margin:16px 0 8px;font-size:24px;font-weight:700;color:#18181b;line-height:1.25;">
                ${escapeHtml(c.headline)}
              </h1>
              <p style="margin:0 0 8px;font-size:15px;color:#27272a;">
                ${safeGreeting}
              </p>
              <p style="margin:0;font-size:15px;color:#52525b;">
                ${escapeHtml(c.intro)}
              </p>
            </td>
          </tr>

          ${safeMessage ? `
          <!-- Admin note -->
          <tr>
            <td style="padding:16px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border-left:3px solid ${c.accent};">
                <tr>
                  <td style="padding:12px 16px;">
                    <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;font-weight:600;">A note from our team</p>
                    <p style="margin:0;font-size:14px;color:#27272a;white-space:pre-wrap;">${safeMessage}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ""}

          <!-- Tracking ID + CTA -->
          <tr>
            <td style="padding:24px 32px;">
              <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;font-weight:600;">Tracking ID</p>
              <p style="margin:0 0 20px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:16px;font-weight:600;color:#18181b;">
                ${safeTracking}
              </p>
              ${safeLink ? `
              <a href="${safeLink}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">
                Track your order &rarr;
              </a>
              <p style="margin:12px 0 0;font-size:12px;color:#a1a1aa;word-break:break-all;">
                Or open: <a href="${safeLink}" style="color:#52525b;text-decoration:underline;">${safeLink}</a>
              </p>` : ""}
            </td>
          </tr>

          <!-- Signature -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <p style="margin:0;font-size:14px;color:#27272a;line-height:1.6;">
                ${safeSignature}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f4f4f5;">
              ${safeFooterNote ? `
              <p style="margin:0 0 8px;font-size:13px;color:#52525b;">
                ${safeFooterNote}
              </p>` : ""}
              <p style="margin:0 0 4px;font-size:13px;color:#52525b;">
                Questions about your order?
              </p>
              <p style="margin:0;font-size:13px;color:#71717a;">
                ${safeSupport
                  ? `Reply to this email or contact <a href="mailto:${safeSupport}" style="color:#18181b;text-decoration:underline;">${safeSupport}</a>.`
                  : `Just reply to this email and we'll be in touch.`}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:16px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                Sent by ${safeBusiness}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Public API kept stable. `buildEmailBody` still returns `{ subject, body }`
// where `body` is the plain-text version we persist to email_notifications
// for audit history (HTML is sent over the wire but not stored).
export function buildEmailBody(params: SendStatusEmailParams): { subject: string; body: string } {
  return {
    subject: buildSubject(params),
    body: buildText(params),
  };
}

export interface SendPasswordResetEmailParams {
  to: string;
  name: string;
  resetLink: string;
  expiresInMinutes: number;
}

export async function sendPasswordResetEmail(
  p: SendPasswordResetEmailParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resend = getResend();
  if (!resend) {
    logger.warn("Resend API key not configured - password reset email not sent");
    return { success: false, error: "Email provider not configured" };
  }
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromAddress) {
    logger.warn("EMAIL_FROM_ADDRESS not configured - password reset email not sent");
    return { success: false, error: "Email sender not configured" };
  }
  const from = `Olyxee <${fromAddress}>`;
  const safeLink = safeTrackingLink(p.resetLink);
  if (!safeLink) {
    return { success: false, error: "Invalid reset link" };
  }
  const subject = "Reset your Olyxee password";
  const text = [
    `Hi ${p.name || "there"},`,
    "",
    "We received a request to reset your Olyxee password.",
    `This link expires in ${p.expiresInMinutes} minutes:`,
    safeLink,
    "",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "- Olyxee",
  ].join("\n");
  const safeName = escapeHtml(p.name || "there");
  const safeUrl = escapeHtml(safeLink);
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;line-height:1.5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e4e7;">
<tr><td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;">Reset your password</h1>
<p style="margin:0 0 16px;font-size:15px;color:#27272a;">Hi ${safeName},</p>
<p style="margin:0 0 16px;font-size:15px;color:#52525b;">We received a request to reset your Olyxee password. Click the button below to choose a new one. This link expires in ${p.expiresInMinutes} minutes.</p>
<p style="margin:0 0 16px;"><a href="${safeUrl}" style="display:inline-block;padding:12px 24px;background:#18181b;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;">Reset password</a></p>
<p style="margin:0 0 16px;font-size:12px;color:#a1a1aa;word-break:break-all;">Or open: <a href="${safeUrl}" style="color:#52525b;text-decoration:underline;">${safeUrl}</a></p>
<p style="margin:24px 0 0;font-size:13px;color:#71717a;">If you didn't request this, you can safely ignore this email - your password won't change.</p>
</td></tr></table></td></tr></table></body></html>`;
  try {
    const result = await resend.emails.send({
      from,
      to: [p.to],
      subject,
      text,
      html,
    });
    if (result.error) {
      console.error("[email] resend error (reset):", result.error);
      return { success: false, error: result.error.message };
    }
    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const e = err as { message?: string; name?: string };
    console.error("[email] exception (reset):", e?.name, e?.message);
    return { success: false, error: "Failed to send email" };
  }
}

export async function sendStatusEmail(params: SendStatusEmailParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  const resend = getResend();

  if (!resend) {
    logger.warn("Resend API key not configured - email not sent");
    return { success: false, error: "Email provider not configured" };
  }

  // Multi-tenant B2B sending: every email goes out from a single verified
  // sender on our own domain, but the display name carries the business's
  // brand and Reply-To points back to that business's support inbox so
  // customer replies reach the right team.
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  if (!fromAddress) {
    logger.warn("EMAIL_FROM_ADDRESS not configured - email not sent");
    return { success: false, error: "Email sender not configured" };
  }

  const escapedName = params.businessName.replace(/["\\]/g, " ").trim() || "Olyxee";
  const from = `${escapedName} <${fromAddress}>`;
  const replyTo = params.supportEmail && /.+@.+\..+/.test(params.supportEmail)
    ? params.supportEmail
    : undefined;

  try {
    const result = await resend.emails.send({
      from,
      to: [params.customerEmail],
      subject: buildSubject(params),
      text: buildText(params),
      html: buildHtml(params),
      ...(replyTo ? { replyTo } : {}),
    });

    if (result.error) {
      console.error("[email] resend error:", result.error);
      logger.error({ error: result.error }, "Failed to send email via Resend");
      return { success: false, error: result.error.message };
    }

    return { success: true, messageId: result.data?.id };
  } catch (err) {
    const e = err as { message?: string; name?: string };
    console.error("[email] exception:", e?.name, e?.message);
    logger.error({ err }, "Exception sending email");
    return { success: false, error: "Failed to send email" };
  }
}

export interface SendInvoiceEmailParams {
  customerEmail: string; customerName: string; customerAddress?: string | null;
  invoiceNumber: string; createdAt: Date; dueDate: Date; description: string;
  serviceDetails: string; quantity: number; subtotal: number; additionalCharges: number;
  total: number; currency: string; businessName: string; supportEmail: string;
  companyRegistration?: string; businessPhone?: string | null; businessAddress?: string | null;
  logoUrl?: string | null;
}

export async function sendInvoiceEmail(p: SendInvoiceEmailParams): Promise<{success:boolean;messageId?:string;error?:string}> {
  const resend=getResend();
  if(!resend)return {success:false,error:"Email provider not configured"};
  const fromAddress=process.env.EMAIL_FROM_ADDRESS;
  if(!fromAddress)return {success:false,error:"Email sender not configured"};
  const money=(value:number)=>`${p.currency} ${value.toFixed(2)}`;
  const date=(value:Date)=>value.toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
  const address=escapeHtml(p.customerAddress||"").replace(/\n/g,"<br />");
  const details=escapeHtml(p.serviceDetails).replace(/\n/g,"<br />");
  const html=`<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:Arial,sans-serif;color:#111827"><table role="presentation" width="100%" style="max-width:760px;margin:auto;background:white;border-collapse:collapse"><tr><td style="padding:42px 48px"><table width="100%"><tr><td valign="top"><h1 style="margin:0 0 14px;font-size:28px">${escapeHtml(p.businessName)}</h1><div style="font-size:15px;line-height:1.55">${escapeHtml(p.invoiceNumber)}<br>${p.companyRegistration?`Company Reg No: ${escapeHtml(p.companyRegistration)}<br>`:""}${escapeHtml(p.supportEmail)}${p.businessPhone?`<br>${escapeHtml(p.businessPhone)}`:""}${p.businessAddress?`<br>${escapeHtml(p.businessAddress)}`:""}</div></td><td align="right" valign="top"><strong style="font-size:18px">Invoice</strong><div style="margin-top:14px;line-height:1.55">Created: ${date(p.createdAt)}<br>Due: ${date(p.dueDate)}<br>Status: pending payment<br>Client: ${escapeHtml(p.customerName)}</div></td></tr></table><hr style="border:0;border-top:1px solid #e5e7eb;margin:38px 0 22px"><h3 style="margin:0 0 8px">Bill To</h3><div style="line-height:1.55">${escapeHtml(p.customerName)}${address?`<br>${address}`:""}</div><table width="100%" style="border-collapse:collapse;margin-top:24px"><thead><tr style="background:#f1f5f9;color:#64748b"><th align="left" style="padding:11px">Item</th><th align="right">Qty</th><th align="right">Rate</th><th align="right" style="padding-right:11px">Amount</th></tr></thead><tbody><tr><td style="padding:12px 11px"><strong>${escapeHtml(p.description)}</strong><div style="color:#64748b;margin-top:7px">${details}</div></td><td align="right">${p.quantity}</td><td align="right">${money(p.subtotal)}</td><td align="right" style="padding-right:11px"><strong>${money(p.subtotal)}</strong></td></tr>${p.additionalCharges?`<tr><td style="padding:8px 11px">Additional charges</td><td></td><td></td><td align="right" style="padding-right:11px">${money(p.additionalCharges)}</td></tr>`:""}</tbody></table><table width="45%" align="right" style="margin-top:18px"><tr><td><strong style="font-size:18px">Total</strong></td><td align="right"><strong style="font-size:18px">${money(p.total)}</strong></td></tr></table><div style="clear:both;padding-top:34px"><h3>Payment details</h3><div style="line-height:1.55">Account name: FREIGHTSHIFT INTERNATIONAL LOGISTICS (PTY) LTD<br>Bank: FNB<br>Account number: 63214036732<br>Branch code: 256505<br>Account type: GOLD BUSINESS ACCOUNT<br>Reference: ${escapeHtml(p.customerName)} (${escapeHtml(p.description)})</div><h3 style="margin-top:28px">Notes</h3><p>Payment due within agreed terms. Tracking updates begin after payment is confirmed.</p></div></td></tr></table></body></html>`;
  const text=`Invoice ${p.invoiceNumber}\nStatus: pending payment\nClient: ${p.customerName}\nItem: ${p.description}\nTotal: ${money(p.total)}\n\nPayment details\nFNB - 63214036732 - Branch 256505\nReference: ${p.customerName} (${p.description})\n\nTracking updates begin after payment is confirmed.`;
  const safeLogo=/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp);base64,)/i.test(p.logoUrl||"")?p.logoUrl||"":"";
  const emailHtml=safeLogo?html.replace('<td valign="top">',`<td valign="top"><img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(p.businessName)}" style="display:block;max-width:150px;max-height:70px;margin:0 0 16px;object-fit:contain">`):html;
  try{
    const result=await resend.emails.send({from:`${p.businessName.replace(/["\\]/g," ")} <${fromAddress}>`,to:[p.customerEmail],subject:`Invoice ${p.invoiceNumber} - payment required`,html:emailHtml,text,replyTo:p.supportEmail});
    if(result.error)return {success:false,error:result.error.message};
    return {success:true,messageId:result.data?.id};
  }catch{return {success:false,error:"Failed to send invoice email"};}
}
