import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Video, Mic, Music, AlertCircle } from 'lucide-react';

type Provider = {
  id: string;
  kind: 'video_ai' | 'tts' | 'music';
  provider: string;
  model: string | null;
  display_name: string;
  enabled: boolean;
  weight: number;
  api_key_secret_name: string | null;
  config: any;
};

const KIND_META = {
  video_ai: { label: 'Geração de vídeo', icon: Video, desc: 'Como cada cena vira animação' },
  tts: { label: 'Narração (TTS)', icon: Mic, desc: 'Voz sintetizada por IA para o vídeo' },
  music: { label: 'Música de fundo', icon: Music, desc: 'Trilha sonora para o vídeo' },
};

type CostAction = { action_key: string; display_name: string; cost: number };

export const VideoProvidersTab = () => {
  const { toast } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [costs, setCosts] = useState<CostAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: provs }, { data: costRows }] = await Promise.all([
      supabase.from('video_providers').select('*').order('kind').order('display_name'),
      supabase.from('credit_action_costs').select('action_key, display_name, cost').order('action_key'),
    ]);
    setProviders((provs as Provider[]) || []);
    setCosts((costRows as CostAction[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = async (id: string, patch: Partial<Provider>) => {
    setSaving(id);
    const { error } = await supabase.from('video_providers').update(patch as any).eq('id', id);
    setSaving(null);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return;
    }
    setProviders(prev => prev.map(p => p.id === id ? { ...p, ...patch } as Provider : p));
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const kinds: Provider['kind'][] = ['video_ai', 'tts', 'music'];

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-muted/30 border-primary/20">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Como funciona o roteamento por porcentagem</p>
            <p className="text-muted-foreground">
              Para cada categoria abaixo, ative os provedores desejados e defina um peso (0-100).
              Quando o usuário gerar um vídeo, o sistema escolherá um provedor entre os ativos seguindo a proporção dos pesos.
              Exemplo: dois provedores com pesos 70 e 30 → 70% e 30% das gerações.
              <br />
              <strong>Custos:</strong> ajuste valores em "Custos" (cobranças por segundo, por cena de IA e por narração).
            </p>
          </div>
        </div>
      </Card>

      {kinds.map(kind => {
        const meta = KIND_META[kind];
        const Icon = meta.icon;
        const list = providers.filter(p => p.kind === kind);
        const totalWeight = list.filter(p => p.enabled).reduce((s, p) => s + p.weight, 0);
        return (
          <Card key={kind} className="p-4 bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Icon className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <h3 className="font-semibold">{meta.label}</h3>
                <p className="text-xs text-muted-foreground">{meta.desc}</p>
              </div>
              <Badge variant={totalWeight === 100 || totalWeight === 0 ? 'secondary' : 'destructive'}>
                Pesos ativos: {totalWeight}{totalWeight !== 100 && totalWeight !== 0 ? ' (ideal: 100)' : ''}
              </Badge>
            </div>
            <div className="space-y-2">
              {list.map(p => (
                <div
                  key={p.id}
                  className="flex flex-col md:flex-row md:items-center gap-3 p-3 rounded-lg border border-border bg-background/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{p.display_name}</span>
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{p.provider}</code>
                    </div>
                    {p.config?.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{p.config.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Peso</Label>
                    <Input
                      type="number"
                      min={0} max={100}
                      value={p.weight}
                      onChange={(e) => update(p.id, { weight: parseInt(e.target.value || '0', 10) })}
                      disabled={!p.enabled || saving === p.id}
                      className="w-20 h-8"
                    />
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={(v) => update(p.id, { enabled: v })}
                      disabled={saving === p.id}
                    />
                  </div>
                </div>
              ))}
              {list.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum provedor cadastrado.</p>
              )}
            </div>
          </Card>
        );
      })}

      <Card className="p-4 bg-muted/30">
        <h4 className="font-semibold text-sm mb-2">Chaves de API necessárias</h4>
        <p className="text-xs text-muted-foreground mb-2">
          Para ativar provedores externos, configure os secrets correspondentes na aba "APIs & IA":
        </p>
        <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside">
          <li><code>RUNWAY_API_KEY</code> — para Runway Gen-3</li>
          <li><code>ELEVENLABS_API_KEY</code> — para narração ElevenLabs</li>
          <li><code>OPENAI_API_KEY</code> — para narração OpenAI TTS</li>
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          O provedor "Renderização no navegador" não precisa de chave externa — usa apenas o Canvas e as imagens já geradas.
        </p>
      </Card>
    </div>
  );
};
