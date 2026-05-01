// Envia email do sistema via SMTP (implementação nativa com STARTTLS) + cria notificação in-app.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

// ---------- SMTP nativo ----------
type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  fromEmail: string;
  fromName: string;
  secureMode: string; // "ssl" | "tls" | "starttls" | "none"
};

class SmtpClient {
  private conn: Deno.Conn | Deno.TlsConn | null = null;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();
  private buffer = "";

  constructor(private cfg: SmtpConfig) {}

  private async readResponse(): Promise<{ code: number; lines: string[]; raw: string }> {
    const lines: string[] = [];
    while (true) {
      // procura uma linha completa no buffer
      const idx = this.buffer.indexOf("\r\n");
      if (idx === -1) {
        const buf = new Uint8Array(4096);
        const n = await this.conn!.read(buf);
        if (n === null) throw new Error("Conexão SMTP fechada inesperadamente");
        this.buffer += this.decoder.decode(buf.subarray(0, n));
        continue;
      }
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 2);
      lines.push(line);
      // formato SMTP multi-linha: "250-foo" continua, "250 foo" termina
      if (/^\d{3} /.test(line)) break;
    }
    const code = parseInt(lines[lines.length - 1].slice(0, 3), 10);
    return { code, lines, raw: lines.join("\n") };
  }

  private async write(data: string): Promise<void> {
    await this.conn!.write(this.encoder.encode(data));
  }

  private async cmd(line: string, expectedCodes: number[]): Promise<{ code: number; raw: string }> {
    await this.write(line + "\r\n");
    const res = await this.readResponse();
    if (!expectedCodes.includes(res.code)) {
      throw new Error(`SMTP comando "${line.split(" ")[0]}" falhou: ${res.raw}`);
    }
    return res;
  }

  async connect(): Promise<void> {
    const isImplicitSSL = this.cfg.secureMode === "ssl" || this.cfg.port === 465;

    if (isImplicitSSL) {
      this.conn = await Deno.connectTls({ hostname: this.cfg.host, port: this.cfg.port });
    } else {
      this.conn = await Deno.connect({ hostname: this.cfg.host, port: this.cfg.port });
    }

    // greeting
    const greeting = await this.readResponse();
    if (greeting.code !== 220) throw new Error(`Greeting inesperado: ${greeting.raw}`);

    // EHLO
    await this.cmd(`EHLO ${this.cfg.host}`, [250]);

    // STARTTLS quando necessário
    const wantsStartTls =
      !isImplicitSSL &&
      this.cfg.secureMode !== "none" &&
      (this.cfg.secureMode === "tls" || this.cfg.secureMode === "starttls" || this.cfg.port === 587);

    if (wantsStartTls) {
      await this.cmd("STARTTLS", [220]);
      // upgrade da conexão para TLS
      // @ts-ignore - startTls está disponível no Deno deploy
      this.conn = await Deno.startTls(this.conn as Deno.Conn, { hostname: this.cfg.host });
      this.buffer = "";
      // reenviar EHLO após TLS
      await this.cmd(`EHLO ${this.cfg.host}`, [250]);
    }

    // AUTH LOGIN
    await this.cmd("AUTH LOGIN", [334]);
    await this.cmd(btoa(this.cfg.user), [334]);
    await this.cmd(btoa(this.cfg.password), [235]);
  }

  async send(to: string, subject: string, html: string, text: string): Promise<void> {
    await this.cmd(`MAIL FROM:<${this.cfg.fromEmail}>`, [250]);
    await this.cmd(`RCPT TO:<${to}>`, [250, 251]);
    await this.cmd("DATA", [354]);

    // headers + body
    const boundary = `----=_Part_${Date.now()}`;
    const fromHeader = `${this.cfg.fromName} <${this.cfg.fromEmail}>`;
    const subjEnc = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
    const lines = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subjEnc}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(text))),
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(html))),
      `--${boundary}--`,
      ``,
      `.`,
    ];
    // dot-stuffing simples: já que body está em base64, não precisa escape
    await this.write(lines.join("\r\n") + "\r\n");
    const res = await this.readResponse();
    if (res.code !== 250) throw new Error(`SMTP DATA falhou: ${res.raw}`);
  }

  async quit(): Promise<void> {
    try {
      await this.write("QUIT\r\n");
    } catch { /* ignore */ }
    try {
      this.conn?.close();
    } catch { /* ignore */ }
    this.conn = null;
  }
}

