import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE_LABELS: Record<string, string> = {
  didatico: "didático e claro, como um professor experiente",
  persuasivo: "persuasivo e envolvente, focado em conversão",
  tecnico: "técnico e detalhado, para um leitor experiente",
  storytelling: "storytelling, com narrativas e histórias",
  motivacional: "motivacional, inspirador e engajador",
};

const DEPTH_LABELS: Record<string, string> = {
  basico: "básico (iniciantes — explicações simples e exemplos diretos)",
  intermediario: "intermediário (leitor com noções, aprofundando aplicação)",
  avancado: "avançado (especialista — nuances, edge cases, frameworks robustos)",
};

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const user = userData.user;

    const body = await req.json();
    const { topic, config_id, project_id, premium_product_mode } = body || {};
    if (!topic || typeof topic !== "string" || topic.length < 3) {
      return new Response(JSON.stringify({ error: "topic_required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verifica add-on
    const { data: hasBasic } = await admin.rpc("user_has_addon", { _user_id: user.id, _addon_slug: "ebook-generator" });
    const { data: hasPremium } = await admin.rpc("user_has_addon", { _user_id: user.id, _addon_slug: "ebook-premium" });
    if (!hasBasic && !hasPremium) {
      return new Response(JSON.stringify({ error: "addon_required", message: "Compre o add-on Gerador de eBooks para usar este recurso." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega config
    let config: any = null;
    if (config_id) {
      const { data } = await userClient.from("ebook_configs").select("*").eq("id", config_id).maybeSingle();
      config = data;
    }
    if (!config) {
      // defaults
      config = {
        num_chapters: 8, min_pages_per_chapter: 10,
        writing_style: "didatico", custom_style: null,
        target_audience: null, depth_level: "intermediario",
        include_exercises: false, include_summary: true, include_checklist: false,
        include_case_studies: false, include_examples: true, include_metaphors: false,
        base_prompt: null, premium_product_mode: !!premium_product_mode,
        ai_model: "google/gemini-2.5-pro",
        structure: { intro: true, development: true, conclusion: true, cta: true },
      };
    }
    if (premium_product_mode != null) config.premium_product_mode = !!premium_product_mode;

    // Aplica overrides do usuário (preferências salvas em profiles.ebook_overrides)
    if (overrides && typeof overrides === "object") {
      if (typeof overrides.writing_style === "string" && overrides.writing_style.trim()) {
        config.writing_style = overrides.writing_style.trim();
      }
      if (typeof overrides.custom_style === "string" && overrides.custom_style.trim()) {
        config.custom_style = overrides.custom_style.trim();
      }
      if (typeof overrides.depth_level === "string" && overrides.depth_level.trim()) {
        config.depth_level = overrides.depth_level.trim();
      }
      if (typeof overrides.target_audience === "string" && overrides.target_audience.trim()) {
        config.target_audience = overrides.target_audience.trim();
      }
      if (typeof overrides.extra_notes === "string" && overrides.extra_notes.trim()) {
        config.extra_notes = overrides.extra_notes.trim();
      }
    }

    // Avatar do projeto
    let avatar = "";
    if (project_id) {
      const { data: proj } = await userClient.from("projects").select("ai_profile, name").eq("id", project_id).maybeSingle();
      if (proj?.ai_profile) avatar = proj.ai_profile;
    }

    // Consome créditos
    const { data: consumeRes, error: consumeErr } = await userClient.rpc("consume_credits", {
      _amount: 5, _action_key: "ebook_outline",
      _description: `Outline de eBook: ${topic.slice(0, 80)}`,
    });
    if (consumeErr) throw consumeErr;
    if (!(consumeRes as any)?.success) {
      return new Response(JSON.stringify(consumeRes), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const styleDesc = config.custom_style || STYLE_LABELS[config.writing_style] || config.writing_style;
    const depthDesc = DEPTH_LABELS[config.depth_level] || config.depth_level;
    const elements: string[] = [];
    if (config.include_exercises) elements.push("exercícios práticos ao final de cada capítulo");
    if (config.include_summary) elements.push("resumo executivo no fim de cada capítulo");
    if (config.include_checklist) elements.push("checklist acionável");
    if (config.include_case_studies) elements.push("estudos de caso reais");
    if (config.include_examples) elements.push("exemplos práticos e aplicações");
    if (config.include_metaphors) elements.push("metáforas e analogias para fixar conceitos");

    const productPart = config.premium_product_mode
      ? `\n\nMODO PRODUTO PREMIUM ATIVO: o eBook deve ser estruturado como um INFOPRODUTO VENDÁVEL. Crie:\n- Um nome de método EXCLUSIVO e memorável (ex.: "Método X.Y.Z", sigla forte)\n- Uma PROMESSA forte e específica (transformação clara em tempo definido)\n- Posicionamento de mercado único (diferencial vs concorrentes)\n- Título e subtítulo extremamente comerciais.`
      : "";

    const userPrompt = (config.base_prompt && config.base_prompt.trim().length > 20)
      ? config.base_prompt
        .replaceAll("{{tema}}", topic)
        .replaceAll("{{publico}}", config.target_audience || "público geral")
        .replaceAll("{{nivel}}", depthDesc)
        .replaceAll("{{estilo}}", styleDesc)
        .replaceAll("{{capitulos}}", String(config.num_chapters))
      : `Você é um autor especialista em criar eBooks profundos e altamente vendáveis.

TEMA: ${topic}
PÚBLICO-ALVO: ${config.target_audience || "definir com base no avatar"}
ESTILO: ${styleDesc}
PROFUNDIDADE: ${depthDesc}
ESTRUTURA: ${config.num_chapters} capítulos, cada um com no mínimo ${config.min_pages_per_chapter} páginas (~${config.min_pages_per_chapter * 300} palavras).
ELEMENTOS A INCLUIR EM CADA CAPÍTULO: ${elements.join(", ") || "nenhum especial"}.${avatar ? `\n\nAVATAR DO PÚBLICO (use para calibrar dores, linguagem e exemplos):\n${avatar}` : ""}${config.extra_notes ? `\n\nOBSERVAÇÕES DO USUÁRIO (siga rigorosamente):\n${config.extra_notes}` : ""}${productPart}

Crie a ESTRUTURA COMPLETA do eBook. Retorne via tool call.`;

    const aiBody: any = {
      model: config.ai_model || "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: "Você é um autor profissional de eBooks comerciais. Sempre responda com chamadas de ferramenta estruturadas." },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "ebook_outline",
          description: "Estrutura completa do eBook",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              subtitle: { type: "string" },
              method_name: { type: "string", description: "Nome do método (vazio se não for produto premium)" },
              promise: { type: "string", description: "Promessa forte (vazio se não for produto premium)" },
              introduction_summary: { type: "string", description: "Resumo da introdução (1 parágrafo)" },
              conclusion_summary: { type: "string", description: "Resumo da conclusão" },
              cta: { type: "string", description: "Chamada para ação final" },
              chapters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    number: { type: "integer" },
                    title: { type: "string" },
                    summary: { type: "string", description: "O que esse capítulo aborda (3-5 linhas)" },
                    subtopics: { type: "array", items: { type: "string" } },
                  },
                  required: ["number", "title", "summary", "subtopics"],
                },
              },
            },
            required: ["title", "subtitle", "introduction_summary", "conclusion_summary", "cta", "chapters"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "ebook_outline" } },
    };

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(aiBody),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }
    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI did not return tool call");
    const parsed = JSON.parse(toolCall.function.arguments);

    // Cria eBook + capítulos pendentes
    const { data: ebook, error: ebErr } = await admin.from("ebooks").insert({
      user_id: user.id,
      project_id: project_id || null,
      config_id: config.id || null,
      title: parsed.title,
      subtitle: parsed.subtitle,
      topic,
      outline: parsed,
      method_name: parsed.method_name || null,
      promise: parsed.promise || null,
      cta: parsed.cta || null,
      status: "outline_ready",
      source: project_id ? "avatar" : "manual",
      metadata: { ai_model: aiBody.model, premium_product_mode: !!config.premium_product_mode },
    }).select().single();
    if (ebErr) throw ebErr;

    const chapters = (parsed.chapters || []).map((c: any) => ({
      ebook_id: ebook.id,
      user_id: user.id,
      chapter_number: c.number,
      title: c.title,
      summary: c.summary,
      content_html: "",
      status: "pending",
    }));
    if (chapters.length) {
      await admin.from("ebook_chapters").insert(chapters);
    }

    return new Response(JSON.stringify({ success: true, ebook_id: ebook.id, outline: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ebook-generate-outline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
