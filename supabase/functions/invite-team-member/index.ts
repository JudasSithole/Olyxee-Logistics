import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * invite-team-member
 *
 * Creates a team_invite row and sends an invitation email.
 *
 * POST body:
 *   { email: string, role: 'admin' | 'manager' | 'staff', business_id: string }
 *
 * Requires: JWT of an owner or admin
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Use caller's JWT so RLS applies
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Service role for inserts that need to bypass RLS
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { email, role, business_id } = await req.json();

    if (!email || !role || !business_id) {
      return new Response(JSON.stringify({ error: "email, role and business_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate role value
    if (!["admin", "manager", "staff"].includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role. Must be admin, manager, or staff." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the calling user's profile (verifies they're owner/admin)
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role, business_id")
      .eq("id", user.id)
      .single();

    if (!callerProfile || !["owner", "admin"].includes(callerProfile.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: only owners and admins can invite team members" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (callerProfile.business_id !== business_id) {
      return new Response(JSON.stringify({ error: "Forbidden: business mismatch" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for duplicate pending invite
    const { data: existing } = await supabaseAdmin
      .from("team_invites")
      .select("id")
      .eq("business_id", business_id)
      .eq("email", email.toLowerCase())
      .is("accepted_at", null)
      .gte("expires_at", new Date().toISOString())
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "A pending invite already exists for this email" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create the invite
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("team_invites")
      .insert({
        business_id,
        email: email.toLowerCase(),
        role,
        invited_by: user.id,
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Fetch business name for the email
    const { data: business } = await supabaseAdmin
      .from("businesses")
      .select("name, support_email")
      .eq("id", business_id)
      .single();

    const appUrl = Deno.env.get("PUBLIC_APP_URL") ?? "https://app.orderloop.app";
    const acceptUrl = `${appUrl}/accept-invite?token=${invite.token}`;

    // Send invitation email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const { Resend } = await import("https://esm.sh/resend@3");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: `${business?.name ?? "Courier Loop"} <invites@${Deno.env.get("EMAIL_FROM_DOMAIN") ?? "orderloop.app"}>`,
        to: [email],
        subject: `You've been invited to join ${business?.name ?? "Courier Loop"}`,
        html: buildInviteEmail({
          businessName: business?.name ?? "Courier Loop",
          role,
          acceptUrl,
          expiryDays: 7,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, invite_id: invite.id }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("invite-team-member error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildInviteEmail(opts: {
  businessName: string;
  role: string;
  acceptUrl: string;
  expiryDays: number;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
    <tr><td style="background:#f97316;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Team Invitation</h1>
    </td></tr>
    <tr><td style="padding:32px;">
      <p style="margin:0 0 16px;font-size:16px;color:#111;">You've been invited to join <strong>${opts.businessName}</strong> on Courier Loop as a <strong>${opts.role}</strong>.</p>
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">This invitation expires in ${opts.expiryDays} days.</p>
      <a href="${opts.acceptUrl}"
         style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">
        Accept Invitation
      </a>
    </td></tr>
    <tr><td style="padding:24px 32px;border-top:1px solid #f3f4f6;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">If you weren't expecting this, you can safely ignore this email.</p>
    </td></tr>
  </table>
</body>
</html>`;
}
