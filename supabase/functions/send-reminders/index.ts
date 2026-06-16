import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * send-reminders
 *
 * Meant to be called on a schedule (e.g. every 5 minutes via a cron job
 * in supabase/config.toml or an external scheduler).
 *
 * Finds all reminders with status='pending' and scheduled_at <= now(),
 * sends the notification, and marks them sent or failed.
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const now = new Date().toISOString();

    // Fetch due reminders
    const { data: reminders, error: fetchError } = await supabase
      .from("reminders")
      .select(`
        *,
        orders ( tracking_id, current_status, business_id ),
        customers ( full_name, email, phone )
      `)
      .eq("status", "pending")
      .lte("scheduled_at", now)
      .limit(50);

    if (fetchError) throw fetchError;
    if (!reminders || reminders.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    let failed = 0;

    for (const reminder of reminders) {
      try {
        // Delegate actual send to send-notification function
        const res = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              order_id: reminder.order_id,
              channel: reminder.channel,
              custom_message: reminder.message,
            }),
          },
        );

        const result = await res.json();

        if (result.success) {
          await supabase
            .from("reminders")
            .update({ status: "sent", sent_at: new Date().toISOString() })
            .eq("id", reminder.id);
          sent++;
        } else {
          await supabase
            .from("reminders")
            .update({ status: "failed" })
            .eq("id", reminder.id);
          failed++;
        }
      } catch (err) {
        console.error(`Failed to send reminder ${reminder.id}:`, err);
        await supabase
          .from("reminders")
          .update({ status: "failed" })
          .eq("id", reminder.id);
        failed++;
      }
    }

    return new Response(JSON.stringify({ processed: reminders.length, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-reminders error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