async function loadSmtpConfig(admin: any): Promise<{ cfg: SmtpConfig | null; missing: string[] }> {
  const { data } = await admin
    .from("app_settings").select("key, value")
    .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "smtp_from_email", "smtp_from_name", "smtp_secure"]);
  const s: Record<string, string> = {};
  (data || []).forEach((r: any) => s[r.key] = r.value);
  const missing: string[] = [];
  if (!s.smtp_host) missing.push("smtp_host");
  if (!s.smtp_user) missing.push("smtp_user");
  if (!s.smtp_password) missing.push("smtp_password");
  if (missing.length) return { cfg: null, missing };
  return {
    cfg: {
      host: s.smtp_host,
      port: parseInt(s.smtp_port || "587", 10),
      user: s.smtp_user,
      password: s.smtp_password,
      fromEmail: s.smtp_from_email || s.smtp_user,
      fromName: s.smtp_from_name || "YCaptura",
      secureMode: (s.smtp_secure || "tls").toLowerCase(),
    },
    missing: [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action } = body;

    // ===== AÇÃO: Testar conexão SMTP =====
    if (action === "test_connection") {
      const { cfg, missing } = await loadSmtpConfig(admin);
      if (!cfg) {
        return new Response(JSON.stringify({ ok: false, error: `SMTP incompleto. Faltando: ${missing.join(", ")}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const client = new SmtpClient(cfg);
      try {
        await client.connect();
        await client.quit();
        return new Response(JSON.stringify({ ok: true, message: "Conexão e autenticação SMTP bem-sucedidas." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        try { await client.quit(); } catch { /* ignore */ }
        return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== AÇÃO: Enviar email simples de teste (sem template) =====
    if (action === "test_send") {
      const { recipientEmail } = body;
      if (!recipientEmail) {
        return new Response(JSON.stringify({ ok: false, error: "recipientEmail obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { cfg, missing } = await loadSmtpConfig(admin);
      if (!cfg) {
        return new Response(JSON.stringify({ ok: false, error: `SMTP incompleto. Faltando: ${missing.join(", ")}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const client = new SmtpClient(cfg);
      try {
        await client.connect();
        const subject = "Teste de envio - YCaptura";
        const html = `<h2>Teste de envio bem-sucedido!</h2><p>Suas configurações SMTP estão funcionando corretamente.</p><p><b>Servidor:</b> ${cfg.host}:${cfg.port}<br/><b>De:</b> ${cfg.fromEmail}</p>`;
        const text = "Teste de envio bem-sucedido! Suas configurações SMTP estão funcionando corretamente.";
        await client.send(recipientEmail, subject, html, text);
        await client.quit();
        await admin.from("email_send_log").insert({
          template_key: "smtp_test",
          recipient_email: recipientEmail,
          subject, status: "sent", error_message: null,
        });
        return new Response(JSON.stringify({ ok: true, message: `Email enviado para ${recipientEmail}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e: any) {
        try { await client.quit(); } catch { /* ignore */ }
        const err = String(e?.message || e);
        await admin.from("email_send_log").insert({
          template_key: "smtp_test",
          recipient_email: recipientEmail,
          subject: "Teste de envio - YCaptura",
          status: "failed", error_message: err,
        });
        return new Response(JSON.stringify({ ok: false, error: err }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== AÇÃO PADRÃO: Enviar via template =====
    const { templateKey, userId, recipientEmail, variables = {}, link } = body;
    if (!templateKey) {
      return new Response(JSON.stringify({ error: "templateKey required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { data: branding } = await admin.from("branding_settings").select("site_name, logo_url").maybeSingle();
    const { data: appUrlSetting } = await admin.from("app_settings").select("value").eq("key", "app_base_url").maybeSingle();

    // Carrega assinatura: a do template, ou a default
    let signature: { body_html: string; logo_url: string | null } | null = null;
    if (tpl.signature_id) {
      const { data: sig } = await admin.from("email_signatures")
        .select("body_html, logo_url, enabled").eq("id", tpl.signature_id).maybeSingle();
      if (sig?.enabled) signature = { body_html: sig.body_html, logo_url: sig.logo_url };
    }
    if (!signature) {
      const { data: defSig } = await admin.from("email_signatures")
        .select("body_html, logo_url").eq("is_default", true).eq("enabled", true).maybeSingle();
      if (defSig) signature = { body_html: defSig.body_html, logo_url: defSig.logo_url };
    }

    const logoUrl = signature?.logo_url || branding?.logo_url || "";
    const siteName = branding?.site_name || "YCaptura";
    // Tag <img> pronta para ser injetada quando o usuário usa {{logo_url}} no corpo/assinatura
    const logoImgTag = logoUrl
      ? `<img src="${logoUrl}" alt="${siteName}" style="max-height:60px;max-width:220px;display:inline-block;border:0;outline:none;text-decoration:none;" />`
      : "";

    const allVars: Record<string, any> = {
      site_name: siteName,
      app_url: appUrlSetting?.value || "",
      // {{logo_url}} agora renderiza a imagem completa (não a URL crua)
      logo_url: logoImgTag,
      // Caso alguém precise da URL pura (ex: src="{{logo_src}}"), disponibilizamos como variável separada
      logo_src: logoUrl,
      ...variables,
    };

    let toEmail = recipientEmail as string | undefined;
    const resolvedUserId = userId as string | undefined;
    if (userId && !toEmail) {
      const { data: prof } = await admin.from("profiles").select("email, full_name").eq("user_id", userId).maybeSingle();
      toEmail = prof?.email || undefined;
      if (!allVars.user_name && prof?.full_name) allVars.user_name = prof.full_name;
    }

    const subject = render(tpl.subject, allVars);
    let bodyHtml = render(tpl.body_html, allVars);

    // Anexa assinatura ao final, se houver
    if (signature?.body_html) {
      const sigHtml = render(signature.body_html, allVars);
      bodyHtml = `${bodyHtml}<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;">${sigHtml}</div>`;
    }

    // Wrapper com logo no topo (se disponível e não já incluído pelo template)
    const html = logoUrl && !tpl.body_html.includes("{{logo_url}}")
      ? `<div style="text-align:center;padding:24px 0;"><img src="${logoUrl}" alt="${allVars.site_name}" style="max-height:48px;max-width:200px;" /></div>${bodyHtml}`
      : bodyHtml;

    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    if (tpl.send_inapp && resolvedUserId) {
      await admin.from("system_notifications").insert({
        user_id: resolvedUserId,
        title: subject,
        message: text.slice(0, 500),
        type: "info",
        link: link || null,
      });
    }

    let emailStatus = "skipped";
    let emailError: string | null = null;

    if (tpl.send_email && toEmail) {
      const { cfg, missing } = await loadSmtpConfig(admin);
      if (!cfg) {
        emailStatus = "skipped";
        emailError = `SMTP não configurado (faltando: ${missing.join(", ")})`;
      } else {
        const client = new SmtpClient(cfg);
        try {
          await client.connect();
          await client.send(toEmail, subject, html, text);
          await client.quit();
          emailStatus = "sent";
        } catch (e: any) {
          try { await client.quit(); } catch { /* ignore */ }
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

    return new Response(JSON.stringify({
      ok: true,
      email: emailStatus,
      error: emailError,
      inapp: !!(tpl.send_inapp && resolvedUserId),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-system-email error:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
