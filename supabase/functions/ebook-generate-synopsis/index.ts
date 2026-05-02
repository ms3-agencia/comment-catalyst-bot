import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_LEN = 4000;
const TARGET_LEN = 1800; // tamanho ideal para uma sinopse KDP forte

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Supabase env vars missing");
    }

    // Auth: identifica o usuário pelo JWT enviado pelo cliente
    const authHeader = req.headers.get("Authorization") || "";
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ebook_id, language, max_chars } = await req.json();
    const limit = Math.min(MAX_LEN, Math.max(400, Number(max_chars) || TARGET_LEN));

    if (!ebook_id) {
      return new Response(JSON.stringify({ error: "missing_ebook_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega ebook (RLS já garante que só o dono lê)
    const { data: ebook, error: ebErr } = await supa
      .from("ebooks")
      .select("id, title, subtitle, topic, introduction, conclusion, method_name, promise")
      .eq("id", ebook_id)
      .maybeSingle();
    if (ebErr || !ebook) {
      return new Response(JSON.stringify({ error: "ebook_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: chapters } = await supa
      .from("ebook_chapters")
      .select("chapter_number, title, content_html")
      .eq("ebook_id", ebook_id)
      .order("chapter_number");

    // Resumo do conteúdo (não enviar tudo p/ economizar tokens)
    const stripTags = (s: string) =>
      (s || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const intro = stripTags(ebook.introduction || "").slice(0, 1200);
    const conclusion = stripTags(ebook.conclusion || "").slice(0, 800);
    const chapterSummaries =
      (chapters || [])
        .map((c) => {
          const txt = stripTags(c.content_html || "").slice(0, 600);
          return `Cap. ${c.chapter_number} — ${c.title}\n${txt}`;
        })
        .join("\n\n")
        .slice(0, 9000);

    const lang = language || "pt-BR";

    const systemPrompt = `Você é um copywriter especialista em sinopses de livros para Amazon KDP. Escreva sinopses persuasivas que despertam DESEJO de comprar o livro, usando gatilhos mentais comprovados:

- Curiosidade (revele uma promessa sem entregar tudo)
- Dor & solução (mostre o problema do leitor antes da virada)
- Prova social/autoridade (sem inventar números falsos)
- Urgência sutil
- Transformação (antes vs. depois da leitura)
- Especificidade (nomeie o método/passos quando houver)

Regras inegociáveis:
1. Idioma: ${lang}.
2. Limite RÍGIDO de ${limit} caracteres (conte espaços). NUNCA ultrapasse.
3. Estrutura: gancho forte na 1ª linha → dor do leitor → promessa/transformação → o que ele vai descobrir → CTA emocional final.
4. Tom: confiante, próximo, cinematográfico. Frases curtas e médias. Pode usar 1–2 quebras de parágrafo.
5. Não invente dados, números, depoimentos ou prêmios.
6. Não use emojis nem markdown (negrito, listas, #). Texto corrido apenas.
7. Não comece com "Neste livro...". Comece com uma cena, pergunta ou afirmação impactante.
8. Termine com um CTA que ative a decisão (ex: "Vire a primeira página e descubra...").

Retorne APENAS a sinopse final, sem comentários, sem aspas envolvendo o texto.`;

    const userPrompt = `Crie a sinopse para o ebook abaixo.

TÍTULO: ${ebook.title || "(sem título)"}
${ebook.subtitle ? `SUBTÍTULO: ${ebook.subtitle}` : ""}
${ebook.topic ? `TEMA: ${ebook.topic}` : ""}
${ebook.method_name ? `MÉTODO: ${ebook.method_name}` : ""}
${ebook.promise ? `PROMESSA CENTRAL: ${ebook.promise}` : ""}

INTRODUÇÃO (resumo):
${intro || "(sem introdução)"}

CAPÍTULOS (resumo):
${chapterSummaries || "(sem capítulos)"}

CONCLUSÃO (resumo):
${conclusion || "(sem conclusão)"}

Limite máximo: ${limit} caracteres. Idioma: ${lang}.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "rate_limited", message: "Muitas requisições. Tente novamente em alguns segundos." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "payment_required", message: "Créditos de IA esgotados. Adicione saldo em Settings > Workspace > Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "ai_gateway_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    let synopsis: string =
      aiJson?.choices?.[0]?.message?.content?.toString().trim() || "";

    // Limpeza pós-IA
    synopsis = synopsis.replace(/^["'`]+|["'`]+$/g, "").trim();

    // Trunca de forma elegante se a IA estourou o limite
    if (synopsis.length > limit) {
      const cut = synopsis.slice(0, limit);
      const lastDot = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
      synopsis = lastDot > limit * 0.6 ? cut.slice(0, lastDot + 1) : cut.trim() + "…";
    }

    return new Response(
      JSON.stringify({ synopsis, length: synopsis.length, limit }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ebook-generate-synopsis error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
