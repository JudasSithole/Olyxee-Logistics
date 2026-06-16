import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * export-report
 *
 * Generates a CSV export of orders for a given date range.
 *
 * POST body:
 *   {
 *     format: 'csv',
 *     from?: string (ISO date),
 *     to?: string (ISO date),
 *     status?: string,
 *   }
 *
 * Requires: authenticated user JWT
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

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get caller's business_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("business_id")
      .eq("id", user.id)
      .single();

    if (!profile?.business_id) {
      return new Response(JSON.stringify({ error: "No business associated with this account" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json() : {};
    const { from, to, status } = body;

    // Build the query
    let query = supabaseAdmin
      .from("orders")
      .select(`
        id, tracking_id, order_reference, current_status, description,
        estimated_completion, is_archived, created_at, updated_at,
        customers ( full_name, email, phone, company_name )
      `)
      .eq("business_id", profile.business_id)
      .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", from);
    if (to)   query = query.lte("created_at", to);
    if (status) query = query.eq("current_status", status);

    const { data: orders, error: ordersError } = await query;
    if (ordersError) throw ordersError;

    // Build CSV
    const headers = [
      "Tracking ID", "Order Reference", "Customer Name", "Customer Email",
      "Customer Phone", "Company", "Status", "Description",
      "Estimated Completion", "Created At",
    ];

    const rows = (orders ?? []).map((o) => [
      o.tracking_id,
      o.order_reference ?? "",
      o.customers?.full_name ?? "",
      o.customers?.email ?? "",
      o.customers?.phone ?? "",
      o.customers?.company_name ?? "",
      o.current_status,
      o.description ?? "",
      o.estimated_completion ?? "",
      o.created_at,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => {
          const str = String(cell);
          // Escape cells that contain commas, quotes or newlines
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        }).join(",")
      )
      .join("\n");

    const filename = `orders-export-${new Date().toISOString().split("T")[0]}.csv`;

    return new Response(csvContent, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });

  } catch (err) {
    console.error("export-report error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
