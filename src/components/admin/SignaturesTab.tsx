import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Plus, Trash2, PenLine, Star, Image as ImageIcon } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';

type Signature = {
  id: string;
  name: string;
  body_html: string;
  logo_url: string | null;
  is_default: boolean;
  enabled: boolean;
};

const SIG_VARS = ['site_name', 'logo_url', 'app_url', 'user_name'];

export function SignaturesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_signatures')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar assinaturas', description: error.message, variant: 'destructive' });
    } else {
      setSignatures(data || []);
      if (!activeId && data?.length) setActiveId(data[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (id: string, patch: Partial<Signature>) => {
    setSignatures(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  };

  const create = async () => {
    const name = prompt('Nome da nova assinatura:');
    if (!name?.trim()) return;
    const { data, error } = await supabase.from('email_signatures').insert({
      name: name.trim(),
      body_html: '<p style="font-size:13px;color:#64748b;">Atenciosamente,<br/><strong>Equipe {{site_name}}</strong></p>',
      enabled: true,
      is_default: signatures.length === 0,
    }).select().single();
    if (error) {
      toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Assinatura criada' });
    await load();
    if (data) setActiveId(data.id);
  };

  const save = async (sig: Signature) => {
    setSaving(true);
    const { error } = await supabase.from('email_signatures').update({
      name: sig.name,
      body_html: sig.body_html,
      logo_url: sig.logo_url,
      enabled: sig.enabled,
    }).eq('id', sig.id);
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Assinatura salva' });
    }
  };

  const setDefault = async (sig: Signature) => {
    // remove default das outras, depois marca esta
    await supabase.from('email_signatures').update({ is_default: false }).neq('id', sig.id);
    const { error } = await supabase.from('email_signatures').update({ is_default: true }).eq('id', sig.id);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Assinatura padrão definida' });
      load();
    }
  };

  const remove = async (sig: Signature) => {
    if (!confirm(`Remover assinatura "${sig.name}"?`)) return;
    const { error } = await supabase.from('email_signatures').delete().eq('id', sig.id);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Removida' });
      const remaining = signatures.filter(s => s.id !== sig.id);
      setActiveId(remaining[0]?.id || null);
      load();
    }
  };

  const handleLogoUpload = async (sig: Signature, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `email-signatures/${sig.id}.${ext}`;
    const { error: upErr } = await supabase.storage.from('branding').upload(path, file, { upsert: true });
    if (upErr) {
      toast({ title: 'Erro no upload', description: upErr.message, variant: 'destructive' });
      return;
    }
    const { data } = supabase.storage.from('branding').getPublicUrl(path);
    update(sig.id, { logo_url: `${data.publicUrl}?t=${Date.now()}` });
    toast({ title: 'Logo enviado — clique em Salvar' });
  };

  const active = signatures.find(s => s.id === activeId);

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Crie assinaturas reutilizáveis com logo e texto, depois associe a cada template em <strong>Templates & regras</strong>.
        Use <code>{'{{logo_url}}'}</code> dentro do HTML para inserir o logo.
      </p>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={create}>
            <Plus size={14} className="mr-1" /> Nova assinatura
          </Button>
          {signatures.length === 0 && (
            <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma assinatura criada.</p>
          )}
          {signatures.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`w-full text-left p-2 rounded border text-sm transition-colors ${
                activeId === s.id ? 'bg-primary/10 border-primary' : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate flex items-center gap-1">
                  <PenLine size={12} />
                  {s.name}
                </span>
                {s.is_default && <Star size={12} className="text-primary fill-primary shrink-0" />}
              </div>
              {!s.enabled && <Badge variant="outline" className="text-[9px] mt-1">Desativada</Badge>}
            </button>
          ))}
        </div>

        {active && (
          <Card className="p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-semibold">{active.name}</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs">
                  <Switch checked={active.enabled} onCheckedChange={v => update(active.id, { enabled: v })} /> Ativa
                </label>
                {!active.is_default && (
                  <Button variant="outline" size="sm" onClick={() => setDefault(active)}>
                    <Star size={12} className="mr-1" /> Tornar padrão
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input value={active.name} onChange={e => update(active.id, { name: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1"><ImageIcon size={12} /> Logo da assinatura</Label>
              <div className="flex items-center gap-3">
                {active.logo_url && (
                  <img src={active.logo_url} alt="Logo" className="h-12 max-w-[120px] object-contain rounded border border-border bg-white p-1" />
                )}
                <Input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(active, f);
                  }}
                  className="max-w-xs"
                />
                {active.logo_url && (
                  <Button variant="ghost" size="sm" onClick={() => update(active.id, { logo_url: null })}>
                    <Trash2 size={12} />
                  </Button>
                )}
              </div>
              <Input
                placeholder="ou cole uma URL de imagem"
                value={active.logo_url || ''}
                onChange={e => update(active.id, { logo_url: e.target.value })}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                A URL pública do logo fica disponível como <code>{'{{logo_url}}'}</code> nesta assinatura e nos templates.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs">Conteúdo HTML da assinatura</Label>
                <div className="flex flex-wrap gap-1">
                  {SIG_VARS.map(v => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="cursor-pointer text-[10px] hover:bg-primary/10"
                      onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast({ title: `Copiado: {{${v}}}` }); }}
                    >
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
              <RichTextEditor value={active.body_html} onChange={html => update(active.id, { body_html: html })} />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => remove(active)}>
                <Trash2 size={14} className="mr-1" /> Remover
              </Button>
              <Button onClick={() => save(active)} disabled={saving} size="sm">
                {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />} Salvar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
