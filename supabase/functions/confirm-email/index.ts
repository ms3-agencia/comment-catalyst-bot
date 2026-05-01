// Confirma email do usuário via token customizado (enviado pelo SMTP da plataforma)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ||
      (req.method === "POST" ? (await req.json().catch(() => ({}))).token : null);

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "missing_token", message: "Token não informado." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit por IP — protege contra brute force de tokens
    // 5 tentativas / 10 minutos
    const ip = getClientIp(req);
    const { data: ipRl } = await supabase.rpc("check_auth_rate_limit", {
      _identifier: ip,
      _action: "confirm_email_validate_ip",
      _max_attempts: 5,
      _window_seconds: 600,
    });
    if (ipRl && ipRl.allowed === false) {
      return new Response(JSON.stringify({
        success: false,
        error: "rate_limit_exceeded",
        message: "Muitas tentativas de validação. Aguarde alguns minutos antes de tentar novamente.",
        retry_after_seconds: ipRl.retry_after_seconds,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rate limit por TOKEN — bloqueia força bruta no mesmo token
    // 3 tentativas / 10 minutos
    const tokenPrefix = token.slice(0, 16);
    const { data: tokenRl } = await supabase.rpc("check_auth_rate_limit", {
      _identifier: `tok:${tokenPrefix}`,
      _action: "confirm_email_validate_token",
      _max_attempts: 3,
      _window_seconds: 600,
    });
    if (tokenRl && tokenRl.allowed === false) {
      return new Response(JSON.stringify({
        success: false,
        error: "rate_limit_exceeded",
        message: "Muitas tentativas com este link. Solicite um novo email de confirmação.",
        retry_after_seconds: tokenRl.retry_after_seconds,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: row, error } = await supabase
      .from("email_confirmation_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !row) {
      return new Response(JSON.stringify({ success: false, error: "invalid_token", message: "Token inválido." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.used_at) {
      return new Response(JSON.stringify({ success: true, alreadyUsed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: "expired_token", message: "Link expirado. Solicite um novo email." }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma o email no auth.users
    const { error: updErr } = await supabase.auth.admin.updateUserById(row.user_id, {
      email_confirm: true,
    });
    if (updErr) {
      console.error("auth update error", updErr);
      return new Response(JSON.stringify({ success: false, error: "confirm_failed", message: "Falha ao confirmar email." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("email_confirmation_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);

    return new Response(JSON.stringify({ success: true, email: row.email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("confirm-email error", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
