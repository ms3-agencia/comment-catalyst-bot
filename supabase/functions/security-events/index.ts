// Edge function: security-events
// Recebe eventos de segurança do frontend (login_success, login_failure, password_reset_requested, password_changed),
// captura o IP do request, registra na tabela login_events / audit_log via SECURITY DEFINER RPCs,
// e dispara email de alerta quando um login bem-sucedido vier de dispositivo novo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type EventType =
  | "login_success"
  | "login_failure"
  | "password_reset_requested"
  | "password_changed"
  | "email_changed";

interface Body {
  type: EventType;
  email?: string;
  fingerprint?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") || "";
  const cf = req.headers.get("cf-connecting-ip") || "";
  return (cf || fwd.split(",")[0] || "").trim().slice(0, 64);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);

    const body = (await req.json().catch(() => ({}))) as Body;
    if (!body?.type) {
      return new Response(JSON.stringify({ error: "missing_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = clientIp(req);
    const ua = (body.user_agent || req.headers.get("user-agent") || "").slice(0, 500);
    const email = (body.email || "").toLowerCase().trim().slice(0, 254);

    // Resolve user_id pelo email (se houver)
    let userId: string | null = null;
    if (email) {
      const { data: profile } = await admin
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .maybeSingle();
      userId = (profile?.user_id as string) ?? null;
    }

    // Limites de payload
    const fp = (body.fingerprint || "").slice(0, 80);

    if (body.type === "login_failure") {
      if (email) {
        await admin.rpc("record_login_failure", { _identifier: email });
      }
      if (userId) {
        await admin.rpc("record_login_event", {
          _user_id: userId,
          _email: email,
          _success: false,
          _ip: ip,
          _ua: ua,
          _fingerprint: fp,
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.type === "login_success") {
      if (!userId) {
        return new Response(JSON.stringify({ ok: true, skipped: "no_user" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rec } = await admin.rpc("record_login_event", {
        _user_id: userId,
        _email: email,
        _success: true,
        _ip: ip,
        _ua: ua,
        _fingerprint: fp,
      });

      const isNewDevice = (rec as { is_new_device?: boolean } | null)?.is_new_device === true;

      // Audit + alerta de novo dispositivo
      await admin.from("audit_log").insert({
        user_id: userId,
        actor_id: userId,
        action: isNewDevice ? "login_new_device" : "login_success",
        ip_address: ip,
        user_agent: ua,
        metadata: { email, fingerprint: fp || null },
      });

      if (isNewDevice && email) {
        try {
          await admin.functions.invoke("send-system-email", {
            body: {
              to: email,
              subject: "🔐 Novo acesso detectado na sua conta YCaptura",
              text:
                `Detectamos um login bem-sucedido em sua conta a partir de um dispositivo ou navegador novo.\n\n` +
                `IP: ${ip || "desconhecido"}\nDispositivo: ${ua || "desconhecido"}\nQuando: ${new Date().toLocaleString("pt-BR")}\n\n` +
                `Se foi você, pode ignorar este e-mail. Caso contrário, recomendamos trocar sua senha imediatamente em: ` +
                `${url.replace(".supabase.co", "")}/dashboard/settings`,
              html: `
                <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0a1019;color:#e6f7ff;border-radius:12px">
                  <h2 style="color:#22d3ee;margin:0 0 8px">🔐 Novo acesso detectado</h2>
                  <p>Detectamos um login bem-sucedido em sua conta YCaptura a partir de um <b>dispositivo ou navegador novo</b>.</p>
                  <ul style="line-height:1.8">
                    <li><b>IP:</b> ${ip || "desconhecido"}</li>
                    <li><b>Dispositivo:</b> ${ua || "desconhecido"}</li>
                    <li><b>Quando:</b> ${new Date().toLocaleString("pt-BR")}</li>
                  </ul>
                  <p>Se foi você, pode ignorar este e-mail.</p>
                  <p>Se <b>não</b> foi você, recomendamos trocar sua senha imediatamente.</p>
                </div>
              `,
            },
          });
        } catch (_e) { /* falha ao enviar email não bloqueia o login */ }
      }

      return new Response(JSON.stringify({ ok: true, is_new_device: isNewDevice }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Eventos genéricos vão só no audit_log
    await admin.from("audit_log").insert({
      user_id: userId,
      actor_id: userId,
      action: body.type,
      ip_address: ip,
      user_agent: ua,
      metadata: (body.metadata as Record<string, unknown>) || {},
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[security-events] error", err);
    return new Response(JSON.stringify({ ok: false, error: "internal_error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
