// supabase/functions/create-mp-preference/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const packageId = body?.package_id as string | undefined;
    if (!packageId || typeof packageId !== "string") {
      return new Response(JSON.stringify({ error: "package_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: pkg, error: pkgErr } = await admin.from("credit_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
    if (pkgErr || !pkg) {
      return new Response(JSON.stringify({ error: "Pacote não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tokenSetting } = await admin.from("app_settings").select("value").eq("key", "mercadopago_access_token").maybeSingle();
    const accessToken = tokenSetting?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado pelo administrador" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: backUrlSetting } = await admin.from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const baseUrl = backUrlSetting?.value || req.headers.get("origin") || "https://example.com";

    // Create order first to obtain external_reference
    const { data: order, error: orderErr } = await admin.from("payment_orders").insert({
      user_id: user.id,
      package_id: pkg.id,
      amount_brl: pkg.price_brl,
      credits: pkg.credits,
      status: "pending",
    }).select().single();
    if (orderErr || !order) {
      return new Response(JSON.stringify({ error: orderErr?.message || "Falha ao criar ordem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/mp-webhook`;

    const preferencePayload = {
      items: [{
        id: pkg.id,
        title: `${pkg.name} — ${pkg.credits} créditos`,
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(pkg.price_brl),
      }],
      payer: { email: user.email },
      external_reference: order.id,
      notification_url: webhookUrl,
      back_urls: {
        success: `${baseUrl}/dashboard/credits?status=success`,
        failure: `${baseUrl}/dashboard/credits?status=failure`,
        pending: `${baseUrl}/dashboard/credits?status=pending`,
      },
      auto_return: "approved",
      metadata: { user_id: user.id, package_id: pkg.id, order_id: order.id },
    };

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
    });

    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      await admin.from("payment_orders").update({ status: "rejected", raw_payload: mpData }).eq("id", order.id);
      return new Response(JSON.stringify({ error: "Mercado Pago error", detail: mpData }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("payment_orders").update({ preference_id: mpData.id, raw_payload: mpData }).eq("id", order.id);

    return new Response(JSON.stringify({
      preference_id: mpData.id,
      init_point: mpData.init_point,
      sandbox_init_point: mpData.sandbox_init_point,
      order_id: order.id,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
