// Tipos compartilhados de áudio para o editor de vídeo

export type SceneAudio = {
  // Música de fundo da cena (override). Se null, usa a global do projeto.
  musicUrl: string | null;
  musicVolume: number; // 0..1
  musicFadeIn: number; // s
  musicFadeOut: number; // s
  musicOffset: number; // s (ponto de início no arquivo)

  // Narração TTS por cena
  narrationEnabled: boolean;
  narrationProvider: 'browser_tts' | 'elevenlabs' | 'openai_tts' | 'upload';
  narrationText: string; // se vazio usa o texto da cena
  narrationVolume: number; // 0..1
  narrationVoice?: string; // voz preferida
  narrationUploadUrl?: string | null; // se provider = upload

  // Ducking automático: reduz a música quando narração toca
  duckingEnabled: boolean;
  duckingAmount: number; // 0..1 (ex: 0.3 = música cai pra 30%)
};

export const defaultSceneAudio = (): SceneAudio => ({
  musicUrl: null,
  musicVolume: 0.6,
  musicFadeIn: 0.4,
  musicFadeOut: 0.6,
  musicOffset: 0,
  narrationEnabled: false,
  narrationProvider: 'browser_tts',
  narrationText: '',
  narrationVolume: 1.0,
  duckingEnabled: true,
  duckingAmount: 0.25,
});

export type GlobalAudio = {
  musicUrl: string | null; // trilha aplicada a todas as cenas que não têm override
  musicVolume: number;
};

export type AudioLibraryItem = {
  id: string;
  title: string;
  author: string | null;
  mood: string | null;
  url: string;
  duration_seconds: number | null;
};
