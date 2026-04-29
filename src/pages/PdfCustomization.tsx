import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { useUserAddons } from '@/hooks/useUserAddons';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Loader2, Save, Plus, Trash2, Lock, Sparkles, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

type Customization = {
  logo_url: string | null;
  brand_name: string | null;
  brand_position: 'header' | 'footer' | 'both' | 'none';
  logo_alignment: 'left' | 'center' | 'right';
  logo_size: number;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: string;
  cover_title: string | null;
  cover_subtitle: string | null;
  cover_image_url: string | null;
  header_text: string | null;
  footer_text: string | null;
  watermark_text: string | null;
  watermark_opacity: number;
  templates: any[];
  active_template_id: string | null;
  custom_fields: Record<string, any>;
};

const DEFAULT: Customization = {
  logo_url: null,
  brand_name: null,
  brand_position: 'footer',
  logo_alignment: 'left',
  logo_size: 48,
  primary_color: '#06b6d4',
  secondary_color: '#0f172a',
  accent_color: '#22d3ee',
  font_family: 'Inter',
  cover_title: null,
  cover_subtitle: null,
  cover_image_url: null,
  header_text: null,
  footer_text: null,
  watermark_text: null,
  watermark_opacity: 0.1,
  templates: [],
  active_template_id: null,
  custom_fields: {},
};

const FONTS = ['Inter', 'Space Grotesk', 'Roboto', 'Open Sans', 'Lato', 'Poppins', 'Montserrat', 'Playfair Display', 'Merriweather'];

