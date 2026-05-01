// Envia broadcast manual de email para um público (all, plan:xxx, user:xxx).
// Apenas admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!roles?.some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { templateId, audience = "all", variablesOverride = {} } = await req.json();
    if (!templateId) return new Response(JSON.stringify({ error: "templateId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: tpl } = await admin.from("email_templates").select("*").eq("id", templateId).maybeSingle();
    if (!tpl) return new Response(JSON.stringify({ error: "Template not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Resolve recipients
    let query = admin.from("profiles").select("user_id, email, full_name").not("email", "is", null);
    if (audience.startsWith("plan:")) {
      const plan = audience.split(":")[1];
      query = query.eq("plan", plan);
    } else if (audience.startsWith("user:")) {
      query = query.eq("user_id", audience.split(":")[1]);
    }
    const { data: recipients } = await query;

    const { data: bc } = await admin.from("email_broadcasts").insert({
      template_id: templateId,
      audience,
      variables_override: variablesOverride,
      total_recipients: recipients?.length || 0,
      status: "running",
      created_by: user.id,
    }).select().single();

    let sent = 0, failed = 0;
    for (const r of recipients || []) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/send-system-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({
            templateKey: tpl.key,
            userId: r.user_id,
            recipientEmail: r.email,
            variables: { user_name: r.full_name || "", ...variablesOverride },
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (j.email === "sent" || j.inapp) sent++; else failed++;
      } catch { failed++; }
    }

    await admin.from("email_broadcasts").update({
      sent_count: sent, failed_count: failed,
      status: failed === 0 ? "completed" : (sent > 0 ? "completed" : "failed"),
      completed_at: new Date().toISOString(),
    }).eq("id", bc!.id);

    return new Response(JSON.stringify({ ok: true, sent, failed, total: recipients?.length || 0, broadcast_id: bc!.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
