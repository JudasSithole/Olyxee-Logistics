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
  // Company-defined Job Number (e.g. CFS-0024), shown to the customer alongside
  // the tracking ID. Optional so older callers/tests still compile.
  jobNumber?: string | null;
  // Customer-facing shipment progress, oldest-first. Built from the Job's
  // tracking events (customer-visible statuses only — never internal notes).
  // Each label is a friendly status; `done` marks reached stages.
  timeline?: { label: string; done: boolean }[];
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
  ];
  if (p.jobNumber && p.jobNumber.trim()) {
    lines.push(`Job Number: ${p.jobNumber.trim()}`);
  }
  lines.push(
    `${p.businessName} Tracking ID: ${p.trackingId}`,
    `Status: ${p.status}`,
  );
  if (p.timeline && p.timeline.length) {
    lines.push("", "Tracking progress:");
    for (const t of p.timeline) {
      lines.push(`${t.done ? "[x]" : "[ ]"} ${t.label}`);
    }
  }
  if (p.statusMessage && p.statusMessage.trim()) {
    lines.push("", "Note from our team:", p.statusMessage.trim());
  }
  const safeLink = safeTrackingLink(p.trackingLink);
  if (safeLink) {
    lines.push("", "View full tracking:", safeLink);
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
  const safeJobNumber = p.jobNumber?.trim() ? escapeHtml(p.jobNumber.trim()) : "";
  // Customer-facing progress list. Reached stages show a green check; any
  // not-yet-reached stages (if a caller passes them) show a muted circle.
  const timeline = p.timeline ?? [];
  const timelineHtml = timeline.length
    ? `
              <p style="margin:20px 0 8px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;font-weight:600;">Tracking progress</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">
                ${timeline
                  .map(
                    (t) =>
                      `<tr><td style="padding:3px 0;font-size:14px;color:${t.done ? "#1a1a1a" : "#a1a1aa"};white-space:nowrap;">${t.done ? "&#10003;" : "&#9675;"}&nbsp;&nbsp;<span style="color:${t.done ? "#1a1a1a" : "#a1a1aa"};">${escapeHtml(t.label)}</span></td></tr>`,
                  )
                  .join("")}
              </table>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(buildSubject(p))}</title>
