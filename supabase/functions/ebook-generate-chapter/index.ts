import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STYLE_LABELS: Record<string, string> = {
  didatico: "didático e claro",
  persuasivo: "persuasivo e envolvente",
  tecnico: "técnico e detalhado",
  storytelling: "storytelling com narrativas",
  motivacional: "motivacional e inspirador",
};
const DEPTH_LABELS: Record<string, string> = {
  basico: "básico", intermediario: "intermediário", avancado: "avançado",
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
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const user = userData.user;

    const { ebook_id, chapter_number, section } = await req.json();
    if (!ebook_id) return new Response(JSON.stringify({ error: "ebook_id required" }), { status: 400, headers: corsHeaders });

    const { data: ebook } = await userClient.from("ebooks").select("*").eq("id", ebook_id).maybeSingle();
    if (!ebook) return new Response(JSON.stringify({ error: "ebook_not_found" }), { status: 404, headers: corsHeaders });

    const { data: cfg } = ebook.config_id
      ? await userClient.from("ebook_configs").select("*").eq("id", ebook.config_id).maybeSingle()
      : { data: null } as any;
    const config = cfg || {
      num_chapters: 8, min_pages_per_chapter: 10, writing_style: "didatico",
      depth_level: "intermediario", target_audience: null,
      include_exercises: false, include_summary: true, include_checklist: false,
      include_case_studies: false, include_examples: true, include_metaphors: false,
      ai_model: "google/gemini-2.5-pro",
    };

    let avatar = "";
    if (ebook.project_id) {
      const { data: proj } = await userClient.from("projects").select("ai_profile").eq("id", ebook.project_id).maybeSingle();
      if (proj?.ai_profile) avatar = proj.ai_profile;
    }

    const styleDesc = config.custom_style || STYLE_LABELS[config.writing_style] || config.writing_style;
    const depthDesc = DEPTH_LABELS[config.depth_level] || config.depth_level;
    const elements: string[] = [];
    if (config.include_exercises) elements.push("3 exercícios práticos numerados ao final");
    if (config.include_summary) elements.push("um RESUMO executivo de 4-6 bullets ao final");
    if (config.include_checklist) elements.push("um CHECKLIST acionável (5-8 itens)");
    if (config.include_case_studies) elements.push("um ESTUDO DE CASO realista (300-500 palavras)");
    if (config.include_examples) elements.push("ao menos 3 exemplos práticos espalhados pelo capítulo");
    if (config.include_metaphors) elements.push("metáforas e analogias para fixar conceitos centrais");

    // SEÇÃO ESPECIAL: introduction / conclusion
    if (section === "introduction" || section === "conclusion") {
      const consume = await userClient.rpc("consume_credits", {
        _amount: 5, _action_key: "ebook_outline",
        _description: `eBook ${section}: ${ebook.title.slice(0, 60)}`,
      });
      if (!(consume.data as any)?.success) {
        return new Response(JSON.stringify(consume.data), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const sectionPrompt = section === "introduction"
        ? `Escreva a INTRODUÇÃO completa e envolvente do eBook "${ebook.title}".\n- Subtítulo: ${ebook.subtitle || "—"}\n- Promessa: ${ebook.promise || "—"}\n- 600-900 palavras.\n- Apresente o problema, a oportunidade e o que o leitor vai aprender.\n- Linguagem ${styleDesc}.\n- Use HTML semântico (<h2>, <p>, <strong>, <em>, <ul><li>).`
        : `Escreva a CONCLUSÃO completa e transformadora do eBook "${ebook.title}", encerrando os ${ebook.outline?.chapters?.length || config.num_chapters} capítulos. Use HTML semântico. 500-800 palavras. Termine com uma chamada para ação clara: "${ebook.cta || ""}".`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.ai_model || "google/gemini-2.5-pro",
          messages: [
            { role: "system", content: "Você é um autor profissional. Responda apenas com HTML do trecho solicitado." },
            { role: "user", content: sectionPrompt + (avatar ? `\n\nAVATAR:\n${avatar}` : "") },
          ],
        }),
      });
      if (!aiResp.ok) throw new Error(`AI error ${aiResp.status}`);
      const j = await aiResp.json();
      const html = j.choices?.[0]?.message?.content || "";
      const cleaned = html.replace(/```html\s*/gi, "").replace(/```\s*$/g, "").trim();

      const patch: any = {};
      if (section === "introduction") patch.introduction = cleaned;
      else patch.conclusion = cleaned;
      patch.status = "in_progress";
      await admin.from("ebooks").update(patch).eq("id", ebook.id);

      return new Response(JSON.stringify({ success: true, section, html: cleaned }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // CAPÍTULO
    if (!chapter_number) return new Response(JSON.stringify({ error: "chapter_number required" }), { status: 400, headers: corsHeaders });

    const { data: chapter } = await userClient.from("ebook_chapters").select("*").eq("ebook_id", ebook_id).eq("chapter_number", chapter_number).maybeSingle();
    if (!chapter) return new Response(JSON.stringify({ error: "chapter_not_found" }), { status: 404, headers: corsHeaders });

    // Cache por (ebook_id, chapter_number) — se já está completo retorna sem cobrar
    if (chapter.status === "completed" && chapter.content_html?.length > 100) {
      return new Response(JSON.stringify({ success: true, cached: true, chapter }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Calcula custo dinâmico baseado nos itens ativos do template + multiplicador do plano
    let chapterCost = 8;
    try {
      const { data: dyn } = await admin.rpc("compute_ebook_chapter_cost", {
        _user_id: user.id,
        _config_id: ebook.config_id || null,
      });
      if (typeof dyn === "number" && dyn > 0) chapterCost = dyn;
    } catch (_e) { /* fallback ao custo base */ }

    const consume = await userClient.rpc("consume_credits", {
      _amount: chapterCost, _action_key: "ebook_chapter",
      _description: `Capítulo ${chapter_number} - ${chapter.title.slice(0, 60)} (${chapterCost} cr.)`,
      _reference_id: ebook.id,
    });
    if (!(consume.data as any)?.success) {
      return new Response(JSON.stringify(consume.data), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("ebook_chapters").update({ status: "generating" }).eq("id", chapter.id);

    const minWords = (config.min_pages_per_chapter || 10) * 300;
    const otherChapters = (ebook.outline?.chapters || []).map((c: any) => `${c.number}. ${c.title}`).join("\n");
    const subtopics = (ebook.outline?.chapters?.find((c: any) => c.number === chapter_number)?.subtopics || []).join("; ");

    const chapterPrompt = `Você está escrevendo o CAPÍTULO ${chapter_number} do eBook "${ebook.title}".

CONTEXTO DO LIVRO:
- Subtítulo: ${ebook.subtitle || ""}
- Promessa: ${ebook.promise || ""}
- Público: ${config.target_audience || "(usar avatar abaixo)"}
- Estilo: ${styleDesc}
- Profundidade: ${depthDesc}

ESTRUTURA COMPLETA (para você manter coerência e NÃO repetir):
${otherChapters}

CAPÍTULO A ESCREVER:
- Título: ${chapter.title}
- Resumo: ${chapter.summary}
- Subtópicos previstos: ${subtopics || "(criar)"}

REQUISITOS OBRIGATÓRIOS:
1. Mínimo de ${minWords} palavras (equivalente a ${config.min_pages_per_chapter} páginas).
2. Estrutura: introdução do capítulo → desenvolvimento profundo organizado em subtópicos com <h3> → exemplos/aplicações → fechamento.
3. Inclua: ${elements.join("; ") || "(nenhum elemento especial)"}.
4. NÃO inclua o título <h2> do capítulo (será adicionado pelo sistema). Comece direto pelo conteúdo.
5. Saída em HTML semântico válido: <h3>, <p>, <strong>, <em>, <ul><li>, <ol><li>, <blockquote>. Sem markdown.
6. NÃO escreva "Capítulo X" no texto.
${avatar ? `\nAVATAR DO LEITOR (calibre dores, linguagem, exemplos):\n${avatar}` : ""}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ai_model || "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Você é um autor profissional de eBooks. Escreva conteúdo profundo, original e acionável. Saída em HTML semântico, sem markdown e sem cercas de código." },
          { role: "user", content: chapterPrompt },
        ],
      }),
    });
    if (!aiResp.ok) {
      await admin.from("ebook_chapters").update({ status: "error" }).eq("id", chapter.id);
      const t = await aiResp.text();
      console.error("AI error:", aiResp.status, t);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "rate_limited" }), { status: 429, headers: corsHeaders });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "credits_exhausted" }), { status: 402, headers: corsHeaders });
      throw new Error("AI error");
    }
    const j = await aiResp.json();
    const raw = j.choices?.[0]?.message?.content || "";
    const html = raw.replace(/```html\s*/gi, "").replace(/```\s*$/g, "").trim();
    const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;

    await admin.from("ebook_chapters").update({
      content_html: html,
      word_count: wordCount,
      status: "completed",
    }).eq("id", chapter.id);
    await admin.from("ebooks").update({ status: "in_progress" }).eq("id", ebook.id);

    return new Response(JSON.stringify({ success: true, chapter: { ...chapter, content_html: html, word_count: wordCount, status: "completed" } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ebook-generate-chapter error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
