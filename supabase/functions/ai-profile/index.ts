const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { comments } = await req.json();
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return new Response(
        JSON.stringify({ error: "comments array is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Summarize comments for prompt (limit to 100)
    const sample = comments.slice(0, 100);
    const commentsSummary = sample
      .map(
        (c: { author: string; content: string; likes: number }) =>
          `- ${c.author}: "${c.content}" (${c.likes} likes)`
      )
      .join("\n");

    const systemPrompt = `Você é um especialista em análise de audiência do YouTube e estrategista de produtos digitais. 
Analise os comentários fornecidos e gere um perfil detalhado do avatar da audiência **otimizado para criação e venda de produtos/serviços**, em formato Markdown.

O perfil deve seguir EXATAMENTE esta estrutura:

## 🎯 Perfil do Avatar da Audiência

### Dados Demográficos Estimados
- Faixa etária, gênero predominante, localização provável, nível socioeconômico estimado

### Comportamento e Engajamento
- Padrões de interação, frequência de engajamento, sentimento geral (% positivo, negativo, neutro), poder de compra percebido

### Interesses e Temas Identificados
- Principais tópicos, interesses em comum, nichos correlatos com potencial de monetização

### Dores e Necessidades
- Problemas relatados, frustrações, desejos não atendidos, gatilhos emocionais de compra

### Linguagem e Tom
- Estilo de comunicação, nível de formalidade, gírias e termos usados (útil para copywriting de vendas)

### 💼 Insights para Criação de Produtos e Serviços
Forneça insights detalhados e acionáveis para cada categoria abaixo, indicando o ângulo, formato ideal, faixa de preço sugerida (em R$) e principal dor que resolve:
- **Cursos online** (estrutura, módulos sugeridos, duração)
- **E-books / Guias digitais** (temas com maior apelo)
- **Workshops / Lives pagas** (formato e tópicos)
- **Mentorias e Consultorias** (modelo individual ou em grupo, duração, ticket)
- **Produtos físicos ou digitais** (merchandising, templates, planilhas, comunidades)

### 🚀 Top Produtos com Maior Potencial de Venda Diária
Liste de 5 a 10 sugestões de produtos/serviços ranqueadas da MAIOR para a MENOR probabilidade de vendas diárias recorrentes. Para cada item, inclua:
1. **Nome do produto** — formato (curso, e-book, mentoria, etc.)
2. **Ticket sugerido (R$)** e modelo de venda (única, assinatura, parcelado)
3. **Dor principal que resolve**
4. **Estimativa de potencial de vendas diárias** (Alto / Médio-Alto / Médio)
5. **Justificativa baseada nos comentários analisados**

Ordene rigorosamente por probabilidade de vendas diárias, do maior ao menor potencial.

### Recomendações Estratégicas Finais
- Ações concretas de conteúdo, funil de vendas e posicionamento para maximizar conversão

Seja detalhado, específico e baseado nos dados reais dos comentários. Use números, percentuais e exemplos sempre que possível.`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analise estes ${comments.length} comentários do YouTube e gere o perfil do avatar:\n\n${commentsSummary}`,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit excedido. Tente novamente em alguns instantes.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "Créditos de IA insuficientes. Adicione créditos no workspace.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      const errText = await response.text();
      console.error("AI gateway error:", status, errText);
      return new Response(
        JSON.stringify({ error: "Erro na geração do perfil IA" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    const profile =
      data.choices?.[0]?.message?.content || "Não foi possível gerar o perfil.";

    return new Response(JSON.stringify({ profile }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-profile error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
