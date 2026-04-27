// Mixagem de áudio por cenas usando WebAudio + MediaStream destination.
// Retorna um MediaStreamTrack de áudio para combinar com o stream do canvas.

import type { SceneAudio, GlobalAudio } from './audioTypes';

export type AudioSceneSpec = {
  duration: number; // s
  text: string;
  audio: SceneAudio;
};

export type MixResult = {
  track: MediaStreamTrack;
  context: AudioContext;
  cleanup: () => Promise<void>;
};

// Pré-carrega audio buffer
async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return await ctx.decodeAudioData(ab);
  } catch {
    return null;
  }
}

// Sintetiza TTS em um AudioBuffer usando MediaRecorder + Web Speech.
// Limitação: Web Speech não expõe áudio direto; capturamos via display capture seria intrusivo.
// Workaround: tocamos o utterance e medimos sua duração. Para permitir mixagem real,
// usamos um SilentBuffer da duração estimada e ducking aplicado nessa janela.
// Na prática, durante a renderização final, o utterance é speak()ado em paralelo e
// roteado para os alto-falantes (não capturado). Para garantir narração no arquivo,
// recomenda-se usar provider 'upload'.
function estimateTtsDuration(text: string): number {
  if (!text) return 0;
  const wordsPerSec = 2.6; // ~155 wpm em pt
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.min(20, words / wordsPerSec));
}

export async function buildMixedAudioTrack(
  globalAudio: GlobalAudio,
  scenes: AudioSceneSpec[],
): Promise<MixResult | null> {
  const AnyAC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AnyAC) return null;

  const ctx: AudioContext = new AnyAC();
  const dest = (ctx as any).createMediaStreamDestination();
  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(dest);

  // Pre-carregar buffers únicos
  const urlSet = new Set<string>();
  if (globalAudio.musicUrl) urlSet.add(globalAudio.musicUrl);
  for (const s of scenes) {
    if (s.audio.musicUrl) urlSet.add(s.audio.musicUrl);
    if (s.audio.narrationProvider === 'upload' && s.audio.narrationUploadUrl) {
      urlSet.add(s.audio.narrationUploadUrl);
    }
  }
  const buffers = new Map<string, AudioBuffer>();
  await Promise.all(Array.from(urlSet).map(async (u) => {
    const b = await loadBuffer(ctx, u);
    if (b) buffers.set(u, b);
  }));

  // Agendamento por cena
  let cursor = 0;
  const startAt = ctx.currentTime + 0.1;
  const ttsUtterances: Array<{ when: number; u: SpeechSynthesisUtterance }> = [];

  for (const s of scenes) {
    const sceneStart = startAt + cursor;
    const sceneEnd = sceneStart + s.duration;

    // Música efetiva (override > global)
    const musicUrl = s.audio.musicUrl || globalAudio.musicUrl;
    const baseVolume = (s.audio.musicUrl ? s.audio.musicVolume : globalAudio.musicVolume) ?? 0.6;
    const musicBuf = musicUrl ? buffers.get(musicUrl) || null : null;

    // Estima duração da narração para ducking
    let narrDur = 0;
    if (s.audio.narrationEnabled) {
      if (s.audio.narrationProvider === 'upload' && s.audio.narrationUploadUrl) {
        narrDur = buffers.get(s.audio.narrationUploadUrl)?.duration || 0;
      } else if (s.audio.narrationProvider === 'browser_tts') {
        narrDur = estimateTtsDuration(s.audio.narrationText || s.text);
      }
    }
    const ductStart = sceneStart + 0.2;
    const ductEnd = sceneStart + Math.min(s.duration, 0.2 + Math.max(narrDur, 0));

    if (musicBuf) {
      const src = ctx.createBufferSource();
      src.buffer = musicBuf;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, sceneStart);
      const fadeIn = Math.max(0.01, s.audio.musicFadeIn);
      const fadeOut = Math.max(0.01, s.audio.musicFadeOut);

      g.gain.linearRampToValueAtTime(baseVolume, sceneStart + fadeIn);

      // Ducking
      if (s.audio.narrationEnabled && s.audio.duckingEnabled && narrDur > 0) {
        const ducked = baseVolume * Math.max(0, Math.min(1, s.audio.duckingAmount));
        g.gain.linearRampToValueAtTime(ducked, ductStart + 0.15);
        g.gain.linearRampToValueAtTime(baseVolume, ductEnd + 0.2);
      }

      // Fade out
      g.gain.setValueAtTime(g.gain.value, sceneEnd - fadeOut);
      g.gain.linearRampToValueAtTime(0, sceneEnd);

      src.connect(g).connect(masterGain);
      const offset = Math.max(0, s.audio.musicOffset || 0);
      try { src.start(sceneStart, offset, s.duration + 0.1); } catch { /* ignore */ }
    }

    // Narração via upload -> mixar no destino
    if (s.audio.narrationEnabled && s.audio.narrationProvider === 'upload' && s.audio.narrationUploadUrl) {
      const buf = buffers.get(s.audio.narrationUploadUrl);
      if (buf) {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = s.audio.narrationVolume ?? 1;
        src.connect(g).connect(masterGain);
        try { src.start(sceneStart + 0.2, 0, Math.min(buf.duration, s.duration)); } catch { /* ignore */ }
      }
    }

    // Narração via Web Speech: agenda speak() no tempo correto (sai pelo speaker, não no arquivo)
    if (s.audio.narrationEnabled && s.audio.narrationProvider === 'browser_tts') {
      const text = (s.audio.narrationText || s.text || '').trim();
      if (text && typeof SpeechSynthesisUtterance !== 'undefined') {
        const u = new SpeechSynthesisUtterance(text);
        u.volume = s.audio.narrationVolume ?? 1;
        const when = (sceneStart - ctx.currentTime) * 1000;
        ttsUtterances.push({ when, u });
      }
    }

    cursor += s.duration;
  }

  // Disparar utterances no tempo
  const timers: number[] = [];
  for (const t of ttsUtterances) {
    const id = window.setTimeout(() => {
      try { window.speechSynthesis?.speak(t.u); } catch { /* ignore */ }
    }, Math.max(0, t.when));
    timers.push(id);
  }

  const track = (dest.stream as MediaStream).getAudioTracks()[0] as MediaStreamTrack;

  const cleanup = async () => {
    for (const id of timers) clearTimeout(id);
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    try { await ctx.close(); } catch { /* ignore */ }
  };

  return { track, context: ctx, cleanup };
}
