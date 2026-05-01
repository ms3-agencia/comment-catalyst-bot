// Reenvia email de confirmação pelo SMTP da plataforma (gerando novo token).
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

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ success: false, error: "missing_email", message: "Email não informado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const ip = getClientIp(req);

    // Rate limit por EMAIL: 3 tentativas / 15 minutos
    const { data: emailRl } = await admin.rpc("check_auth_rate_limit", {
      _identifier: email,
      _action: "resend_confirmation_email",
      _max_attempts: 3,
      _window_seconds: 900,
    });
    if (emailRl && emailRl.allowed === false) {
      return new Response(JSON.stringify({
        success: false,
        error: "rate_limit_exceeded",
        message: emailRl.message || "Muitas tentativas para este email. Aguarde alguns minutos.",
        retry_after_seconds: emailRl.retry_after_seconds,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit por IP: 10 tentativas / 1 hora
    const { data: ipRl } = await admin.rpc("check_auth_rate_limit", {
      _identifier: ip,
      _action: "resend_confirmation_ip",
      _max_attempts: 10,
      _window_seconds: 3600,
    });
    if (ipRl && ipRl.allowed === false) {
      return new Response(JSON.stringify({
        success: false,
        error: "rate_limit_exceeded",
        message: "Muitas tentativas a partir deste dispositivo. Tente novamente mais tarde.",
        retry_after_seconds: ipRl.retry_after_seconds,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Busca usuário pelo profile (público) — evita listar auth.users
    const { data: profile } = await admin
      .from("profiles").select("user_id, full_name, email").eq("email", email).maybeSingle();

    if (!profile) {
      // Resposta genérica para não vazar existência de email
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verifica se já está confirmado consultando admin
    const { data: userInfo } = await admin.auth.admin.getUserById(profile.user_id);
    if (userInfo?.user?.email_confirmed_at) {
      return new Response(JSON.stringify({ success: true, alreadyConfirmed: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gera token em claro (só vai no email) e armazena apenas o hash SHA-256.
    const token = genToken();
    const tokenHashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(tokenHashBuf))
      .map((b) => b.toString(16).padStart(2, "0")).join("");

    await admin.from("email_confirmation_tokens").insert({
      user_id: profile.user_id,
      email,
      token: "", // não persistimos o token em claro
      token_hash: tokenHash,
    });

    const { data: appUrlSetting } = await admin
      .from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const appUrl = (appUrlSetting?.value || "").replace(/\/+$/, "");
    const confirmationUrl = `${appUrl}/auth/confirm?token=${token}`;

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-system-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateKey: "email_confirmation",
        userId: profile.user_id,
        recipientEmail: email,
        variables: {
          user_name: profile.full_name || email.split("@")[0],
          confirmation_url: confirmationUrl,
        },
      }),
    }).catch((e) => ({ ok: false, statusText: String(e) } as any));

    return new Response(JSON.stringify({
      success: true, email_sent: (sendRes as Response).ok,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("resend-confirmation error", e);
    return new Response(JSON.stringify({ success: false, error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
