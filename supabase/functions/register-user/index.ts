// Cria usuário via service-role SEM disparar email nativo do Supabase, e envia
// o email de confirmação somente pelo SMTP configurado no painel.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function genToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email, password, fullName } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ success: false, error: "missing_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (String(password).length < 6) {
      return new Response(JSON.stringify({ success: false, error: "weak_password" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Cria o usuário com email NÃO confirmado (sem disparar email nativo do Supabase)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName || email.split("@")[0] },
    });

    if (createErr || !created.user) {
      const msg = String(createErr?.message || "create_failed");
      const isDup = /already|registered|exists/i.test(msg);
      return new Response(JSON.stringify({
        success: false,
        error: isDup ? "email_already_registered" : "create_failed",
        message: msg,
      }), {
        status: isDup ? 409 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = created.user.id;

    // Gera token em claro (somente vai no email) e armazena apenas o hash SHA-256.
    const token = genToken();
    const tokenHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuf))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    await admin.from("email_confirmation_tokens").insert({
      user_id: userId, email, token_hash: tokenHash,
    });

    // Resolve domínio configurado
    const { data: appUrlSetting } = await admin
      .from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const appUrl = (appUrlSetting?.value || "").replace(/\/+$/, "");
    const confirmationUrl = `${appUrl}/auth/confirm?token=${token}`;

    // Dispara email pelo SMTP da plataforma
    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-system-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateKey: "email_confirmation",
        userId,
        recipientEmail: email,
        variables: {
          user_name: fullName || email.split("@")[0],
          confirmation_url: confirmationUrl,
        },
      }),
    }).catch((e) => ({ ok: false, statusText: String(e) } as any));

    const emailOk = (sendRes as Response).ok;

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      email_sent: emailOk,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("register-user error", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
