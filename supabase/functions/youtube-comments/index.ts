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

    const { videoUrls } = await req.json();
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: "videoUrls is required (array)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get YouTube API key from app_settings
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
        // Limit to 500 comments per video
        if (allComments.filter((c) => c.video_url === url).length >= 500) break;
      } while (nextPageToken);
    }

    return new Response(JSON.stringify({ comments: allComments }), {
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
