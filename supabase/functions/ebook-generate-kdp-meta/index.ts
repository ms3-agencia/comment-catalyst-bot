import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase env vars missing");

    const authHeader = req.headers.get("Authorization") || "";
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supa.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ebook_id, language, kind } = await req.json();
    if (!ebook_id || !["keywords", "categories"].includes(kind)) {
      return new Response(JSON.stringify({ error: "invalid_request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: ebook, error: ebErr } = await supa
      .from("ebooks")
      .select("id, title, subtitle, topic, introduction, conclusion, method_name, promise")
      .eq("id", ebook_id)
      .maybeSingle();
    if (ebErr || !ebook) {
      return new Response(JSON.stringify({ error: "ebook_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: chapters } = await supa
      .from("ebook_chapters")
      .select("chapter_number, title, content_html")
      .eq("ebook_id", ebook_id)
      .order("chapter_number");

    const stripTags = (s: string) =>
      (s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    const intro = stripTags(ebook.introduction || "").slice(0, 800);
    const conclusion = stripTags(ebook.conclusion || "").slice(0, 500);
    const chapterSummaries = (chapters || [])
      .map((c) => `Cap. ${c.chapter_number} — ${c.title}\n${stripTags(c.content_html || "").slice(0, 400)}`)
      .join("\n\n").slice(0, 7000);

    const lang = language || "pt-BR";

    const isKeywords = kind === "keywords";

    const systemPrompt = isKeywords
      ? `Você é especialista em SEO para Amazon KDP e em pesquisa de palavras-chave para best-sellers.

Sua missão: gerar EXATAMENTE 7 palavras-chave estratégicas para os 7 slots de keywords do KDP, maximizando descoberta orgânica e potencial de venda.

Regras de ouro do KDP (siga TODAS):
1. Idioma: ${lang}.
2. Cada "palavra-chave" pode ser uma frase de até 50 caracteres (long-tail vence short-tail no KDP).
3. Use frases que leitores REAIS digitam na busca da Amazon (intenção de compra alta).
4. Misture: 2-3 long-tails específicas (nicho), 2-3 termos médios (sub-nicho), 1-2 termos amplos (categoria).
5. NÃO repita palavras já presentes no título/subtítulo (KDP indexa o título separadamente — desperdício).
6. NÃO use: nomes de autores famosos, marcas registradas, "best-seller", "grátis", "novo", "promoção", "Amazon", "Kindle", aspas, emojis, pontuação.
7. NÃO use plurais redundantes nem variações triviais da mesma raiz.
8. Pense em DOR + DESEJO do leitor: o que ele digita quando precisa do que seu livro entrega?
9. Considere termos sazonais e de tendência quando relevantes ao tema.
10. Tudo em minúsculas, sem acentos opcionais inconsistentes — use a forma natural da busca.

Retorne via tool call: array de 7 strings, ordenadas da mais forte (maior volume + maior conversão estimada) para a mais nichada.`
      : `Você é especialista em posicionamento de livros no Amazon KDP, expert em escolher categorias/tópicos que fazem livros virarem best-sellers.

Sua missão: sugerir 5 a 8 categorias/tópicos KDP que MAXIMIZEM as chances do livro alcançar o selo "#1 Best Seller" em alguma sub-categoria.

Estratégia vencedora KDP:
1. Idioma/mercado: ${lang}.
2. Misture categorias amplas (descoberta) com SUB-CATEGORIAS PROFUNDAS (3º/4º nível) — é nas profundas que livros novos viram #1.
3. Use a hierarquia oficial da Amazon, separando níveis com " > " (ex: "Negócios e Investimentos > Empreendedorismo > Pequenas Empresas").
4. Priorize sub-categorias com concorrência média (não as supersaturadas tipo "Autoajuda > Geral").
5. As categorias DEVEM bater com o conteúdo real — KDP remove livros mal categorizados.
6. NÃO invente categorias inexistentes na Amazon.
7. NÃO use: "best-seller", "novidade", marcas, aspas, emojis.
8. Pense onde o leitor-alvo realmente navega quando está pronto para comprar.

Retorne via tool call: array de 5 a 8 categorias, ordenadas da que tem maior chance de ranking #1 para a mais ampla.`;

    const userPrompt = `Conteúdo do ebook para análise:

TÍTULO: ${ebook.title || "(sem título)"}
${ebook.subtitle ? `SUBTÍTULO: ${ebook.subtitle}` : ""}
${ebook.topic ? `TEMA: ${ebook.topic}` : ""}
${ebook.method_name ? `MÉTODO: ${ebook.method_name}` : ""}
${ebook.promise ? `PROMESSA: ${ebook.promise}` : ""}

INTRODUÇÃO:
${intro || "(vazia)"}

CAPÍTULOS:
${chapterSummaries || "(vazios)"}

CONCLUSÃO:
${conclusion || "(vazia)"}

Idioma/mercado: ${lang}.`;

    const tool = isKeywords
      ? {
          type: "function",
          function: {
            name: "submit_kdp_keywords",
            description: "Retorna as 7 palavras-chave estratégicas KDP.",
            parameters: {
              type: "object",
              properties: {
                keywords: {
                  type: "array",
                  minItems: 7,
                  maxItems: 7,
                  items: { type: "string", maxLength: 50 },
                },
              },
              required: ["keywords"],
              additionalProperties: false,
            },
          },
        }
      : {
          type: "function",
          function: {
            name: "submit_kdp_categories",
            description: "Retorna as categorias KDP estratégicas.",
            parameters: {
              type: "object",
              properties: {
                categories: {
                  type: "array",
                  minItems: 5,
                  maxItems: 8,
                  items: { type: "string", maxLength: 200 },
                },
              },
              required: ["categories"],
              additionalProperties: false,
            },
          },
        };

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
        tools: [tool],
        tool_choice: { type: "function", function: { name: tool.function.name } },
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
        JSON.stringify({ error: "payment_required", message: "Créditos de IA esgotados." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "ai_gateway_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: any = {};
    try {
      parsed = JSON.parse(toolCall?.function?.arguments || "{}");
    } catch {
      parsed = {};
    }

    const cleanItem = (s: string) =>
      String(s || "")
        .replace(/^["'`\s]+|["'`\s,]+$/g, "")
        .replace(/\s+/g, " ")
        .trim();

    if (isKeywords) {
      const arr: string[] = Array.isArray(parsed.keywords) ? parsed.keywords : [];
      const keywords = arr
        .map(cleanItem)
        .filter((k) => k.length > 0 && k.length <= 50)
        .slice(0, 7);
      return new Response(
        JSON.stringify({ keywords }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } else {
      const arr: string[] = Array.isArray(parsed.categories) ? parsed.categories : [];
      const categories = arr
        .map(cleanItem)
        .filter((c) => c.length > 0)
        .slice(0, 8);
      return new Response(
        JSON.stringify({ categories }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (e) {
    console.error("ebook-generate-kdp-meta error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
