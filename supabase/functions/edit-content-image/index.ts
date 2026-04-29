import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  content_id: string;
  edit_prompt: string;
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
    if (!body.content_id || !body.edit_prompt?.trim()) {
      return new Response(JSON.stringify({ error: "content_id and edit_prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: content, error: cErr } = await userClient
      .from("generated_contents")
      .select("id, title, image_url, image_prompt, social_network, content_type")
      .eq("id", body.content_id)
      .maybeSingle();
    if (cErr || !content) {
      return new Response(JSON.stringify({ error: "Content not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!content.image_url) {
      return new Response(JSON.stringify({ error: "Conteúdo não tem imagem para editar" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch current image and convert to base64
    const imgResp = await fetch(content.image_url);
    if (!imgResp.ok) throw new Error("Falha ao baixar imagem atual");
    const imgBuffer = new Uint8Array(await imgResp.arrayBuffer());
    const imgMime = imgResp.headers.get("content-type") || "image/png";
    let binStr = "";
    for (let i = 0; i < imgBuffer.length; i++) binStr += String.fromCharCode(imgBuffer[i]);
    const imgBase64 = btoa(binStr);
    const imgDataUrl = `data:${imgMime};base64,${imgBase64}`;

    // Consume credits (same cost as generation)
    const { data: cost } = await admin
      .from("credit_action_costs")
      .select("cost")
      .eq("action_key", "generate_content_image")
      .maybeSingle();
    const creditCost = cost?.cost ?? 3;

    const { data: consumeRes, error: consumeErr } = await userClient.rpc("consume_credits", {
      _amount: creditCost,
      _action_key: "edit_content_image",
      _description: `Edição de imagem: ${body.edit_prompt.slice(0, 60)}`,
      _reference_id: content.id,
    });
    if (consumeErr || !(consumeRes as any)?.success) {
      return new Response(JSON.stringify({ error: "Créditos insuficientes para editar imagem.", insufficient_credits: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const refundCredits = async () => {
      await admin.rpc("admin_add_credits", {
        _user_id: user.id,
        _amount: creditCost,
        _description: "Reembolso: falha na edição de imagem",
      }).catch(() => {});
    };

    const editPrompt = `Edit this image based on the following instruction: "${body.edit_prompt}". Keep the original composition, style and aspect ratio unless explicitly asked to change them. Output a high-quality image.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: editPrompt },
            { type: "image_url", image_url: { url: imgDataUrl } },
          ],
        }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      await refundCredits();
      const errText = await aiResp.text();
      console.error("AI edit error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições atingido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos do workspace de IA esgotados.", insufficient_credits: true }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha ao editar imagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const newImageDataUrl: string | undefined = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!newImageDataUrl || !newImageDataUrl.startsWith("data:image/")) {
      await refundCredits();
      return new Response(JSON.stringify({ error: "Imagem não retornada pela IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = newImageDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      await refundCredits();
      return new Response(JSON.stringify({ error: "Formato de imagem inválido" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const newMime = match[1];
    const ext = newMime.split("/")[1].replace("+xml", "");
    const newBinary = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));

    const filePath = `${user.id}/${content.id}-edit-${Date.now()}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("content-images")
      .upload(filePath, newBinary, { contentType: newMime, upsert: true });
    if (upErr) {
      await refundCredits();
      return new Response(JSON.stringify({ error: "Falha ao salvar imagem" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: pub } = admin.storage.from("content-images").getPublicUrl(filePath);
    const publicUrl = pub.publicUrl;

    const updatedPrompt = `${content.image_prompt || ""}\n\n[Edição] ${body.edit_prompt}`.trim();
    await admin
      .from("generated_contents")
      .update({ image_url: publicUrl, image_prompt: updatedPrompt })
      .eq("id", content.id);

    return new Response(JSON.stringify({
      success: true,
      image_url: publicUrl,
      image_prompt: updatedPrompt,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("edit-content-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
