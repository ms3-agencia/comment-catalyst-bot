import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Loader2, Upload, Save, Globe, FileText, ImageIcon, Trash2, Link2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Branding = {
  context: 'landing' | 'pdf';
  site_name: string;
  tagline: string | null;
  footer_text: string | null;
  logo_url: string | null;
};

const empty = (ctx: 'landing' | 'pdf'): Branding => ({
  context: ctx,
  site_name: 'YCaptura',
  tagline: '',
  footer_text: '',
  logo_url: '',
});

const BrandingForm = ({
  ctx,
  icon,
  title,
  description,
  data,
  onSaved,
}: {
  ctx: 'landing' | 'pdf';
  icon: React.ReactNode;
  title: string;
  description: string;
  data: Branding;
  onSaved: (b: Branding) => void;
}) => {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Branding>(data);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => setForm(data), [data]);

  const update = (patch: Partial<Branding>) => setForm((f) => ({ ...f, ...patch }));

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Arquivo inválido', description: 'Envie uma imagem (PNG, JPG, SVG, WebP).', variant: 'destructive' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Imagem muito grande', description: 'Máximo de 2MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${ctx}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('branding').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('branding').getPublicUrl(path);
      update({ logo_url: pub.publicUrl });
      toast({ title: 'Logo enviado', description: 'Não esqueça de salvar para aplicar.' });
    } catch (err) {
      toast({ title: 'Erro no upload', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('branding_settings')
        .update({
          site_name: form.site_name.trim() || 'YCaptura',
          tagline: form.tagline?.trim() || null,
          footer_text: form.footer_text?.trim() || null,
          logo_url: form.logo_url?.trim() || null,
        })
        .eq('context', ctx);
      if (error) throw error;
      toast({ title: 'Salvo!', description: `Personalização do ${ctx === 'landing' ? 'site' : 'PDF'} atualizada.` });
      onSaved(form);
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Nome do site / produto</Label>
          <Input value={form.site_name} onChange={(e) => update({ site_name: e.target.value })} placeholder="YCaptura" />
        </div>
        <div className="space-y-2">
          <Label>Subtítulo / Tagline</Label>
          <Input
            value={form.tagline ?? ''}
            onChange={(e) => update({ tagline: e.target.value })}
            placeholder="Análise de Audiência com IA"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Texto do rodapé</Label>
        <Textarea
          rows={2}
          value={form.footer_text ?? ''}
          onChange={(e) => update({ footer_text: e.target.value })}
          placeholder={ctx === 'landing' ? '© 2026 YCaptura. Todos os direitos reservados.' : 'Gerado por YCaptura — Análise inteligente de audiência'}
        />
      </div>

      <Separator />

      {/* Logo */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2"><ImageIcon size={14} /> Logo</Label>

        {form.logo_url && (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-3">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-white flex items-center justify-center">
              <img src={form.logo_url} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            </div>
            <p className="flex-1 text-xs text-muted-foreground break-all">{form.logo_url}</p>
            <Button variant="ghost" size="sm" onClick={() => update({ logo_url: '' })}>
              <Trash2 size={14} />
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-[1fr,auto]">
          <Input
            value={form.logo_url ?? ''}
            onChange={(e) => update({ logo_url: e.target.value })}
            placeholder="Cole uma URL de imagem ou envie um arquivo"
          />
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Enviar arquivo
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, SVG ou WebP até 2MB. Recomendado: fundo transparente.</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar alterações
      </Button>
    </Card>
  );
};

const AppUrlSection = () => {
  const { toast } = useToast();
  const [appUrl, setAppUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'app_base_url')
        .maybeSingle();
      setAppUrl(data?.value || '');
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    const trimmed = appUrl.trim().replace(/\/+$/, '');
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      toast({ title: 'URL inválida', description: 'A URL deve começar com http:// ou https://', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'app_base_url', value: trimmed }, { onConflict: 'key' });
      if (error) throw error;
      setAppUrl(trimmed);
      toast({ title: 'URL salva', description: 'Os links {{app_url}} dos emails passarão a usar este domínio.' });
    } catch (err) {
      toast({ title: 'Erro ao salvar', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Link2 size={20} />
        </div>
        <div>
          <h3 className="font-heading text-lg font-bold">URL pública do sistema</h3>
          <p className="text-sm text-muted-foreground">
            Domínio que substituirá a variável <code className="px-1 py-0.5 rounded bg-secondary text-xs">{'{{app_url}}'}</code> em todos os templates de email (confirmação, recuperação, avisos, etc.).
          </p>
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <Label>URL base (sem barra final)</Label>
        <Input
          value={appUrl}
          onChange={(e) => setAppUrl(e.target.value)}
          placeholder="https://ycaptura.ms3.com.br"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Exemplo: links como <code>{'{{app_url}}'}/confirm-email?token=...</code> serão renderizados com este domínio.
        </p>
      </div>
      <Button onClick={handleSave} disabled={saving || loading} className="w-full md:w-auto">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar URL
      </Button>
    </Card>
  );
};

export const BrandingTab = () => {
  const [landing, setLanding] = useState<Branding>(empty('landing'));
  const [pdf, setPdf] = useState<Branding>(empty('pdf'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('branding_settings')
        .select('context, site_name, tagline, footer_text, logo_url');
      if (data) {
        const l = data.find((d) => d.context === 'landing');
        const p = data.find((d) => d.context === 'pdf');
        if (l) setLanding(l as Branding);
        if (p) setPdf(p as Branding);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Card className="glass p-12 flex justify-center">
        <Loader2 className="animate-spin text-primary" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <AppUrlSection />
      <BrandingForm
        ctx="landing"
        icon={<Globe size={20} />}
        title="Landing page"
        description="Personalize o nome, logo e rodapé da página inicial pública."
        data={landing}
        onSaved={setLanding}
      />
      <BrandingForm
        ctx="pdf"
        icon={<FileText size={20} />}
        title="Relatório PDF"
        description="Personalize o cabeçalho, logo e rodapé dos PDFs gerados pela IA."
        data={pdf}
        onSaved={setPdf}
      />
    </div>
  );
};
