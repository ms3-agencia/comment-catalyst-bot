// supabase/functions/mp-webhook/index.ts
// Webhook público do Mercado Pago — credita créditos quando pagamento é aprovado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

async function fireSystemEmail(payload: Record<string, unknown>) {
  try {
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-system-email`;
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn("fireSystemEmail failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const topic = url.searchParams.get("topic") || url.searchParams.get("type") || body?.type;
    const dataId = url.searchParams.get("data.id") || body?.data?.id;

    if (topic !== "payment" || !dataId) {
      return new Response("ignored", { status: 200, headers: corsHeaders });
    }

    const { data: tokenSetting } = await admin.from("app_settings").select("value").eq("key", "mercadopago_access_token").maybeSingle();
    const accessToken = tokenSetting?.value;
    if (!accessToken) {
      return new Response("no token configured", { status: 200, headers: corsHeaders });
    }

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const payment = await payRes.json();
    if (!payRes.ok) {
      console.error("MP fetch payment failed", payment);
      return new Response("payment fetch failed", { status: 200, headers: corsHeaders });
    }

    const orderId = payment.external_reference;
    const status = payment.status; // approved | rejected | pending | in_process | cancelled | refunded
    if (!orderId) return new Response("no external_reference", { status: 200, headers: corsHeaders });

    const { data: order } = await admin.from("payment_orders").select("*").eq("id", orderId).maybeSingle();
    if (!order) return new Response("order not found", { status: 200, headers: corsHeaders });

    const mappedStatus =
      status === "approved" ? "approved" :
      status === "rejected" || status === "cancelled" ? "rejected" :
      status === "refunded" ? "refunded" : "pending";

    // Idempotency: only credit once
    if (order.status === "approved") {
      return new Response("already processed", { status: 200, headers: corsHeaders });
    }

    await admin.from("payment_orders").update({
      status: mappedStatus,
      payment_id: String(dataId),
      raw_payload: payment,
    }).eq("id", orderId);

    if (mappedStatus === "approved") {
      if (order.order_type === "plan" && order.target_plan) {
        const { data: planConfig } = await admin
          .from("plan_configs")
          .select("monthly_credits")
          .eq("plan", order.target_plan)
          .maybeSingle();

        await admin
          .from("profiles")
          .update({ plan: order.target_plan })
          .eq("user_id", order.user_id);

        if (planConfig) {
          await admin
            .from("user_credits")
            .upsert({
              user_id: order.user_id,
              monthly_allocation: planConfig.monthly_credits,
              monthly_reset_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
            }, { onConflict: "user_id" });
        }
      } else if (order.order_type === "addon" && order.addon_id) {
        // Activate add-on
        const { data: addon } = await admin.from("addons").select("*").eq("id", order.addon_id).maybeSingle();
        if (addon) {
          const expiresAt = addon.billing_type === "monthly"
            ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
            : null;
          await admin.from("user_addons").upsert({
            user_id: order.user_id,
            addon_id: order.addon_id,
            billing_type: addon.billing_type,
            expires_at: expiresAt,
            payment_method: "mercado_pago",
            status: "active",
            activated_at: new Date().toISOString(),
          }, { onConflict: "user_id,addon_id" });
        }
      } else {
        // Credit user
        const { data: existing } = await admin
          .from("user_credits")
          .select("balance")
          .eq("user_id", order.user_id)
          .maybeSingle();

        if (existing) {
          await admin
            .from("user_credits")
            .update({ balance: existing.balance + order.credits })
            .eq("user_id", order.user_id);
        } else {
          await admin
            .from("user_credits")
            .insert({ user_id: order.user_id, balance: order.credits });
        }

        await admin.from("credit_transactions").insert({
          user_id: order.user_id,
          amount: order.credits,
          type: "purchase",
          description: `Pagamento aprovado MP #${dataId}`,
          reference_id: order.id,
        });
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("webhook error", e);
    return new Response("err", { status: 200, headers: corsHeaders });
  }
});
