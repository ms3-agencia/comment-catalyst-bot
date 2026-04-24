// supabase/functions/mp-webhook/index.ts
// Webhook público do Mercado Pago — credita créditos quando pagamento é aprovado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

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
      // Credit user directly using service role (bypass RLS, no auth.uid())
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

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("webhook error", e);
    return new Response("err", { status: 200, headers: corsHeaders });
  }
});
