import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GenerateBody {
  project_id: string;
  social_network: string;
  content_type: string;
  quantity: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json()) as GenerateBody;
    const quantity = Math.min(Math.max(Number(body.quantity) || 1, 1), 10);
    if (!body.project_id || !body.social_network || !body.content_type) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch project (RLS via user client)
    const { data: project, error: projErr } = await userClient
      .from("projects")
      .select("id, name, ai_profile, user_id")
      .eq("id", body.project_id)
      .maybeSingle();
    if (projErr || !project) {
      return new Response(JSON.stringify({ error: "Project not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume credits (cost = 2 per item)
    const { data: costRow } = await admin
      .from("credit_action_costs")
      .select("cost")
      .eq("action_key", "generate_content")
      .maybeSingle();
    const unitCost = costRow?.cost ?? 2;
    const totalCost = unitCost * quantity;

    const { data: consumeRes, error: consumeErr } = await userClient.rpc(
      "consume_credits",
      {
        _amount: totalCost,
        _action_key: "generate_content",
        _description: `Geração de ${quantity} conteúdo(s) (${body.content_type} / ${body.social_network})`,
      },
    );
    if (consumeErr) throw consumeErr;
    if (consumeRes && (consumeRes as any).success === false) {
      return new Response(JSON.stringify({ error: "insufficient_credits", details: consumeRes }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build prompt
    const avatar = project.ai_profile?.trim()
      ? project.ai_profile
      : "Audiência geral, sem perfil específico definido.";

    const isCarousel = body.content_type === 'carrossel';

    const systemPrompt = `Você é um estrategista sênior de conteúdo para redes sociais, especializado em maximizar engajamento. Sempre responda em português do Brasil. Seja específico, criativo e use copywriting persuasivo.${
      isCarousel
        ? ' Para CARROSSEIS, você é também um roteirista visual: cada slide é uma cena de uma MESMA história/raciocínio, com começo (gancho), meio (desenvolvimento) e fim (CTA/conclusão). Mantenha o mesmo personagem, paleta, ambiente e estilo visual em todos os slides para garantir consistência visual.'
        : ''
    }`;

    const carouselSlideCount = isCarousel ? 7 : 0; // 6-8 slides recomendado

    const userPrompt = `Crie ${quantity} ideia(s) de conteúdo otimizadas para ENGAJAMENTO MÁXIMO.

Rede social: ${body.social_network}
Formato: ${body.content_type}
Projeto: ${project.name}

Perfil do avatar / público-alvo (extraído de comentários reais):
"""
${avatar}
"""

Para cada conteúdo, forneça:
- title: título/gancho curto e magnético
- caption: legenda completa pronta para publicar (com quebras de linha, emojis quando fizer sentido)
- hashtags: array com 5 a 12 hashtags relevantes (sem o #)
- cta: chamada para ação clara
- script: roteiro cena a cena (apenas para reels/shorts/vídeo/video; caso contrário use string vazia "")
- visual_idea: descrição da ideia visual / thumbnail / capa (para carrossel: descreva o ESTILO VISUAL GERAL — paleta, personagem, ambiente, mood — que será mantido em TODOS os slides)
- engagement_score: número de 1 a 100 estimando o potencial de engajamento
${
  isCarousel
    ? `- slides: array com ${carouselSlideCount} slides (mínimo 5, máximo 10) que CONTAM UMA HISTÓRIA SEQUENCIAL. Cada slide deve ter:
    * index: número da ordem (1, 2, 3...)
    * text: texto curto e impactante que aparecerá no slide (máx 2 linhas, leitura em ~3s)
    * visual: descrição CONCRETA da imagem desta cena, conectada visualmente à anterior (mesmo personagem, paleta, ambiente, ângulo evoluindo). Ex: "slide 2: mesmo personagem do slide 1, agora olhando para um gráfico subindo, mesma paleta azul/roxo, ambiente de escritório minimalista".
  Estrutura narrativa obrigatória:
    - Slide 1: GANCHO (capa, pergunta provocativa ou problema)
    - Slides intermediários: DESENVOLVIMENTO (cada slide = um ponto da linha de raciocínio, conectado ao anterior por "então", "mas", "porém", "depois")
    - Último slide: CTA/CONCLUSÃO (resposta + chamada para ação)
  Os slides devem se LER COMO UM FILMINHO: se você juntar todos os textos em sequência, vira um mini-storytelling coerente.`
    : '- slides: array vazio []'
}

Adapte tom, formato e duração às melhores práticas de ${body.social_network} (${body.content_type}).`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_contents",
                description: "Retorna a lista de conteúdos gerados",
                parameters: {
                  type: "object",
                  properties: {
                    contents: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          caption: { type: "string" },
                          hashtags: { type: "array", items: { type: "string" } },
                          cta: { type: "string" },
                          script: { type: "string" },
                          visual_idea: { type: "string" },
                          engagement_score: { type: "number" },
                        },
                        required: ["title", "caption", "hashtags", "cta", "visual_idea", "engagement_score"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["contents"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "return_contents" } },
        }),
      },
    );

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      // Refund credits
      await admin.rpc("admin_add_credits", {
        _user_id: user.id,
        _amount: totalCost,
        _description: "Estorno: falha na geração de conteúdo",
      }).catch(() => {});
      const status = aiResp.status === 429 ? 429 : aiResp.status === 402 ? 402 : 500;
      const msg =
        aiResp.status === 429
          ? "Limite de requisições atingido. Tente novamente em instantes."
          : aiResp.status === 402
          ? "Créditos da IA esgotados. Adicione fundos na sua workspace."
          : "Erro na geração de conteúdo.";
      return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : { contents: [] };
    const contents: any[] = args.contents ?? [];

    // Persist
    const rows = contents.map((c) => ({
      project_id: project.id,
      user_id: user.id,
      social_network: body.social_network,
      content_type: body.content_type,
      title: c.title ?? null,
      caption: c.caption ?? null,
      hashtags: Array.isArray(c.hashtags) ? c.hashtags : [],
      cta: c.cta ?? null,
      script: c.script ?? null,
      visual_idea: c.visual_idea ?? null,
      engagement_score: Math.round(Number(c.engagement_score) || 0),
    }));

    let saved: any[] = [];
    if (rows.length > 0) {
      const { data: ins, error: insErr } = await admin
        .from("generated_contents")
        .insert(rows)
        .select("*");
      if (insErr) throw insErr;
      saved = ins ?? [];
    }

    return new Response(
      JSON.stringify({ success: true, contents: saved, cost: totalCost }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-content error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
