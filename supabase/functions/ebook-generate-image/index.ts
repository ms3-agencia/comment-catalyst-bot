import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  prompt: string;
  aspect_ratio?: "1:1" | "16:9" | "9:16" | "4:5" | "3:4" | "4:3";
  ebook_id?: string;
}

const ALLOWED_RATIOS = ["1:1", "16:9", "9:16", "4:5", "3:4", "4:3"] as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: "missing_auth",
          message: "Sessão ausente. Faça login novamente para continuar.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "").trim();

    // Decode JWT payload (no signature check here — getUser/getClaims does that)
    // to detect expiration BEFORE calling any external API (AI gateway).
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
        );
        if (payload?.exp && typeof payload.exp === "number") {
          const nowSec = Math.floor(Date.now() / 1000);
          if (payload.exp <= nowSec) {
            return new Response(
              JSON.stringify({
                error: "session_expired",
                message:
                  "Sua sessão expirou. Atualize a página (F5) ou faça login novamente.",
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }
        }
      }
    } catch (_) {
      // malformed token → fall through to getUser which will reject it
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      const msg = (userErr?.message || "").toLowerCase();
      const expired = msg.includes("expired") || msg.includes("jwt");
      return new Response(
        JSON.stringify({
          error: expired ? "session_expired" : "unauthorized",
          message: expired
            ? "Sua sessão expirou. Atualize a página (F5) ou faça login novamente."
            : "Você precisa estar autenticado para gerar imagens.",
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const user = userData.user;

    const body = (await req.json()) as Body;
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aspect = ALLOWED_RATIOS.includes(body.aspect_ratio as any) ? body.aspect_ratio : "16:9";

    // Consume credits (action_key: ebook_image)
    const { data: cost } = await admin.from("credit_action_costs").select("cost").eq("action_key", "ebook_image").maybeSingle();
    const creditsCost = cost?.cost ?? 5;

    const { data: cons, error: consErr } = await userClient.rpc("consume_credits", {
      _amount: creditsCost,
      _action_key: "ebook_image",
      _description: "Imagem gerada no editor de eBook",
      _reference_id: body.ebook_id ?? null,
    });
    if (consErr) throw consErr;
    if (!(cons as any)?.success) {
      return new Response(JSON.stringify({ error: "insufficient_credits", message: "Créditos insuficientes" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Lovable AI Gateway - Nano Banana for image generation
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          {
            role: "user",
            content: `Generate a high-quality image for an ebook. Aspect ratio: ${aspect}. ${prompt}`,
          },
        ],
        modalities: ["image", "text"],
      }),
    });

    const refund = async (desc: string) => {
      try {
        await admin.rpc("admin_add_credits", { _user_id: user.id, _amount: creditsCost, _description: desc } as any);
      } catch (_) { /* noop */ }
    };

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      await refund("Reembolso: falha ao gerar imagem do eBook");
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "rate_limited", message: "Limite de requisições. Aguarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "ai_error", message: txt.slice(0, 300) }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const dataUrl: string | undefined = aiJson?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!dataUrl) {
      await refund("Reembolso: imagem não retornada");
      return new Response(JSON.stringify({ error: "no_image" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload to storage so the editor stores a public URL (not a giant data URI)
    const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!m) {
      return new Response(JSON.stringify({ image_url: dataUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mime = m[1];
    const ext = mime.split("/")[1].split("+")[0];
    const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
    const path = `ebooks/${user.id}/${body.ebook_id || "free"}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await admin.storage.from("content-images").upload(path, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) {
      // fallback: return data url
      return new Response(JSON.stringify({ image_url: dataUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pub } = admin.storage.from("content-images").getPublicUrl(path);

    return new Response(JSON.stringify({ image_url: pub.publicUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ebook-generate-image error", e);
    return new Response(JSON.stringify({ error: "internal", message: e?.message || "error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
