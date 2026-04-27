import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Music2, Mic, Upload, Play, Pause, Volume2, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { SceneAudio, GlobalAudio, AudioLibraryItem } from './audioTypes';

type Props = {
  globalAudio: GlobalAudio;
  onGlobalAudioChange: (g: GlobalAudio) => void;
  sceneAudio: SceneAudio;
  onSceneAudioChange: (a: SceneAudio) => void;
  sceneText: string;
  sceneDuration: number;
  rendering: boolean;
};

export const AudioPanel = ({
  globalAudio, onGlobalAudioChange,
  sceneAudio, onSceneAudioChange,
  sceneText, sceneDuration, rendering,
}: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [library, setLibrary] = useState<AudioLibraryItem[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [uploading, setUploading] = useState<'music' | 'narration' | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audio_library')
        .select('id,title,author,mood,url,duration_seconds')
        .eq('is_active', true)
        .eq('kind', 'music')
        .order('sort_order', { ascending: true });
      setLibrary((data || []) as any);
    })();
  }, []);

  useEffect(() => {
    const load = () => {
      try {
        const v = window.speechSynthesis?.getVoices() || [];
        // Prioriza pt
        v.sort((a, b) => {
          const aPt = a.lang?.toLowerCase().startsWith('pt') ? 0 : 1;
          const bPt = b.lang?.toLowerCase().startsWith('pt') ? 0 : 1;
          return aPt - bPt;
        });
        setVoices(v);
      } catch { /* ignore */ }
    };
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);

  const update = (patch: Partial<SceneAudio>) => onSceneAudioChange({ ...sceneAudio, ...patch });

  const playPreview = (url: string) => {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (previewUrl === url) {
      setPreviewUrl(null);
      return;
    }
    const a = new Audio(url);
    a.volume = 0.7;
    a.play().catch(() => {/* ignore */});
    audioRef.current = a;
    setPreviewUrl(url);
    a.onended = () => setPreviewUrl(null);
  };

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPreviewUrl(null);
  };

  useEffect(() => () => stopPreview(), []);

  const previewTts = () => {
    try {
      const text = (sceneAudio.narrationText || sceneText || '').trim();
      if (!text) return;
      window.speechSynthesis?.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voices.find(v => v.name === sceneAudio.narrationVoice) ||
        voices.find(v => v.lang?.toLowerCase().startsWith('pt'));
      if (v) u.voice = v;
      u.volume = sceneAudio.narrationVolume;
      u.rate = 1;
      window.speechSynthesis?.speak(u);
    } catch { /* ignore */ }
  };

  const uploadFile = async (file: File, target: 'music' | 'narration') => {
    if (!user) return;
    setUploading(target);
    try {
      const ext = file.name.split('.').pop() || 'mp3';
      const path = `${user.id}/${Date.now()}-${target}.${ext}`;
      const { error } = await supabase.storage
        .from('audio-library')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('audio-library').getPublicUrl(path);
      if (target === 'music') {
        update({ musicUrl: data.publicUrl });
      } else {
        update({ narrationProvider: 'upload', narrationUploadUrl: data.publicUrl, narrationEnabled: true });
      }
      toast({ title: 'Áudio enviado' });
    } catch (e: any) {
      toast({ title: 'Falha no upload', description: e.message || '', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const effectiveMusicUrl = sceneAudio.musicUrl || globalAudio.musicUrl;

  return (
    <div className="space-y-3">
      {/* Música global */}
      <Card className="p-3 space-y-2 bg-card">
        <div className="flex items-center gap-2">
          <Music2 className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Trilha global</h4>
          {globalAudio.musicUrl && (
            <Badge variant="outline" className="ml-auto text-[10px]">aplica em todas</Badge>
          )}
        </div>
        {globalAudio.musicUrl ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => playPreview(globalAudio.musicUrl!)}
              disabled={rendering}
            >
              {previewUrl === globalAudio.musicUrl ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <span className="text-xs truncate flex-1">{globalAudio.musicUrl.split('/').pop()}</span>
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => onGlobalAudioChange({ ...globalAudio, musicUrl: null })}
              disabled={rendering}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">Nenhuma trilha global. Escolha na galeria abaixo ou faça upload.</p>
        )}
        <div className="flex items-center gap-2">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Slider
            value={[globalAudio.musicVolume]}
            min={0} max={1} step={0.05}
            onValueChange={(v) => onGlobalAudioChange({ ...globalAudio, musicVolume: v[0] })}
            disabled={rendering || !globalAudio.musicUrl}
          />
          <span className="text-[11px] tabular-nums w-8 text-right">{Math.round(globalAudio.musicVolume * 100)}%</span>
        </div>
      </Card>

      {/* Galeria */}
      <Card className="p-3 space-y-2 bg-card">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Galeria de músicas livres</h4>
          <label className="cursor-pointer">
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'music')}
              disabled={rendering || uploading !== null}
            />
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded border border-border hover:border-primary hover:text-primary">
              {uploading === 'music' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Enviar áudio
            </span>
          </label>
        </div>
        <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
          {library.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-2 p-1.5 rounded border text-xs ${
                effectiveMusicUrl === item.url ? 'border-primary bg-primary/10' : 'border-border'
              }`}
            >
              <Button
                variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onClick={() => playPreview(item.url)}
                disabled={rendering}
              >
                {previewUrl === item.url ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              </Button>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.title}</div>
                <div className="opacity-60 truncate">{item.mood || ''} · {item.author}</div>
              </div>
              <Button
                variant="outline" size="sm" className="h-7 text-[10px] px-2"
                onClick={() => onGlobalAudioChange({ ...globalAudio, musicUrl: item.url })}
                disabled={rendering}
              >Global</Button>
              <Button
                variant="outline" size="sm" className="h-7 text-[10px] px-2"
                onClick={() => update({ musicUrl: item.url })}
                disabled={rendering}
              >Cena</Button>
            </div>
          ))}
          {library.length === 0 && (
            <p className="text-[11px] text-muted-foreground">Nenhuma trilha disponível.</p>
          )}
        </div>
      </Card>

      {/* Música da cena (override) */}
      <Card className="p-3 space-y-2 bg-card">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold">Música desta cena</h4>
          {sceneAudio.musicUrl && (
            <Badge variant="outline" className="ml-auto text-[10px]">override</Badge>
          )}
        </div>
        {sceneAudio.musicUrl ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="icon" className="h-8 w-8"
              onClick={() => playPreview(sceneAudio.musicUrl!)}
              disabled={rendering}
            >
              {previewUrl === sceneAudio.musicUrl ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <span className="text-xs truncate flex-1">{sceneAudio.musicUrl.split('/').pop()}</span>
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => update({ musicUrl: null })}
              disabled={rendering}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {globalAudio.musicUrl ? 'Usando a trilha global.' : 'Sem música nesta cena.'}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Volume: {Math.round(sceneAudio.musicVolume * 100)}%</Label>
            <Slider value={[sceneAudio.musicVolume]} min={0} max={1} step={0.05}
              onValueChange={(v) => update({ musicVolume: v[0] })}
              disabled={rendering} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px]">Início (s): {sceneAudio.musicOffset.toFixed(1)}</Label>
            <Slider value={[sceneAudio.musicOffset]} min={0} max={60} step={0.5}
              onValueChange={(v) => update({ musicOffset: v[0] })}
              disabled={rendering} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px]">Fade in (s): {sceneAudio.musicFadeIn.toFixed(1)}</Label>
            <Slider value={[sceneAudio.musicFadeIn]} min={0} max={Math.min(3, sceneDuration / 2)} step={0.1}
              onValueChange={(v) => update({ musicFadeIn: v[0] })}
              disabled={rendering} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px]">Fade out (s): {sceneAudio.musicFadeOut.toFixed(1)}</Label>
            <Slider value={[sceneAudio.musicFadeOut]} min={0} max={Math.min(3, sceneDuration / 2)} step={0.1}
              onValueChange={(v) => update({ musicFadeOut: v[0] })}
              disabled={rendering} className="mt-1" />
          </div>
        </div>
      </Card>

      {/* Narração TTS */}
      <Card className="p-3 space-y-2 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-semibold">Narração</h4>
          </div>
          <Switch
            checked={sceneAudio.narrationEnabled}
            onCheckedChange={(c) => update({ narrationEnabled: c })}
            disabled={rendering}
          />
        </div>

        {sceneAudio.narrationEnabled && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px]">Provedor</Label>
                <select
                  value={sceneAudio.narrationProvider}
                  onChange={(e) => update({ narrationProvider: e.target.value as any })}
                  disabled={rendering}
                  className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
                >
                  <option value="browser_tts">Voz do navegador (grátis)</option>
                  <option value="upload">Upload de arquivo</option>
                </select>
              </div>
              <div>
                <Label className="text-[10px]">Voz</Label>
                <select
                  value={sceneAudio.narrationVoice || ''}
                  onChange={(e) => update({ narrationVoice: e.target.value })}
                  disabled={rendering || sceneAudio.narrationProvider !== 'browser_tts'}
                  className="w-full mt-1 h-8 text-xs rounded border border-border bg-background px-2"
                >
                  <option value="">Padrão</option>
                  {voices.slice(0, 30).map(v => (
                    <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                  ))}
                </select>
              </div>
            </div>

            {sceneAudio.narrationProvider === 'upload' ? (
              <div className="flex items-center gap-2">
                <label className="cursor-pointer flex-1">
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0], 'narration')}
                    disabled={rendering || uploading !== null}
                  />
                  <span className="inline-flex w-full items-center justify-center gap-1 text-[11px] px-2 py-1.5 rounded border border-border hover:border-primary hover:text-primary">
                    {uploading === 'narration' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {sceneAudio.narrationUploadUrl ? 'Trocar arquivo' : 'Enviar narração'}
                  </span>
                </label>
                {sceneAudio.narrationUploadUrl && (
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    onClick={() => playPreview(sceneAudio.narrationUploadUrl!)}
                    disabled={rendering}
                  >
                    {previewUrl === sceneAudio.narrationUploadUrl ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <Label className="text-[10px]">Texto da narração (vazio = texto da cena)</Label>
                <Textarea
                  value={sceneAudio.narrationText}
                  onChange={(e) => update({ narrationText: e.target.value })}
                  placeholder={sceneText}
                  rows={2}
                  disabled={rendering}
                  className="text-xs"
                />
                <Button variant="outline" size="sm" className="mt-2 w-full h-8"
                  onClick={previewTts}
                  disabled={rendering || voices.length === 0}
                >
                  <Play className="h-3 w-3 mr-1" /> Ouvir narração
                </Button>
                {voices.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Seu navegador não suporta vozes TTS. Use o modo Upload.
                  </p>
                )}
              </div>
            )}

            <div>
              <Label className="text-[10px]">Volume narração: {Math.round(sceneAudio.narrationVolume * 100)}%</Label>
              <Slider value={[sceneAudio.narrationVolume]} min={0} max={1} step={0.05}
                onValueChange={(v) => update({ narrationVolume: v[0] })}
                disabled={rendering} className="mt-1" />
            </div>

            <div className="border-t border-border pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px]">Ducking (abaixa música quando narra)</Label>
                <Switch
                  checked={sceneAudio.duckingEnabled}
                  onCheckedChange={(c) => update({ duckingEnabled: c })}
                  disabled={rendering}
                />
              </div>
              {sceneAudio.duckingEnabled && (
                <div>
                  <Label className="text-[10px]">
                    Intensidade: música cai p/ {Math.round(sceneAudio.duckingAmount * 100)}%
                  </Label>
                  <Slider value={[sceneAudio.duckingAmount]} min={0} max={1} step={0.05}
                    onValueChange={(v) => update({ duckingAmount: v[0] })}
                    disabled={rendering} className="mt-1" />
                </div>
              )}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