</head>
<body style="margin:0;padding:32px 20px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:auto;border-collapse:collapse;">

    <!-- Business header -->
    <tr>
      <td style="padding-bottom:20px;border-bottom:1px solid #e5e7eb;">
        <strong style="font-size:15px;color:#1a1a1a;">${safeBusiness}</strong>
      </td>
    </tr>

    <!-- Status headline -->
    <tr>
      <td style="padding:26px 0 0;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:bold;">${safeStatus}</p>
        <h1 style="margin:0 0 14px;font-size:22px;font-weight:bold;color:#1a1a1a;line-height:1.3;">${escapeHtml(c.headline)}</h1>
        <p style="margin:0 0 8px;font-size:15px;">${safeGreeting}</p>
        <p style="margin:0;font-size:15px;color:#374151;">${escapeHtml(c.intro)}</p>
      </td>
    </tr>

    ${safeMessage ? `
    <!-- Admin note -->
    <tr>
      <td style="padding:22px 0 0;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:bold;">A note from our team</p>
        <p style="margin:0;font-size:14px;color:#374151;white-space:pre-wrap;">${safeMessage}</p>
      </td>
    </tr>` : ""}

    <!-- Identifiers + progress + CTA -->
    <tr>
      <td style="padding:26px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;"><tr><td style="padding-top:24px;">
        ${safeJobNumber ? `
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:bold;">Job number</p>
        <p style="margin:0 0 16px;font-size:15px;font-weight:bold;color:#1a1a1a;">${safeJobNumber}</p>` : ""}
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-weight:bold;">${safeBusiness} Tracking ID</p>
        <p style="margin:0;font-size:15px;font-weight:bold;color:#1a1a1a;">${safeTracking}</p>
        ${timelineHtml}
        ${safeLink ? `
        <p style="margin:22px 0 0;"><a href="${safeLink}" style="display:inline-block;padding:11px 22px;background:#1a1a1a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;">View full tracking</a></p>
        <p style="margin:10px 0 0;font-size:12px;color:#6b7280;word-break:break-all;">Or open: <a href="${safeLink}" style="color:#374151;">${safeLink}</a></p>` : ""}
        </td></tr></table>
      </td>
    </tr>

    <!-- Signature -->
    <tr>
      <td style="padding:24px 0 0;">
        <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${safeSignature}</p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:22px 0 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;"><tr><td style="padding-top:22px;">
        ${safeFooterNote ? `<p style="margin:0 0 8px;font-size:13px;color:#6b7280;">${safeFooterNote}</p>` : ""}
        <p style="margin:0;font-size:13px;color:#6b7280;">Questions about your shipment? ${safeSupport
          ? `Reply to this email or contact <a href="mailto:${safeSupport}" style="color:#1a1a1a;">${safeSupport}</a>.`
          : `Just reply to this email and we&#39;ll be in touch.`}</p>
        </td></tr></table>
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
  customerEmail: string; customerName: string; customerAddress?: string | null; customerPhone?: string | null;
  invoiceNumber: string; createdAt: Date; dueDate: Date; description: string;
  serviceDetails: string; quantity: number; subtotal: number; additionalCharges: number;
  total: number; currency: string; businessName: string; supportEmail: string;
  companyRegistration?: string; businessPhone?: string | null; businessAddress?: string | null;
  taxNumber?: string | null; logoUrl?: string | null; paymentDetails?: string | null;
  paymentTerms?: string | null; footerNote?: string | null; primaryColor?: string | null;
  orderReference?: string | null; jobNumber?: string | null; trackingId?: string | null; externalTrackingNumber?: string | null;
  origin?: string | null; destination?: string | null; transportMode?: string | null; weight?: string | null;
}

