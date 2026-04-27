import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  content_id: string;
  custom_prompt?: string;
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = (await req.json()) as Body;
    if (!body.content_id) {
      return new Response(JSON.stringify({ error: "content_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get content (RLS ensures ownership)
    const { data: content, error: cErr } = await userClient
      .from("generated_contents")
      .select("id, title, caption, visual_idea, social_network, content_type, project_id")
      .eq("id", body.content_id)
      .maybeSingle();
    if (cErr || !content) {
      return new Response(JSON.stringify({ error: "Content not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aspect ratio hints per network/type
    const formatHint = (() => {
      const t = content.content_type;
      const n = content.social_network;
      if (["reels", "shorts", "story", "idea_pin"].includes(t)) return "vertical 9:16 portrait composition";
      if (t === "video" && (n === "youtube" || n === "facebook")) return "horizontal 16:9 landscape composition";
      if (t === "pin") return "vertical 2:3 portrait composition";
      if (t === "carrossel" || t === "post") return "square 1:1 composition";
      return "square 1:1 composition";
    })();

    const basePrompt = body.custom_prompt?.trim() || content.visual_idea || content.title || content.caption || "social media content";
    const finalPrompt = `Create a high-quality, eye-catching social media image for ${content.social_network} ${content.content_type}. ${formatHint}. Visual concept: ${basePrompt}. Style: modern, vibrant, professional, clean composition with strong focal point, no text overlays unless essential, optimized for high engagement on ${content.social_network}.`;

    // Consume credits
    const { data: cost } = await admin
      .from("credit_action_costs")
      .select("cost")
      .eq("action_key", "generate_content_image")
      .maybeSingle();
    const creditCost = cost?.cost ?? 3;

    const { data: consumeRes, error: consumeErr } = await userClient.rpc("consume_credits", {
      _amount: creditCost,
      _action_key: "generate_content_image",
      _description: `Imagem para conteúdo ${content.social_network}/${content.content_type}`,
      _reference_id: content.id,
    });
    if (consumeErr || !(consumeRes as any)?.success) {
      return new Response(JSON.stringify({ error: (consumeRes as any)?.error || "Credit error", details: consumeRes }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refundCredits = async () => {
      await admin.rpc("admin_add_credits", {
        _user_id: user.id,
        _amount: creditCost,
        _description: "Reembolso: falha na geração de imagem",
      }).catch(() => {});
    };

    // Call Lovable AI image gen
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: finalPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      await refundCredits();
      const errText = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do workspace de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha ao gerar imagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const imageDataUrl: string | undefined = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl || !imageDataUrl.startsWith("data:image/")) {
      await refundCredits();
      return new Response(JSON.stringify({ error: "Imagem não retornada pela IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64
    const match = imageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      await refundCredits();
      return new Response(JSON.stringify({ error: "Formato de imagem inválido" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mime = match[1];
    const ext = mime.split("/")[1].replace("+xml", "");
    const b64 = match[2];
    const binary = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

    const filePath = `${user.id}/${content.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("content-images")
      .upload(filePath, binary, { contentType: mime, upsert: true });
    if (upErr) {
      await refundCredits();
      console.error("Upload error:", upErr);
      return new Response(JSON.stringify({ error: "Falha ao salvar imagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = admin.storage.from("content-images").getPublicUrl(filePath);
    const publicUrl = pub.publicUrl;

    // Update content row
    await admin
      .from("generated_contents")
      .update({ image_url: publicUrl, image_prompt: finalPrompt })
      .eq("id", content.id);

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      image_prompt: finalPrompt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
