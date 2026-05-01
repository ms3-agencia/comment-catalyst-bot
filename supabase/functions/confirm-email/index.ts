// Confirma email do usuário via token customizado.
// Segurança:
// - Aceita SOMENTE POST com token no body (nunca em query string).
// - Valida e marca como usado em uma única operação atômica (RPC).
// - Não diferencia "token inexistente" de "token já usado" para o cliente.
// - Rate limit por IP e por prefixo do token.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Bloqueia GET / outros métodos para evitar token em query string e em referers/logs
  if (req.method !== "POST") {
    return json({ success: false, error: "method_not_allowed", message: "Use POST." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token || token.length < 16) {
      return json({ success: false, error: "missing_token", message: "Token não informado." }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Rate limit por IP — 5 tentativas / 10 min
    const ip = getClientIp(req);
    const { data: ipRl } = await supabase.rpc("check_auth_rate_limit", {
      _identifier: ip,
      _action: "confirm_email_validate_ip",
      _max_attempts: 5,
      _window_seconds: 600,
    });
    if (ipRl && ipRl.allowed === false) {
      return json({
        success: false,
        error: "rate_limit_exceeded",
        message: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
        retry_after_seconds: ipRl.retry_after_seconds,
      }, 429);
    }

    // Rate limit por prefixo do token — 3 tentativas / 10 min (anti brute-force no MESMO link)
    const tokenPrefix = token.slice(0, 16);
    const { data: tokenRl } = await supabase.rpc("check_auth_rate_limit", {
      _identifier: `tok:${tokenPrefix}`,
      _action: "confirm_email_validate_token",
      _max_attempts: 3,
      _window_seconds: 600,
    });
    if (tokenRl && tokenRl.allowed === false) {
      return json({
        success: false,
        error: "rate_limit_exceeded",
        message: "Muitas tentativas com este link. Solicite um novo email de confirmação.",
        retry_after_seconds: tokenRl.retry_after_seconds,
      }, 429);
    }

    // Consumo ATÔMICO: a RPC valida hash, expiração e marca used_at numa só instrução.
    const { data: result, error: rpcErr } = await supabase.rpc(
      "confirm_email_token_consume",
      { _token: token },
    );

    if (rpcErr) {
      console.error("confirm_email_token_consume error", rpcErr);
      return json({ success: false, error: "confirm_failed", message: "Falha ao validar." }, 500);
    }

    const r = result as { success: boolean; error_code?: string; user_id?: string; email?: string };

    if (!r?.success) {
      if (r?.error_code === "expired_token") {
        return json({ success: false, error: "expired_token", message: "Link expirado. Solicite um novo email." }, 410);
      }
      // Não vazamos se o token "já foi usado" vs "não existe"
      return json({ success: false, error: "invalid_token", message: "Link inválido." }, 404);
    }

    // Confirma o email no auth.users
    const { error: updErr } = await supabase.auth.admin.updateUserById(r.user_id!, {
      email_confirm: true,
    });
    if (updErr) {
      console.error("auth update error", updErr);
      return json({ success: false, error: "confirm_failed", message: "Falha ao confirmar email." }, 500);
    }

    return json({ success: true, email: r.email });
  } catch (e) {
    console.error("confirm-email error", e);
    return json({ success: false, error: "internal_error", message: "Erro inesperado." }, 500);
  }
});
