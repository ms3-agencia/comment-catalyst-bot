// Confirma email do usuário via token customizado (enviado pelo SMTP da plataforma)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ||
      (req.method === "POST" ? (await req.json().catch(() => ({}))).token : null);

    if (!token) {
      return new Response(JSON.stringify({ success: false, error: "missing_token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await supabase
      .from("email_confirmation_tokens")
      .select("id, user_id, email, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (error || !row) {
      return new Response(JSON.stringify({ success: false, error: "invalid_token" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (row.used_at) {
      return new Response(JSON.stringify({ success: true, alreadyUsed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: "expired_token" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Confirma o email no auth.users
    const { error: updErr } = await supabase.auth.admin.updateUserById(row.user_id, {
      email_confirm: true,
    });
    if (updErr) {
      console.error("auth update error", updErr);
      return new Response(JSON.stringify({ success: false, error: "confirm_failed" }), {
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
