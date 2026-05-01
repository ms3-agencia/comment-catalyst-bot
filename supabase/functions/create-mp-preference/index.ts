// supabase/functions/create-mp-preference/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    console.log("[create-mp-preference] start", req.method, req.url);
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
    const addonId = body?.addon_id as string | undefined;

    if (!packageId && !addonId) {
      return new Response(JSON.stringify({ error: "package_id or addon_id is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tokenSetting } = await admin.from("app_settings").select("value").eq("key", "mercadopago_access_token").maybeSingle();
    const accessToken = tokenSetting?.value;
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Mercado Pago não configurado pelo administrador" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: backUrlSetting } = await admin.from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const baseUrl = backUrlSetting?.value || req.headers.get("origin") || "https://example.com";

    let order: any;
    let itemTitle = "";
    let itemPrice = 0;
    let backPath = "/dashboard/credits";

    if (addonId) {
      const { data: addon, error: addonErr } = await admin.from("addons").select("*").eq("id", addonId).eq("is_active", true).maybeSingle();
      if (addonErr || !addon) {
        return new Response(JSON.stringify({ error: "Add-on não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Calculate discount based on user's plan
      const { data: profile } = await admin.from("profiles").select("plan").eq("user_id", user.id).maybeSingle();
      let finalPrice = Number(addon.price_brl);
      let includedFree = false;
      if (profile?.plan) {
        const { data: planAddon } = await admin
          .from("plan_addons")
          .select("discount_percent, included_free")
          .eq("plan", profile.plan)
          .eq("addon_id", addonId)
          .maybeSingle();
        if (planAddon?.included_free) {
          includedFree = true;
        } else if (planAddon?.discount_percent) {
          finalPrice = finalPrice * (1 - planAddon.discount_percent / 100);
        }
      }

      if (includedFree) {
        // Activate immediately without payment
        const expiresAt = addon.billing_type === "monthly" ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() : null;
        await admin.from("user_addons").upsert({
          user_id: user.id,
          addon_id: addonId,
          billing_type: addon.billing_type,
          expires_at: expiresAt,
          payment_method: "plan_included",
          status: "active",
          activated_at: new Date().toISOString(),
        }, { onConflict: "user_id,addon_id" });

        return new Response(JSON.stringify({ success: true, free: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: o, error: orderErr } = await admin.from("payment_orders").insert({
        user_id: user.id,
        addon_id: addonId,
        order_type: "addon",
        amount_brl: finalPrice,
        credits: 0,
        status: "pending",
      }).select().single();
      if (orderErr || !o) {
        return new Response(JSON.stringify({ error: orderErr?.message || "Falha ao criar ordem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      order = o;
      itemTitle = `Add-on: ${addon.name}${addon.billing_type === "monthly" ? " (mensal)" : ""}`;
      itemPrice = finalPrice;
      backPath = "/dashboard/addons";
    } else {
      const { data: pkg, error: pkgErr } = await admin.from("credit_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
      if (pkgErr || !pkg) {
        return new Response(JSON.stringify({ error: "Pacote não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { data: o, error: orderErr } = await admin.from("payment_orders").insert({
        user_id: user.id,
        package_id: pkg.id,
        order_type: "credits",
        amount_brl: pkg.price_brl,
        credits: pkg.credits,
        status: "pending",
      }).select().single();
      if (orderErr || !o) {
        return new Response(JSON.stringify({ error: orderErr?.message || "Falha ao criar ordem" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      order = o;
      itemTitle = `${pkg.name} — ${pkg.credits} créditos`;
      itemPrice = Number(pkg.price_brl);
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/mp-webhook`;

    const preferencePayload = {
      items: [{
        id: order.id,
        title: itemTitle,
        quantity: 1,
        currency_id: "BRL",
        unit_price: Number(itemPrice.toFixed(2)),
      }],
      payer: { email: user.email },
      external_reference: order.id,
      notification_url: webhookUrl,
      back_urls: {
        success: `${baseUrl}${backPath}?status=success`,
        failure: `${baseUrl}${backPath}?status=failure`,
        pending: `${baseUrl}${backPath}?status=pending`,
      },
      auto_return: "approved",
      metadata: { user_id: user.id, order_id: order.id, order_type: order.order_type },
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
