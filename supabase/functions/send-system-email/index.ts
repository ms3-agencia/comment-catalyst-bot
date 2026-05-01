// Envia email do sistema via SMTP configurado em app_settings + cria notificação in-app.
// Invocada por outras edge functions (mp-webhook) e por triggers no front-end (boas-vindas).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function render(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { templateKey, userId, recipientEmail, variables = {}, link } = await req.json();
    if (!templateKey) {
      return new Response(JSON.stringify({ error: "templateKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega template
    const { data: tpl, error: tplErr } = await admin
      .from("email_templates").select("*").eq("key", templateKey).maybeSingle();
    if (tplErr || !tpl) {
      return new Response(JSON.stringify({ error: "Template não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!tpl.enabled) {
      return new Response(JSON.stringify({ skipped: true, reason: "template disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Branding (site_name, app_url)
    const { data: branding } = await admin.from("branding_settings").select("site_name").maybeSingle();
    const { data: appUrlSetting } = await admin.from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();
    const allVars = {
      site_name: branding?.site_name || "YCaptura",
      app_url: appUrlSetting?.value || "",
      ...variables,
    };

    // Resolve usuário
    let toEmail = recipientEmail as string | undefined;
    let resolvedUserId = userId as string | undefined;
    if (userId && !toEmail) {
      const { data: prof } = await admin.from("profiles").select("email, full_name").eq("user_id", userId).maybeSingle();
      toEmail = prof?.email || undefined;
      if (!allVars.user_name && prof?.full_name) allVars.user_name = prof.full_name;
    }

    const subject = render(tpl.subject, allVars);
    const html = render(tpl.body_html, allVars);

    // 1. Notificação in-app
    if (tpl.send_inapp && resolvedUserId) {
      await admin.from("system_notifications").insert({
        user_id: resolvedUserId,
        title: subject,
        message: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500),
        type: "info",
        link: link || null,
      });
    }

    // 2. Email via SMTP
    let emailStatus = "skipped";
    let emailError: string | null = null;

    if (tpl.send_email && toEmail) {
      const { data: smtpRows } = await admin
        .from("app_settings").select("key, value")
        .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name", "smtp_secure"]);
      const smtp: Record<string, string> = {};
      (smtpRows || []).forEach(r => smtp[r.key] = r.value);

      if (!smtp.smtp_host || !smtp.smtp_user || !smtp.smtp_password) {
        emailStatus = "skipped";
        emailError = "SMTP não configurado";
      } else {
        try {
          const port = parseInt(smtp.smtp_port || "587", 10);
          const isSSL = smtp.smtp_secure === "ssl" || port === 465;
          const client = new SMTPClient({
            connection: {
              hostname: smtp.smtp_host,
              port,
              tls: isSSL,
              auth: { username: smtp.smtp_user, password: smtp.smtp_password },
            },
          });
          await client.send({
            from: `${smtp.smtp_from_name || "YCaptura"} <${smtp.smtp_from_email || smtp.smtp_user}>`,
            to: toEmail,
            subject,
            html,
            content: html.replace(/<[^>]+>/g, " "),
          });
          await client.close();
          emailStatus = "sent";
        } catch (e: any) {
          emailStatus = "failed";
          emailError = String(e?.message || e);
          console.error("SMTP send failed:", emailError);
        }
      }

      await admin.from("email_send_log").insert({
        template_key: templateKey,
        recipient_email: toEmail,
        recipient_user_id: resolvedUserId || null,
        subject,
        status: emailStatus,
        error_message: emailError,
      });
    }

    return new Response(JSON.stringify({ ok: true, email: emailStatus, inapp: !!(tpl.send_inapp && resolvedUserId) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-system-email error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
