// Verifica usuários cujo plano renova nos próximos 3 dias e dispara aviso.
// Agendado via pg_cron (1x por dia).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const now = Date.now();
    const in3days = new Date(now + 3 * 24 * 3600 * 1000).toISOString();
    const in1day = new Date(now + 1 * 24 * 3600 * 1000).toISOString();

    const { data: users } = await admin
      .from("user_credits")
      .select("user_id, monthly_reset_at")
      .gte("monthly_reset_at", in1day)
      .lte("monthly_reset_at", in3days);

    let sent = 0;
    for (const u of users || []) {
      const { data: prof } = await admin.from("profiles").select("plan, full_name, email").eq("user_id", u.user_id).maybeSingle();
      if (!prof || prof.plan === "free") continue;
      const { data: plan } = await admin.from("plan_configs").select("display_name").eq("plan", prof.plan).maybeSingle();
      const renewalDate = new Date(u.monthly_reset_at);
      const daysLeft = Math.ceil((renewalDate.getTime() - now) / (24 * 3600 * 1000));

      // Idempotência: não enviar se já enviou nas últimas 24h
      const { data: recent } = await admin.from("email_send_log")
        .select("id").eq("template_key", "plan_renewal")
        .eq("recipient_user_id", u.user_id)
        .gte("created_at", new Date(now - 24 * 3600 * 1000).toISOString()).limit(1);
      if (recent && recent.length > 0) continue;

      await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-system-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          templateKey: "plan_renewal",
          userId: u.user_id,
          recipientEmail: prof.email,
          variables: {
            user_name: prof.full_name || "",
            plan_name: plan?.display_name || prof.plan,
            days_left: daysLeft,
            renewal_date: renewalDate.toLocaleDateString("pt-BR"),
          },
        }),
      });
      sent++;
    }

    return new Response(JSON.stringify({ ok: true, checked: users?.length || 0, sent }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