const PdfCustomization = () => {
  const { user } = useAuth();
  const { hasAddon, loading: addonsLoading } = useUserAddons();
  const { toast } = useToast();
  const [config, setConfig] = useState<Customization>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  const owned = hasAddon('pdf-customization');

  useEffect(() => {
    if (!user) return;
    supabase.from('pdf_customizations').select('*').eq('user_id', user.id).maybeSingle().then(({ data }) => {
      if (data) setConfig({ ...DEFAULT, ...(data as any), templates: (data.templates as any) || [], custom_fields: (data.custom_fields as any) || {} });
      setLoading(false);
    });
  }, [user]);

  const upload = async (field: 'logo_url' | 'cover_image_url', file: File) => {
    if (!user) return;
    setUploading(field);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${field}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('pdf-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('pdf-assets').getPublicUrl(path);
      setConfig({ ...config, [field]: publicUrl });
      toast({ title: 'Imagem enviada' });
    } catch (e: any) {
      toast({ title: 'Erro no upload', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('pdf_customizations').upsert({
        user_id: user.id,
        ...config,
      }, { onConflict: 'user_id' });
      if (error) throw error;
      toast({ title: 'Personalização salva!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = () => {
    const id = `tpl_${Date.now()}`;
    setConfig({
      ...config,
      templates: [...config.templates, { id, name: `Template ${config.templates.length + 1}`, layout: 'modern' }],
    });
  };

  const removeTemplate = (id: string) => {
    setConfig({
      ...config,
      templates: config.templates.filter((t: any) => t.id !== id),
      active_template_id: config.active_template_id === id ? null : config.active_template_id,
    });
  };

  const generateTestPdf = async () => {
    // First save, then trigger an export of a sample profile
    await save();
    const sampleProfile = `## 🎯 Perfil do Avatar\n\nUm perfil de teste para visualizar o resultado da personalização.\n\n## 👥 Dados Demográficos\n\n- Faixa etária: 25-40 anos\n- Localização: Brasil\n- Interesses: Tecnologia, marketing\n\n## 📊 Comportamento\n\nEngajamento alto em conteúdos educacionais e tutoriais.\n\n## ❤️ Interesses\n\n- Inovação\n- Empreendedorismo\n- Produtividade`;
    // Use the same generator from AiProfileCard via dynamic import:
    const { default: jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;
    void jsPDF; void html2canvas; // ensure libs preloaded
    // Render preview by mounting a hidden AiProfileCard? Simpler: open Projects and let user export there.
    toast({ title: 'Personalização salva', description: 'Gere um PDF em Meus Projetos para ver o resultado.' });
  };

  if (loading || addonsLoading) {
    return <DashboardLayout><div className="py-16 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></DashboardLayout>;
  }

  if (!owned) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto">
          <Card className="p-8 text-center space-y-4">
            <Lock className="h-12 w-12 mx-auto text-muted-foreground" />
            <h2 className="font-heading text-2xl font-bold">Add-on necessário</h2>
            <p className="text-muted-foreground">A personalização de PDF é um recurso adicional. Compre o add-on para desbloquear.</p>
            <Button asChild>
              <Link to="/dashboard/addons"><Sparkles className="h-4 w-4" /> Ver Recursos Adicionais</Link>
            </Button>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-3xl font-bold flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Personalização de PDF
            </h1>
            <p className="text-muted-foreground mt-1">Configure a aparência dos PDFs gerados pelo sistema.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={generateTestPdf} disabled={saving}>
              <Eye className="h-4 w-4" /> Salvar e testar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        </div>

        {/* Live preview */}
        <Card className="overflow-hidden">
          <div className="px-4 py-2 bg-muted/40 border-b flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <Eye className="h-3.5 w-3.5" /> Prévia da capa
          </div>
          <div
            className="relative w-full aspect-[210/297] max-h-[420px] flex flex-col justify-between p-8 overflow-hidden"
            style={{
              fontFamily: `'${config.font_family}', sans-serif`,
              background: config.cover_image_url
                ? `linear-gradient(135deg, ${config.primary_color}dd, ${config.secondary_color}dd), url(${config.cover_image_url}) center/cover no-repeat`
                : `linear-gradient(135deg, ${config.primary_color}, ${config.secondary_color})`,
              color: '#fff',
            }}
          >
            {config.watermark_text && (
              <div
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                style={{ opacity: config.watermark_opacity, transform: 'rotate(-30deg)' }}
              >
                <span style={{ fontSize: 64, fontWeight: 800, color: '#fff' }}>{config.watermark_text}</span>
              </div>
            )}
            <div
              className="flex items-center gap-3 relative"
              style={{
                justifyContent:
                  config.logo_alignment === 'center' ? 'center'
                  : config.logo_alignment === 'right' ? 'flex-end'
                  : 'flex-start',
              }}
            >
              {config.logo_url ? (
                <img
                  src={config.logo_url}
                  alt=""
                  className="rounded-lg bg-white/15 p-1 object-contain"
                  style={{ height: Math.min(160, config.logo_size), width: Math.min(160, config.logo_size) }}
                />
              ) : (
                <div
                  className="rounded-lg bg-white/15 flex items-center justify-center text-2xl"
                  style={{ height: Math.min(160, config.logo_size), width: Math.min(160, config.logo_size) }}
                >🧠</div>
              )}
              {(config.brand_position === 'header' || config.brand_position === 'both') && (
                <span className="text-xs uppercase tracking-widest opacity-80">{config.brand_name || 'Sua Marca'}</span>
              )}
            </div>
            <div className="relative">
              <h2 className="text-3xl font-bold leading-tight">{config.cover_title || 'Título da capa'}</h2>
              <p className="mt-2 text-sm opacity-90">{config.cover_subtitle || 'Subtítulo aparece aqui'}</p>
            </div>
            <div className="flex justify-between text-xs opacity-80 relative">
              <span>{config.header_text || 'Cabeçalho personalizado'}</span>
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
          <div
            className="px-6 py-3 text-xs text-white flex justify-between"
            style={{ background: config.primary_color }}
          >
            <span>{config.footer_text || 'Rodapé personalizado aparecerá em todas as páginas'}</span>
            <span>
              {(config.brand_position === 'footer' || config.brand_position === 'both')
                ? `${config.brand_name || 'Sua Marca'} · `
                : ''}
              Página 1/1
            </span>
          </div>
        </Card>

        <Tabs defaultValue="brand">
          <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full h-auto">
            <TabsTrigger value="brand">Marca</TabsTrigger>
            <TabsTrigger value="cover">Capa</TabsTrigger>
            <TabsTrigger value="layout">Layout</TabsTrigger>
            <TabsTrigger value="watermark">Marca d'água</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="brand" className="mt-4 space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <Label>Logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  {config.logo_url && <img src={config.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded border bg-white p-1" />}
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload('logo_url', e.target.files[0])} />
                    <Button type="button" variant="outline" disabled={uploading === 'logo_url'} asChild>
                      <span>{uploading === 'logo_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar logo</span>
                    </Button>
                  </label>
                </div>
              </div>

              <div>
                <Label>Nome da Marca</Label>
                <Input
                  value={config.brand_name || ''}
                  onChange={(e) => setConfig({ ...config, brand_name: e.target.value })}
                  placeholder="Ex: Minha Empresa"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Posição do nome</Label>
                  <Select
                    value={config.brand_position}
                    onValueChange={(v: 'header' | 'footer' | 'both' | 'none') => setConfig({ ...config, brand_position: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem texto (apenas logo)</SelectItem>
                      <SelectItem value="header">Apenas no topo</SelectItem>
                      <SelectItem value="footer">Apenas no rodapé</SelectItem>
                      <SelectItem value="both">Topo e rodapé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Alinhamento do logo</Label>
                  <Select
                    value={config.logo_alignment}
                    onValueChange={(v: 'left' | 'center' | 'right') => setConfig({ ...config, logo_alignment: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Esquerda</SelectItem>
                      <SelectItem value="center">Centro</SelectItem>
                      <SelectItem value="right">Direita</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tamanho do logo: {config.logo_size}px</Label>
                  <Slider
                    value={[config.logo_size]}
                    onValueChange={(v) => setConfig({ ...config, logo_size: v[0] })}
                    min={24}
                    max={300}
                    step={2}
                    className="mt-3"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label>Cor primária</Label>
                  <Input type="color" value={config.primary_color} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="h-12 w-full" />
                </div>
                <div>
                  <Label>Cor secundária</Label>
                  <Input type="color" value={config.secondary_color} onChange={(e) => setConfig({ ...config, secondary_color: e.target.value })} className="h-12 w-full" />
                </div>
                <div>
                  <Label>Cor de destaque</Label>
                  <Input type="color" value={config.accent_color} onChange={(e) => setConfig({ ...config, accent_color: e.target.value })} className="h-12 w-full" />
                </div>
              </div>

              <div>
                <Label>Fonte</Label>
                <Select value={config.font_family} onValueChange={(v) => setConfig({ ...config, font_family: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FONTS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="cover" className="mt-4 space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <Label>Título da capa</Label>
                <Input value={config.cover_title || ''} onChange={(e) => setConfig({ ...config, cover_title: e.target.value })} placeholder="Ex: Relatório CommentIQ" />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={config.cover_subtitle || ''} onChange={(e) => setConfig({ ...config, cover_subtitle: e.target.value })} placeholder="Análise de comentários" />
              </div>
              <div>
                <Label>Imagem de fundo da capa</Label>
                <div className="flex items-center gap-4 mt-2">
                  {config.cover_image_url && <img src={config.cover_image_url} alt="" className="h-20 w-32 object-cover rounded border" />}
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload('cover_image_url', e.target.files[0])} />
                    <Button type="button" variant="outline" disabled={uploading === 'cover_image_url'} asChild>
                      <span>{uploading === 'cover_image_url' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Enviar imagem</span>
                    </Button>
                  </label>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="layout" className="mt-4 space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <Label>Texto do cabeçalho</Label>
                <Input value={config.header_text || ''} onChange={(e) => setConfig({ ...config, header_text: e.target.value })} placeholder="Aparece no topo de cada página" />
              </div>
              <div>
                <Label>Texto do rodapé</Label>
                <Textarea value={config.footer_text || ''} onChange={(e) => setConfig({ ...config, footer_text: e.target.value })} placeholder="Ex: © 2026 Sua Marca | contato@email.com" rows={2} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="watermark" className="mt-4 space-y-4">
            <Card className="p-6 space-y-4">
              <div>
                <Label>Texto da marca d'água</Label>
                <Input value={config.watermark_text || ''} onChange={(e) => setConfig({ ...config, watermark_text: e.target.value })} placeholder="Ex: CONFIDENCIAL" />
              </div>
              <div>
                <Label>Opacidade: {(config.watermark_opacity * 100).toFixed(0)}%</Label>
                <Slider value={[config.watermark_opacity * 100]} onValueChange={(v) => setConfig({ ...config, watermark_opacity: v[0] / 100 })} min={5} max={50} step={5} />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="mt-4 space-y-4">
            <Card className="p-6 space-y-3">
              <div className="flex justify-between items-center">
                <Label>Templates salvos</Label>
                <Button onClick={addTemplate} size="sm"><Plus className="h-4 w-4" /> Novo template</Button>
              </div>
              {config.templates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum template criado.</p>
              ) : (
                <div className="space-y-2">
                  {config.templates.map((t: any) => (
                    <div key={t.id} className={`flex items-center gap-3 p-3 rounded-lg border ${config.active_template_id === t.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                      <Input value={t.name} onChange={(e) => setConfig({ ...config, templates: config.templates.map((x: any) => x.id === t.id ? { ...x, name: e.target.value } : x) })} className="flex-1" />
                      <Select value={t.layout} onValueChange={(v) => setConfig({ ...config, templates: config.templates.map((x: any) => x.id === t.id ? { ...x, layout: v } : x) })}>
                        <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="modern">Moderno</SelectItem>
                          <SelectItem value="classic">Clássico</SelectItem>
                          <SelectItem value="minimal">Minimalista</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant={config.active_template_id === t.id ? 'default' : 'outline'} onClick={() => setConfig({ ...config, active_template_id: t.id })}>
                        {config.active_template_id === t.id ? 'Ativo' : 'Ativar'}
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => removeTemplate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default PdfCustomization;
