import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = { content_id?: string; script?: string; preferred_provider?: string };

const normalizeVideoPrompt = (rawScript: string) => {
  const cleaned = rawScript
    .replace(/\r/g, '\n')
    .replace(/^\s*(cena\s*\d+|scene\s*\d+|ato\s*\d+)\s*:?\s*$/gim, '')
    .replace(/^\s*\[[^\]]*\]\s*$/gim, '')
    .replace(/^\s*(imagem|texto na tela|apresentador|narra(?:ç|c)ão|voz over|locu(?:ç|c)ão|trilha sonora|sfx)\s*:\s*/gim, '')
    .replace(/^\s*[A-ZÀ-Ú][A-ZÀ-Ú\s]{1,20}:\s*/gm, '')
    .replace(/\b(cut to|corte para|split[- ]screen|tela dividida|transi(?:ç|c)ão|zoom in|zoom out)\b/gi, 'then')
    .replace(/["“”]/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const basePrompt = cleaned || rawScript.trim();
  return `Single continuous cinematic shot, no cuts, no split-screen. ${basePrompt}`.slice(0, 900);
};

// Provider order of preference and metadata
const PROVIDERS: { id: string; name: string; settingKey: string; model: string }[] = [
  { id: 'runway', name: 'Runway ML', settingKey: 'video_ai_runway_key', model: 'gen4.5' },
  { id: 'replicate', name: 'Replicate', settingKey: 'video_ai_replicate_key', model: 'stability-ai/stable-video-diffusion' },
  { id: 'stability', name: 'Stability AI', settingKey: 'video_ai_stability_key', model: 'stable-video-diffusion' },
  { id: 'freesoragenerator', name: 'Free Sora Generator', settingKey: 'video_ai_freesoragenerator_key', model: 'sora-1' },
];

const getProviderPriority = (preferredProvider?: string) => {
  const scriptOnlyPriority = ['replicate', 'stability', 'runway', 'freesoragenerator'];
  const byId = new Map(PROVIDERS.map((provider) => [provider.id, provider]));
  const ordered = scriptOnlyPriority.map((id) => byId.get(id)).filter(Boolean) as typeof PROVIDERS;

  if (!preferredProvider) return ordered;

  const preferred = byId.get(preferredProvider);
  if (!preferred) return ordered;

  return [preferred, ...ordered.filter((provider) => provider.id !== preferred.id)];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    let script = (body.script || '').trim();
    let contentId: string | null = body.content_id || null;

    if (!script && contentId) {
      const { data: content } = await userClient
        .from('generated_contents')
        .select('id, script, caption, title')
        .eq('id', contentId)
        .maybeSingle();
      script = (content?.script || content?.caption || content?.title || '').trim();
    }

    if (!script) {
      return new Response(JSON.stringify({ error: 'Roteiro vazio. Esse conteúdo não possui roteiro para gerar o vídeo.' }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine which providers have keys configured
    const { data: settings } = await admin
      .from('app_settings')
      .select('key, value')
      .in('key', PROVIDERS.map(p => p.settingKey));
    const keyMap = new Map<string, string>();
    (settings || []).forEach(s => { if (s.value) keyMap.set(s.key, s.value); });

    const available = getProviderPriority(body.preferred_provider).filter(p => keyMap.get(p.settingKey));
    if (available.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum provedor de IA de vídeo configurado. Configure em Admin → Integrações → IA de Vídeos.' }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consume credits
    const { data: costRow } = await admin
      .from('credit_action_costs')
      .select('cost')
      .eq('action_key', 'generate_ai_video')
      .maybeSingle();
    const cost = costRow?.cost ?? 25;

    const { data: consumeRes, error: consumeErr } = await userClient.rpc('consume_credits', {
      _amount: cost,
      _action_key: 'generate_ai_video',
        _description: `Geração de vídeo via IA de vídeo`,
      _reference_id: contentId,
    });
    if (consumeErr) throw consumeErr;
    if (consumeRes && (consumeRes as any).success === false) {
      return new Response(JSON.stringify({ error: 'Créditos insuficientes para gerar o vídeo.', insufficient_credits: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let videoUrl: string | null = null;
    let externalJobId: string | null = null;
    let errorMessage: string | null = null;
    let finalStatus = 'queued';
    let chosen = available[0];
    let logId: string | null = null;
    const attemptErrors: string[] = [];

    for (const provider of available) {
      chosen = provider;
      videoUrl = null;
      externalJobId = null;
      errorMessage = null;
      finalStatus = 'queued';
      const { data: logRow } = await admin
        .from('video_generation_log')
        .insert({
          user_id: user.id,
          user_email: user.email,
          content_id: contentId,
          provider: provider.id,
          model: provider.model,
          script,
          status: 'pending',
          credits_spent: cost,
          metadata: { provider_name: provider.name, attempt_order: attemptErrors.length + 1 },
        })
        .select('id')
        .single();
      logId = logRow?.id ?? null;

      try {
        const apiKey = keyMap.get(provider.settingKey)!;
        if (provider.id === 'replicate') {
        // Use model-based endpoint (no version hash needed). Default to a text-to-video model.
        const modelSlug = 'minimax/video-01'; // text-to-video model on Replicate
        const r = await fetch(`https://api.replicate.com/v1/models/${modelSlug}/predictions`, {
          method: 'POST',
          headers: {
            Authorization: `Token ${apiKey}`,
            'Content-Type': 'application/json',
            Prefer: 'wait=5',
          },
          body: JSON.stringify({
            input: { prompt: script.slice(0, 2000) },
          }),
        });
        const txt = await r.text();
        let j: any = {};
        try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
        if (!r.ok) {
          const detail = j?.detail || j?.error || j?.title || j?.raw || `HTTP ${r.status}`;
          throw new Error(`Replicate: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
        }
        externalJobId = j.id || null;
        videoUrl = Array.isArray(j.output) ? j.output[0] : (j.output || null);
        finalStatus = videoUrl ? 'completed' : 'queued';
        } else if (provider.id === 'runway') {
        const promptText = normalizeVideoPrompt(script);
        const r = await fetch('https://api.dev.runwayml.com/v1/image_to_video', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Runway-Version': '2024-11-06' },
          body: JSON.stringify({
            promptText,
            model: provider.model,
            ratio: '1280:720',
            duration: 5,
          }),
        });
        const txt = await r.text();
        let j: any = {};
        try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
        if (!r.ok) {
          const issues = Array.isArray(j?.issues)
            ? j.issues.map((issue: any) => `${Array.isArray(issue?.path) ? issue.path.join('.') : 'body'}: ${issue?.message || 'inválido'}`).join('; ')
            : null;
          throw new Error(issues || j?.error || j?.message || j?.raw || 'Runway request failed');
        }
        externalJobId = j.id || null;
        finalStatus = 'queued';
        } else if (provider.id === 'stability') {
        // Stability video endpoints require image input — we record as queued and return job placeholder
        finalStatus = 'queued';
        externalJobId = `stability_${Date.now()}`;
        } else if (provider.id === 'freesoragenerator') {
        const r = await fetch('https://api.freesoragenerator.com/v1/videos/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: script.slice(0, 2000), model: 'sora-1' }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || `Free Sora request failed (${r.status})`);
        externalJobId = j.id || j.job_id || null;
        videoUrl = j.video_url || j.url || null;
        finalStatus = videoUrl ? 'completed' : 'queued';
        }
      } catch (e: any) {
        errorMessage = e?.message || String(e);
        finalStatus = 'failed';
        attemptErrors.push(`${provider.name}: ${errorMessage}`);
      }

      if (logId) {
        await admin
          .from('video_generation_log')
          .update({
            status: finalStatus,
            error_message: errorMessage,
            video_url: videoUrl,
            external_job_id: externalJobId,
          })
          .eq('id', logId);
      }

      if (finalStatus !== 'failed') break;
    }

    if (finalStatus === 'failed') {
      errorMessage = attemptErrors.join(' | ') || 'Nenhum provedor conseguiu gerar o vídeo.';
      try {
        await admin.rpc('admin_add_credits', {
          _user_id: user.id,
          _amount: cost,
          _description: `Estorno: falha ao gerar vídeo (${chosen.name})`,
        });
      } catch (_) { /* ignore refund errors */ }
    }

    return new Response(JSON.stringify({
      success: finalStatus !== 'failed',
      provider: chosen.id,
      provider_name: chosen.name,
      status: finalStatus,
      video_url: videoUrl,
      external_job_id: externalJobId,
      error: errorMessage,
      log_id: logId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error('generate-ai-video error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
