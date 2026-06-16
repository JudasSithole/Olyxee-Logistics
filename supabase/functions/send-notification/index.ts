import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  order_id: string;
  /** Optionally override the channel ('email' | 'sms' | 'whatsapp') */
  channel?: string;
  /** If provided, override the template body/subject */
  custom_message?: string;
  custom_subject?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const payload: NotificationPayload = await req.json();
    const { order_id, channel = "email", custom_message, custom_subject } = payload;

    if (!order_id) {
      return new Response(JSON.stringify({ error: "order_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch order + customer + business + latest tracking event ──────────
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        customers ( full_name, email, phone ),
        businesses ( name, support_email, email_greeting, email_signature, email_footer_note, notification_email, notification_sms, notification_whatsapp )
      `)
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const business = order.businesses;
    const customer = order.customers;

    // ── Find matching notification template ────────────────────────────────
    let subject = custom_subject ?? `Your order ${order.tracking_id} has been updated`;
    let body = custom_message ?? "";

    if (!body) {
      const { data: template } = await supabase
        .from("notification_templates")
        .select("*")
        .eq("business_id", order.business_id)
        .eq("channel", channel)
        .eq("trigger_status", order.current_status)
        .eq("is_active", true)
        .maybeSingle();

      if (template) {
        subject = template.subject ?? subject;
        body = template.body;
      } else {
        // Fallback body
        body = `Hi ${customer.full_name},\n\nYour order ${order.tracking_id} status has been updated to: ${order.current_status}.\n\nThank you,\n${business.name}`;
      }
    }

    // ── Replace template variables ─────────────────────────────────────────
    const trackingUrl = `${Deno.env.get("PUBLIC_APP_URL") ?? "https://app.orderloop.app"}/track/${order.tracking_id}`;
    body = body
      .replace(/\{\{customer_name\}\}/g, customer.full_name)
      .replace(/\{\{status\}\}/g, order.current_status)
      .replace(/\{\{tracking_id\}\}/g, order.tracking_id)
      .replace(/\{\{tracking_url\}\}/g, trackingUrl)
      .replace(/\{\{business_name\}\}/g, business.name)
      .replace(/\{\{order_reference\}\}/g, order.order_reference ?? "");
    subject = subject
      .replace(/\{\{customer_name\}\}/g, customer.full_name)
      .replace(/\{\{status\}\}/g, order.current_status)
      .replace(/\{\{tracking_id\}\}/g, order.tracking_id)
      .replace(/\{\{business_name\}\}/g, business.name);

    let providerMessageId: string | null = null;
    let sendError: string | null = null;

    // ── Send via channel ───────────────────────────────────────────────────
    if (channel === "email" && business.notification_email !== false) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) throw new Error("RESEND_API_KEY not set");

      const resend = new Resend(resendKey);
      const fromAddress = `${business.name} <notifications@${Deno.env.get("EMAIL_FROM_DOMAIN") ?? "orderloop.app"}>`;

      const htmlBody = buildEmailHtml({
        greeting: business.email_greeting ?? `Hi ${customer.full_name}`,
        body,
        signature: business.email_signature ?? `The ${business.name} team`,
        footer: business.email_footer_note ?? "",
        trackingUrl,
        trackingId: order.tracking_id,
      });

      const { data: sent, error: resendError } = await resend.emails.send({
        from: fromAddress,
        to: [customer.email],
        subject,
        html: htmlBody,
      });

      if (resendError) {
        sendError = resendError.message;
      } else {
        providerMessageId = sent?.id ?? null;
      }
    }
    // SMS and WhatsApp would be added here (Twilio / Meta API)

    // ── Log notification ───────────────────────────────────────────────────
    const { error: logError } = await supabase.from("notification_logs").insert({
      order_id,
      business_id: order.business_id,
      customer_id: order.customer_id,
      channel,
      recipient: channel === "email" ? customer.email : (customer.phone ?? ""),
      subject: channel === "email" ? subject : null,
      body,
      status: sendError ? "failed" : "sent",
      provider_message_id: providerMessageId,
      error_message: sendError,
      sent_at: sendError ? null : new Date().toISOString(),
    });

    if (logError) console.error("Failed to write notification_log:", logError);

    // Mark tracking event as notified
    await supabase
      .from("tracking_events")
      .update({ notified: true })
      .eq("order_id", order_id)
      .eq("status", order.current_status)
      .is("notified", false);

    if (sendError) {
      return new Response(JSON.stringify({ success: false, error: sendError }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, provider_message_id: providerMessageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── HTML email builder ─────────────────────────────────────────────────────
function buildEmailHtml(opts: {
  greeting: string;
  body: string;
  signature: string;
  footer: string;
  trackingUrl: string;
  trackingId: string;
}): string {
  const bodyHtml = opts.body.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Order Update</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <tr><td style="background:#f97316;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Order Update</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#111;">${opts.greeting},</p>
      <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">${bodyHtml}</p>
      <a href="${opts.trackingUrl}"
         style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Track Order ${opts.trackingId}
      </a>
    </td></tr>
    <tr><td style="padding:24px 32px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:14px;color:#6b7280;">${opts.signature}</p>
      ${opts.footer ? `<p style="margin:8px 0 0;font-size:12px;color:#9ca3af;">${opts.footer}</p>` : ""}
    </td></tr>
  </table>
</body>
</html>`;
}
