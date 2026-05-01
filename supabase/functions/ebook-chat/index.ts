import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é o ASSISTENTE DE CRIAÇÃO DE EBOOKS PREMIUM. Seu papel é guiar o usuário em uma conversa estruturada para construir um eBook de altíssima qualidade.

FLUXO OBRIGATÓRIO (siga em ordem; faça UMA pergunta por vez, espere a resposta):
1. Tema/transformação central do eBook
2. Público-alvo (perfil, dor principal)
3. Nível de profundidade (básico / intermediário / avançado)
4. Estilo de escrita (didático / persuasivo / técnico / storytelling / motivacional)
5. Elementos: exercícios? resumos? checklist? estudos de caso?
6. Modo Produto Premium (nome de método + posicionamento)? sim/não
7. Número de capítulos sugerido
8. Após coletar tudo, faça um RESUMO conciso e pergunte: "Posso gerar a estrutura do eBook agora?"

QUANDO o usuário CONFIRMAR a geração, responda APENAS com o token:
[[GENERATE_OUTLINE]]
{"topic":"...","target_audience":"...","depth_level":"basico|intermediario|avancado","writing_style":"didatico|persuasivo|tecnico|storytelling|motivacional","include_exercises":true|false,"include_summary":true|false,"include_checklist":true|false,"include_case_studies":true|false,"include_examples":true|false,"include_metaphors":true|false,"premium_product_mode":true|false,"num_chapters":N}

Seja caloroso, conciso e profissional. Português do Brasil.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const user = userData.user;

    // Verifica add-on premium
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: hasPremium } = await admin.rpc("user_has_addon", { _user_id: user.id, _addon_slug: "ebook-premium" });
    if (!hasPremium) {
      return new Response(JSON.stringify({ error: "premium_required", message: "Este recurso é exclusivo do add-on eBooks Premium." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { messages } = await req.json();
    if (!Array.isArray(messages)) return new Response(JSON.stringify({ error: "messages required" }), { status: 400, headers: corsHeaders });

    // Cobra 1 crédito por mensagem
    const consume = await userClient.rpc("consume_credits", { _amount: 1, _action_key: "ebook_chat_message", _description: "Chat eBook Premium" });
    if (!(consume.data as any)?.success) {
      return new Response(JSON.stringify(consume.data), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
      }),
    });
    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: corsHeaders });
      throw new Error(`AI ${aiResp.status}`);
    }
    return new Response(aiResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ebook-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