export async function sendInvoiceEmail(p: SendInvoiceEmailParams): Promise<{success:boolean;messageId?:string;error?:string}> {
  const resend=getResend();
  if(!resend)return {success:false,error:"Email provider not configured"};
  const fromAddress=process.env.EMAIL_FROM_ADDRESS;
  if(!fromAddress)return {success:false,error:"Email sender not configured"};
  const money=(value:number)=>`${p.currency} ${value.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const date=(value:Date)=>value.toLocaleDateString("en-ZA",{day:"2-digit",month:"short",year:"numeric"});
  const payment=escapeHtml(p.paymentDetails||"Contact the issuer for payment instructions.").replace(/\n/g,"<br />");
  const terms=escapeHtml(p.paymentTerms||"Payment due within agreed terms.");
  const safeLogo=/^(https?:\/\/|data:image\/(png|jpeg|jpg|webp);base64,)/i.test(p.logoUrl||"")?p.logoUrl||"":"";
  const logo=safeLogo?`<img src="${escapeHtml(safeLogo)}" alt="${escapeHtml(p.businessName)}" style="display:block;max-width:150px;max-height:52px;object-fit:contain">`:`<strong style="font-size:19px;color:#1a1a1a">${escapeHtml(p.businessName)}</strong>`;
  const route=[p.origin,p.destination].filter(Boolean).join(" → ");
  const emailHtml=`<!doctype html><html><body style="margin:0;background:#ffffff;padding:32px 20px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6">
<table role="presentation" width="100%" style="max-width:560px;margin:auto;border-collapse:collapse">
  <tr><td style="padding-bottom:22px;border-bottom:1px solid #e5e7eb">${logo}</td></tr>
  <tr><td style="padding:26px 0 0">
    <p style="margin:0 0 14px;font-size:15px">Hi ${escapeHtml(p.customerName)},</p>
    <p style="margin:0;font-size:15px;color:#374151">Thank you for confirming your shipment with ${escapeHtml(p.businessName)}. Your invoice is attached to this email as a PDF. A summary is below.</p>
  </td></tr>
  <tr><td style="padding:24px 0 0">
    <table role="presentation" width="100%" style="font-size:14px;border-collapse:collapse">
      <tr><td style="padding:7px 0;color:#6b7280">Invoice number</td><td align="right" style="padding:7px 0">${escapeHtml(p.invoiceNumber)}</td></tr>
      <tr><td style="padding:7px 0;color:#6b7280;border-top:1px solid #eef0f3">Shipment</td><td align="right" style="padding:7px 0;border-top:1px solid #eef0f3">${escapeHtml(p.description)}</td></tr>
      ${route?`<tr><td style="padding:7px 0;color:#6b7280;border-top:1px solid #eef0f3">Route</td><td align="right" style="padding:7px 0;border-top:1px solid #eef0f3">${escapeHtml(route)}</td></tr>`:""}
      <tr><td style="padding:7px 0;color:#6b7280;border-top:1px solid #eef0f3">Due date</td><td align="right" style="padding:7px 0;border-top:1px solid #eef0f3">${date(p.dueDate)}</td></tr>
      <tr><td style="padding:12px 0 0;border-top:2px solid #1a1a1a;font-weight:bold">Total due</td><td align="right" style="padding:12px 0 0;border-top:2px solid #1a1a1a;font-weight:bold;font-size:16px">${money(p.total)}</td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:24px 0 0;border-top:1px solid #e5e7eb">
    <p style="margin:24px 0 8px;font-size:14px;font-weight:bold">Payment details</p>
    <p style="margin:0;font-size:14px;color:#374151">${payment}</p>
    <p style="margin:10px 0 0;font-size:14px;color:#374151">Payment reference: <strong>${escapeHtml(p.invoiceNumber)}</strong></p>
    <p style="margin:6px 0 0;font-size:13px;color:#6b7280">${terms}</p>
  </td></tr>
  <tr><td style="padding:24px 0;border-top:1px solid #e5e7eb;font-size:14px;color:#374151">
    <p style="margin:0">Once payment is confirmed, we will begin sharing shipment updates. If you have any questions, simply reply to this email.</p>
    ${p.footerNote?`<p style="margin:12px 0 0;font-size:13px;color:#6b7280">${escapeHtml(p.footerNote)}</p>`:""}
  </td></tr>
  <tr><td style="padding:20px 0 0;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.6;color:#6b7280">
    <strong style="color:#1a1a1a">${escapeHtml(p.businessName)}</strong><br>${escapeHtml(p.supportEmail)}${p.businessPhone?` &middot; ${escapeHtml(p.businessPhone)}`:""}<br>The PDF invoice is attached to this email.
  </td></tr>
</table>
</body></html>`;
  const text=`Hi ${p.customerName},\n\nYour invoice from ${p.businessName} is ready and attached as a PDF.\n\nTotal due: ${money(p.total)}\nDue date: ${date(p.dueDate)}\nInvoice: ${p.invoiceNumber}\nShipment: ${p.description}${route?`\nRoute: ${route}`:""}\n\nPayment details\n${p.paymentDetails||"Contact the issuer for payment instructions."}\nPayment reference: ${p.invoiceNumber}\n\n${p.paymentTerms||"Payment due within agreed terms."}\n\nOnce payment is confirmed, we’ll begin sharing shipment updates. Reply to this email if you need help.\n\n${p.businessName}`;
  try{
    const { buildInvoicePdf } = await import("./invoice-pdf");
    const pdf = await buildInvoicePdf(p);
    const result=await resend.emails.send({from:`${p.businessName.replace(/["\\]/g," ")} <${fromAddress}>`,to:[p.customerEmail],subject:`Invoice ${p.invoiceNumber} attached - ${money(p.total)} due`,html:emailHtml,text,replyTo:p.supportEmail,attachments:[{filename:`${p.invoiceNumber}.pdf`,content:pdf}]});
    if(result.error)return {success:false,error:result.error.message};
    return {success:true,messageId:result.data?.id};
  }catch{return {success:false,error:"Failed to send invoice email"};}
}
