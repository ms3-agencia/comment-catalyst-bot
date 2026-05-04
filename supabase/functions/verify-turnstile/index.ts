// Verifica um token do Cloudflare Turnstile junto à API da Cloudflare.
// A chave secreta é lida de public.app_settings (key='turnstile_secret_key')
// para que o admin possa configurá-la pelo painel sem rebuild.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export async function verifyTurnstileToken(token: string, remoteip?: string): Promise<{ success: boolean; reason?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // 1. Se Turnstile estiver desabilitado, libera (mesmo sem token)
  const { data: enabledRow } = await admin.from("app_settings").select("value").eq("key", "turnstile_enabled").maybeSingle();
  const enabled = (enabledRow?.value || "").toString().toLowerCase() === "true";
  if (!enabled) return { success: true, reason: "disabled" };

  // 2. Se não há secret configurada, libera
  const { data: secretRow } = await admin.from("app_settings").select("value").eq("key", "turnstile_secret_key").maybeSingle();
  const secret = (secretRow?.value || "").toString().trim();
  if (!secret) return { success: true, reason: "no_secret" };

  // 3. Agora sim exige token
  if (!token || typeof token !== "string") {
    return { success: false, reason: "missing_token" };
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteip) form.append("remoteip", remoteip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const json: any = await res.json();
    if (json?.success === true) return { success: true };
    return { success: false, reason: (json?.["error-codes"] || []).join(",") || "verification_failed" };
  } catch (e) {
    return { success: false, reason: "verification_error" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
    const result = await verifyTurnstileToken(token, ip);
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, reason: "bad_request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
