import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  content_id: string;
  custom_prompt?: string;
  image_format?: string; // e.g. "9:16", "1:1", "4:5", "16:9", "2:3", "1.91:1"
  width?: number;
  height?: number;
  skip_persist?: boolean; // se true, não sobrescreve image_url do conteúdo (uso em editor de vídeo)
  slide_index?: number;   // se presente, gera imagem para um slide específico do carrossel
}

const FORMAT_HINTS: Record<string, string> = {
  "9:16": "STRICT vertical 9:16 portrait aspect ratio (taller than wide), target 1080x1920 px",
  "1:1": "STRICT square 1:1 aspect ratio (equal width and height), target 1080x1080 px",
  "4:5": "STRICT vertical 4:5 portrait aspect ratio (taller than wide), target 1080x1350 px",
  "16:9": "STRICT horizontal 16:9 landscape aspect ratio (wider than tall), target 1920x1080 px",
  "2:3": "STRICT vertical 2:3 portrait aspect ratio (taller than wide), target 1000x1500 px",
  "1.91:1": "STRICT horizontal 1.91:1 landscape aspect ratio (wider than tall), target 1200x630 px",
};

// Map our ratio strings to Gemini's supported aspect_ratio enum values
const GEMINI_ASPECT: Record<string, string> = {
  "1:1": "1:1",
  "9:16": "9:16",
  "16:9": "16:9",
  "4:5": "4:5",
  "2:3": "3:4",      // closest supported
  "1.91:1": "16:9",  // closest supported
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
      .select("id, title, caption, visual_idea, social_network, content_type, project_id, slides")
      .eq("id", body.content_id)
      .maybeSingle();
    if (cErr || !content) {
      return new Response(JSON.stringify({ error: "Content not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Aspect ratio hints per network/type (fallback if not provided)
    const formatHint = (() => {
      if (body.image_format && FORMAT_HINTS[body.image_format]) {
        return FORMAT_HINTS[body.image_format];
      }
      const t = content.content_type;
      const n = content.social_network;
      if (["reels", "shorts", "story", "idea_pin"].includes(t)) return FORMAT_HINTS["9:16"];
      if (t === "video" && (n === "youtube" || n === "facebook")) return FORMAT_HINTS["16:9"];
      if (t === "pin") return FORMAT_HINTS["2:3"];
      if (t === "carrossel" && n === "instagram") return FORMAT_HINTS["4:5"];
      if (t === "post" && (n === "facebook" || n === "linkedin")) return FORMAT_HINTS["1.91:1"];
      return FORMAT_HINTS["1:1"];
    })();

    const selectedRatio = body.image_format && FORMAT_HINTS[body.image_format] ? body.image_format : null;
    const targetW = body.width;
    const targetH = body.height;
    const dimsText = targetW && targetH ? ` Exact target dimensions: ${targetW}x${targetH} pixels.` : "";

    // ---- CARROSSEL: per-slide narrative image ----
    const slides: any[] = Array.isArray((content as any).slides) ? (content as any).slides : [];
    const isSlideRequest =
      typeof body.slide_index === 'number' &&
      body.slide_index >= 0 &&
      body.slide_index < slides.length;
    const currentSlide = isSlideRequest ? slides[body.slide_index!] : null;

    let basePrompt: string;
    if (isSlideRequest && currentSlide) {
      const total = slides.length;
      const idx = body.slide_index! + 1;
      const styleAnchor = (content.visual_idea || '').trim() || 'modern, vibrant, professional';
      const prevSlide = body.slide_index! > 0 ? slides[body.slide_index! - 1] : null;
      const nextSlide = body.slide_index! < slides.length - 1 ? slides[body.slide_index! + 1] : null;
      const allTexts = slides
        .map((s: any, i: number) => `${i + 1}. ${String(s?.text || '').trim()}`)
        .join(' | ');
      basePrompt = [
        `This is slide ${idx} of ${total} in a SEQUENTIAL VISUAL STORY (carousel).`,
        `Overall narrative: ${allTexts}.`,
        `MASTER VISUAL STYLE (must be IDENTICAL across all slides — same character(s), same color palette, same lighting, same art style, same environment family): ${styleAnchor}.`,
        prevSlide ? `Previous slide showed: ${String(prevSlide?.visual || prevSlide?.text || '').trim()}.` : '',
        `THIS slide must depict: ${String(currentSlide?.visual || currentSlide?.text || '').trim()}.`,
        nextSlide ? `Next slide will show: ${String(nextSlide?.visual || nextSlide?.text || '').trim()} — leave room for visual continuity.` : '',
        `Slide text overlay (for context only, DO NOT render text in image unless essential): "${String(currentSlide?.text || '').trim()}".`,
        idx === 1 ? 'This is the COVER/HOOK — make it bold and scroll-stopping.' : '',
        idx === total ? 'This is the FINAL slide (CTA/conclusion) — visually rewarding closure.' : '',
        body.custom_prompt ? `Extra user direction: ${body.custom_prompt.trim()}.` : '',
      ].filter(Boolean).join(' ');
    } else {
      basePrompt = body.custom_prompt?.trim() || content.visual_idea || content.title || content.caption || "social media content";
    }

    const finalPrompt = `Create a high-quality, eye-catching social media image for ${content.social_network} ${content.content_type}. ${formatHint}.${dimsText} Frame and compose the entire image to fully fill this aspect ratio — DO NOT add letterbox bars, padding, borders, or whitespace; the subject must occupy the full frame. Visual concept: ${basePrompt}. Style: modern, vibrant, professional, clean composition with a strong focal point centered for the chosen aspect ratio, no text overlays unless essential, optimized for high engagement on ${content.social_network}.`;

    const aspectForGemini = selectedRatio ? GEMINI_ASPECT[selectedRatio] : undefined;

    // Compute credit cost based on output megapixels (matches frontend imageCreditCost)
    const computeCost = (w?: number, h?: number, baseCost = 3): number => {
      if (!w || !h) return baseCost;
      const mp = (w * h) / 1_000_000;
      if (mp <= 1.2) return Math.max(baseCost, 3);
      if (mp <= 1.6) return Math.max(baseCost, 4);
      return Math.max(baseCost, 5);
    };

    // Consume credits
    const { data: cost } = await admin
      .from("credit_action_costs")
      .select("cost")
      .eq("action_key", "generate_content_image")
      .maybeSingle();
    const baseCost = cost?.cost ?? 3;
    const creditCost = computeCost(body.width, body.height, baseCost);

    const { data: consumeRes, error: consumeErr } = await userClient.rpc("consume_credits", {
      _amount: creditCost,
      _action_key: "generate_content_image",
      _description: `Imagem para conteúdo ${content.social_network}/${content.content_type}`,
      _reference_id: content.id,
    });
    if (consumeErr || !(consumeRes as any)?.success) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes para gerar imagem.", insufficient_credits: true, details: consumeRes }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        ...(aspectForGemini ? { image_config: { aspect_ratio: aspectForGemini } } : {}),
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

    // Persist
    if (!body.skip_persist) {
      if (isSlideRequest) {
        // Update the specific slide entry inside slides[]
        const updatedSlides = slides.map((s: any, i: number) =>
          i === body.slide_index
            ? { ...s, image_url: publicUrl, image_prompt: finalPrompt }
            : s
        );
        const patch: Record<string, any> = { slides: updatedSlides };
        // First slide also becomes the cover image_url
        if (body.slide_index === 0) {
          patch.image_url = publicUrl;
          patch.image_prompt = finalPrompt;
        }
        await admin.from("generated_contents").update(patch).eq("id", content.id);
      } else {
        await admin
          .from("generated_contents")
          .update({ image_url: publicUrl, image_prompt: finalPrompt })
          .eq("id", content.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      image_prompt: finalPrompt,
      slide_index: isSlideRequest ? body.slide_index : null,
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
