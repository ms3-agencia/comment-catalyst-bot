// Processa regras de envio agendado de emails (plan_renewal, low_credits).
// Idempotente via tabela email_rule_runs (UNIQUE rule_id+user_id+run_date).
// Roda via pg_cron (recomendado a cada 30min). Verifica hora/minuto da regra.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function generatePaymentLink(admin: any, userId: string, plan: string): Promise<string | null> {
  try {
    const { data: tokenSetting } = await admin.from("app_settings").select("value").eq("key", "mercadopago_access_token").maybeSingle();
    const accessToken = tokenSetting?.value;
    if (!accessToken) return null;

    const { data: planConfig } = await admin.from("plan_configs").select("display_name, price_brl").eq("plan", plan).maybeSingle();
    if (!planConfig || Number(planConfig.price_brl) <= 0) return null;

    const { data: profile } = await admin.from("profiles").select("email").eq("user_id", userId).maybeSingle();
    const { data: appUrl } = await admin.from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const baseUrl = appUrl?.value || "";

    const { data: order } = await admin.from("payment_orders").insert({
      user_id: userId,
      order_type: "plan",
      target_plan: plan,
      amount_brl: planConfig.price_brl,
      credits: 0,
      status: "pending",
    }).select().single();

    if (!order) return null;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ id: order.id, title: `Renovação: ${planConfig.display_name}`, quantity: 1, currency_id: "BRL", unit_price: Number(Number(planConfig.price_brl).toFixed(2)) }],
        payer: { email: profile?.email },
        external_reference: order.id,
        notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
        back_urls: { success: `${baseUrl}/dashboard/credits?status=success`, failure: `${baseUrl}/dashboard/credits?status=failure`, pending: `${baseUrl}/dashboard/credits?status=pending` },
        auto_return: "approved",
        metadata: { user_id: userId, order_id: order.id, order_type: "plan" },
      }),
    });
    const mpData = await mpRes.json().catch(() => ({}));
    if (!mpRes.ok) {
      await admin.from("payment_orders").update({ status: "rejected", raw_payload: mpData }).eq("id", order.id);
      return null;
    }
    await admin.from("payment_orders").update({ preference_id: mpData.id, raw_payload: mpData }).eq("id", order.id);
    return mpData.init_point || null;
  } catch (e) {
    console.error("generatePaymentLink error", e);
    return null;
  }
}

async function dispatchEmail(supabaseUrl: string, serviceKey: string, payload: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/send-system-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const currentHour = now.getUTCHours() - 3; // BRT
    const normalizedHour = (currentHour + 24) % 24;
    const today = now.toISOString().slice(0, 10);

    const { data: appUrl } = await admin.from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const baseUrl = appUrl?.value || "";

    // Buscar todas regras ativas com seus templates
    const { data: rules } = await admin
      .from("email_template_rules")
      .select("*, email_templates!inner(*)")
      .eq("enabled", true);

    let totalSent = 0;
    let totalFailed = 0;
    const ruleResults: any[] = [];

    for (const rule of rules || []) {
      const tpl = (rule as any).email_templates;
      if (!tpl?.enabled) continue;

      // Janela de tolerância de 1h: roda se currentHour está entre rule.send_hour e send_hour+1
      // (assume cron a cada 30min)
      const ruleHour = rule.send_hour ?? 9;
      if (Math.abs(normalizedHour - ruleHour) > 0) continue;

      let sent = 0, failed = 0, candidates = 0;

      if (rule.trigger_event === "plan_renewal") {
        // Buscar usuários cujo monthly_reset_at - offset_days = hoje
        const targetDate = new Date(now.getTime() - rule.offset_days * 24 * 3600 * 1000);
        const dayStart = new Date(targetDate); dayStart.setUTCHours(0,0,0,0);
        const dayEnd = new Date(targetDate); dayEnd.setUTCHours(23,59,59,999);

        const { data: users } = await admin
          .from("user_credits")
          .select("user_id, monthly_reset_at")
          .gte("monthly_reset_at", dayStart.toISOString())
          .lte("monthly_reset_at", dayEnd.toISOString());

        for (const u of users || []) {
          candidates++;
          const { data: prof } = await admin.from("profiles").select("plan, full_name, email").eq("user_id", u.user_id).maybeSingle();
          if (!prof || prof.plan === "free") continue;

          // Idempotência
          const { error: idemErr } = await admin.from("email_rule_runs").insert({
            rule_id: rule.id, user_id: u.user_id, run_date: today, status: "pending",
          });
          if (idemErr) continue; // duplicado

          const { data: planCfg } = await admin.from("plan_configs").select("display_name").eq("plan", prof.plan).maybeSingle();
          const renewalDate = new Date(u.monthly_reset_at);
          const daysLeft = Math.max(0, Math.ceil((renewalDate.getTime() - now.getTime()) / (24 * 3600 * 1000)));

          const paymentLink = await generatePaymentLink(admin, u.user_id, prof.plan);

          const ok = await dispatchEmail(supabaseUrl, serviceKey, {
            templateKey: tpl.key,
            userId: u.user_id,
            recipientEmail: prof.email,
            variables: {
              user_name: prof.full_name || "",
              plan_name: planCfg?.display_name || prof.plan,
              days_left: daysLeft,
              renewal_date: renewalDate.toLocaleDateString("pt-BR"),
              payment_link: paymentLink || `${baseUrl}/dashboard/credits`,
              plans_url: `${baseUrl}/dashboard/credits`,
            },
            link: "/dashboard/credits",
          });

          await admin.from("email_rule_runs").update({
            status: ok ? "sent" : "failed",
          }).eq("rule_id", rule.id).eq("user_id", u.user_id).eq("run_date", today);

          if (ok) sent++; else failed++;
        }
      } else if (rule.trigger_event === "low_credits") {
        const threshold = (rule.conditions as any)?.threshold ?? 10;
        const { data: users } = await admin
          .from("user_credits")
          .select("user_id, balance")
          .lte("balance", threshold)
          .gt("balance", 0);

        for (const u of users || []) {
          candidates++;
          const { error: idemErr } = await admin.from("email_rule_runs").insert({
            rule_id: rule.id, user_id: u.user_id, run_date: today, status: "pending",
          });
          if (idemErr) continue;

          const { data: prof } = await admin.from("profiles").select("full_name, email").eq("user_id", u.user_id).maybeSingle();
          const ok = await dispatchEmail(supabaseUrl, serviceKey, {
            templateKey: tpl.key,
            userId: u.user_id,
            recipientEmail: prof?.email,
            variables: {
              user_name: prof?.full_name || "",
              credits_balance: u.balance,
              credits_url: `${baseUrl}/dashboard/credits`,
            },
            link: "/dashboard/credits",
          });

          await admin.from("email_rule_runs").update({ status: ok ? "sent" : "failed" })
            .eq("rule_id", rule.id).eq("user_id", u.user_id).eq("run_date", today);

          if (ok) sent++; else failed++;
        }
      }

      ruleResults.push({ rule_id: rule.id, event: rule.trigger_event, offset_days: rule.offset_days, candidates, sent, failed });
      totalSent += sent; totalFailed += failed;
    }

    return new Response(JSON.stringify({ ok: true, total_sent: totalSent, total_failed: totalFailed, rules: ruleResults, ran_at: now.toISOString() }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
