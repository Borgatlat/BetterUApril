/**
 * Notify counselors/admins in-app after a student creates counselor_alerts row.
 * Deploy: `supabase functions deploy notify-counselors --no-verify-jwt` (or verify JWT + parse user).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY on the Edge Function secret store.
 */
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userErr,
    } = await supabaseUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const org_id = body?.org_id as string;
    const alert_id = body?.alert_id as string;
    if (!org_id || !alert_id) {
      return new Response(JSON.stringify({ error: "org_id and alert_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: alert, error: alertErr } = await supabaseAdmin
      .from("counselor_alerts")
      .select("student_id, student_name")
      .eq("id", alert_id)
      .single();

    if (alertErr || !alert || alert.student_id !== user.id) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: staff } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("org_id", org_id)
      .in("account_type", ["counselor", "admin"]);

    for (const row of staff ?? []) {
      await supabaseAdmin.from("notifications").insert({
        user_id: row.id,
        type: "counselor_support_alert",
        title: "Counselor support requested",
        message: `${alert.student_name ?? "A student"} requested counselor support. Open the school dashboard.`,
        data: { org_id, alert_id },
        priority: 3,
        is_actionable: true,
        action_type: "open_school_dashboard",
        action_data: { alert_id },
      });
    }

    return new Response(JSON.stringify({ ok: true, notified: (staff ?? []).length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
