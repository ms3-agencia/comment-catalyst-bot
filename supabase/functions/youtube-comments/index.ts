import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { videoUrls, idempotencyKey } = await req.json();
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "videoUrls is required (array)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ---- Idempotency: replay cached response if same key was processed already
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (idempotencyKey) {
      const { data: existing } = await admin
        .from("idempotency_keys")
        .select("response")
        .eq("user_id", user.id)
        .eq("action_key", "extract_video")
        .eq("client_key", String(idempotencyKey))
        .maybeSingle();
      if (existing?.response) {
        return new Response(
          JSON.stringify({ ...existing.response, replayed: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ---- Pre-check credit cost: 1 per video (action: extract_video)
    const adminClient = admin;

    const { data: costRow } = await adminClient
      .from("credit_action_costs")
      .select("cost")
      .eq("action_key", "extract_video")
      .maybeSingle();
    const costPerVideo = costRow?.cost ?? 1;
    const totalCost = costPerVideo * videoUrls.length;

    const { data: creditsRow } = await adminClient
      .from("user_credits")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle();
    const balance = creditsRow?.balance ?? 0;

    if (balance < totalCost) {
      return new Response(
        JSON.stringify({
          error: `Créditos insuficientes. Necessário: ${totalCost}, disponível: ${balance}.`,
          insufficient_credits: true,
          required: totalCost,
          balance,
        }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: setting } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", "youtube_api_key")
      .single();

    if (!setting?.value) {
      return new Response(
        JSON.stringify({
          error:
            "Chave da API do YouTube não configurada. Peça ao administrador para configurar.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const apiKey = setting.value;
    const allComments: Array<{
      video_url: string;
      author: string;
      author_avatar: string;
      content: string;
      likes: number;
      published_at: string;
    }> = [];

    for (const url of videoUrls) {
      const videoId = extractVideoId(url);
      if (!videoId) continue;

      let nextPageToken: string | undefined;
      do {
        const params = new URLSearchParams({
          part: "snippet",
          videoId,
          maxResults: "100",
          order: "relevance",
          key: apiKey,
        });
        if (nextPageToken) params.set("pageToken", nextPageToken);

        const resp = await fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?${params}`
        );
        if (!resp.ok) {
          const errBody = await resp.text();
          console.error("YouTube API error:", resp.status, errBody);
          break;
        }

        const data = await resp.json();
        for (const item of data.items || []) {
          const snippet = item.snippet.topLevelComment.snippet;
          allComments.push({
            video_url: url,
            author: snippet.authorDisplayName,
            author_avatar: snippet.authorProfileImageUrl || "",
            content: snippet.textDisplay,
            likes: snippet.likeCount || 0,
            published_at: snippet.publishedAt,
          });
        }

        nextPageToken = data.nextPageToken;
        if (allComments.filter((c) => c.video_url === url).length >= 500) break;
      } while (nextPageToken);
    }

    // ---- Charge credits after successful extraction
    let creditsCharged = 0;
    if (allComments.length > 0) {
      const newBalance = balance - totalCost;
      await adminClient
        .from("user_credits")
        .update({ balance: newBalance })
        .eq("user_id", user.id);
      await adminClient.from("credit_transactions").insert({
        user_id: user.id,
        amount: -totalCost,
        type: "consumption",
        action_key: "extract_video",
        description: `Extração de ${videoUrls.length} vídeo(s) do YouTube`,
      });
      creditsCharged = totalCost;
    }

    const responsePayload = { comments: allComments, credits_charged: creditsCharged };

    // Persist idempotency record so retries return the same response without re-charging
    if (idempotencyKey) {
      await admin.from("idempotency_keys").upsert(
        {
          user_id: user.id,
          action_key: "extract_video",
          client_key: String(idempotencyKey),
          response: responsePayload,
        },
        { onConflict: "user_id,action_key,client_key" }
      );
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("youtube-comments error:", e);
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

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}
