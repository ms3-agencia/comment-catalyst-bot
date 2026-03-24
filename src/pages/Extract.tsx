import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Youtube, Plus, X, Loader2, MessageSquare, ThumbsUp, Sparkles } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

type Comment = {
  author: string;
  content: string;
  likes: number;
  published_at: string;
  sentiment?: string;
};

const MOCK_COMMENTS: Comment[] = [
  { author: 'João Silva', content: 'Excelente vídeo! Muito informativo e bem explicado.', likes: 42, published_at: '2024-01-15', sentiment: 'positivo' },
  { author: 'Maria Santos', content: 'Poderia fazer um vídeo mais detalhado sobre esse tema?', likes: 18, published_at: '2024-01-14', sentiment: 'neutro' },
  { author: 'Pedro Costa', content: 'Não concordo com o ponto 3, acho que tem outras formas de resolver.', likes: 7, published_at: '2024-01-13', sentiment: 'negativo' },
  { author: 'Ana Oliveira', content: 'Simplesmente o melhor canal sobre esse assunto! 🔥', likes: 95, published_at: '2024-01-12', sentiment: 'positivo' },
  { author: 'Carlos Mendes', content: 'Valeu pela dica, já apliquei e funcionou perfeitamente!', likes: 33, published_at: '2024-01-11', sentiment: 'positivo' },
  { author: 'Lucas Ferreira', content: 'Achei o áudio um pouco baixo nesse vídeo.', likes: 5, published_at: '2024-01-10', sentiment: 'negativo' },
];

const Extract = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [urls, setUrls] = useState<string[]>(['']);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [aiProfile, setAiProfile] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const addUrl = () => setUrls([...urls, '']);
  const removeUrl = (i: number) => setUrls(urls.filter((_, idx) => idx !== i));
  const updateUrl = (i: number, val: string) => { const u = [...urls]; u[i] = val; setUrls(u); };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    const validUrls = urls.filter(u => u.trim());
    if (!validUrls.length || !projectName.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setLoading(true);

    // Create project
    const { data: project, error } = await supabase.from('projects').insert({
      user_id: user!.id,
      name: projectName,
      video_urls: validUrls,
      status: 'completed',
      total_comments: MOCK_COMMENTS.length,
    }).select().single();

    if (error) {
      toast({ title: 'Erro ao criar projeto', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Insert mock comments
    const commentsToInsert = MOCK_COMMENTS.map(c => ({
      project_id: project.id,
      video_url: validUrls[0],
      author: c.author,
      content: c.content,
      likes: c.likes,
      published_at: c.published_at,
      sentiment: c.sentiment,
    }));

    await supabase.from('comments').insert(commentsToInsert);

    setProjectId(project.id);
    setComments(MOCK_COMMENTS);
    setLoading(false);
    toast({ title: 'Extração concluída!', description: `${MOCK_COMMENTS.length} comentários extraídos.` });
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    // Simulate AI profile generation
    await new Promise(r => setTimeout(r, 2000));
    const profile = `## 🎯 Perfil do Avatar da Audiência

### Dados Demográficos
- **Faixa etária estimada:** 18-35 anos
- **Gênero predominante:** Misto
- **Localização:** Brasil (PT-BR)

### Comportamento
- **Engajamento:** Alto - média de 33 likes por comentário
- **Sentimento geral:** 50% positivo, 33% negativo, 17% neutro
- **Padrão de interação:** Audiência ativa que comenta e dá feedback construtivo

### Interesses Identificados
- Conteúdo educacional e informativo
- Dicas práticas e aplicáveis
- Discussões sobre métodos e abordagens

### Recomendações
1. Investir em conteúdo tutorial com passo-a-passo
2. Melhorar qualidade de áudio
3. Criar séries aprofundadas sobre temas populares
4. Engajar com comentários negativos de forma construtiva`;

    setAiProfile(profile);
    if (projectId) {
      await supabase.from('projects').update({ ai_profile: profile }).eq('id', projectId);
    }
    setAiLoading(false);
  };

  const sentimentColor = (s?: string) => {
    if (s === 'positivo') return 'text-success';
    if (s === 'negativo') return 'text-destructive';
    return 'text-muted-foreground';
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-8 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Youtube className="text-destructive" /> Extrair Comentários</h1>
          <p className="text-muted-foreground mt-1">Cole os links dos vídeos para extrair e analisar comentários</p>
        </div>

        {!comments.length ? (
          <Card className="glass p-6">
            <form onSubmit={handleExtract} className="space-y-5">
              <div className="space-y-2">
                <Label>Nome do Projeto</Label>
                <Input placeholder="Ex: Análise Canal XYZ" value={projectName} onChange={e => setProjectName(e.target.value)} required />
              </div>
              <div className="space-y-3">
                <Label>URLs dos Vídeos</Label>
                {urls.map((url, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="https://youtube.com/watch?v=..." value={url} onChange={e => updateUrl(i, e.target.value)} />
                    {urls.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeUrl(i)}><X size={16} /></Button>
                    )}
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addUrl}><Plus className="mr-1" size={14} /> Adicionar URL</Button>
              </div>
              <Button type="submit" className="w-full glow-primary" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extraindo...</> : 'Extrair Comentários'}
              </Button>
            </form>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="glass p-4 text-center">
                <p className="text-2xl font-bold font-heading text-success">{comments.filter(c => c.sentiment === 'positivo').length}</p>
                <p className="text-sm text-muted-foreground">Positivos</p>
              </Card>
              <Card className="glass p-4 text-center">
                <p className="text-2xl font-bold font-heading text-muted-foreground">{comments.filter(c => c.sentiment === 'neutro').length}</p>
                <p className="text-sm text-muted-foreground">Neutros</p>
              </Card>
              <Card className="glass p-4 text-center">
                <p className="text-2xl font-bold font-heading text-destructive">{comments.filter(c => c.sentiment === 'negativo').length}</p>
                <p className="text-sm text-muted-foreground">Negativos</p>
              </Card>
            </div>

            {/* Comments list */}
            <Card className="glass divide-y divide-border">
              {comments.map((c, i) => (
                <div key={i} className="p-4 flex gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {c.author.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{c.author}</span>
                      <span className={`text-xs font-medium ${sentimentColor(c.sentiment)}`}>{c.sentiment}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{c.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ThumbsUp size={12} /> {c.likes}</span>
                      <span>{c.published_at}</span>
                    </div>
                  </div>
                </div>
              ))}
            </Card>

            {/* AI Profile button */}
            <Card className="glass p-6">
              {!aiProfile ? (
                <div className="text-center">
                  <Sparkles className="mx-auto text-warning" size={32} />
                  <h3 className="font-heading text-lg font-bold mt-3">Gerar Perfil de Avatar com IA</h3>
                  <p className="text-sm text-muted-foreground mt-1">Análise inteligente do perfil da sua audiência</p>
                  <Button onClick={handleGenerateAI} className="mt-4 glow-primary" disabled={aiLoading}>
                    {aiLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando...</> : <><Sparkles className="mr-2 h-4 w-4" /> Gerar com IA</>}
                  </Button>
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-sm text-foreground">{aiProfile}</div>
                </div>
              )}
            </Card>

            <Button variant="outline" onClick={() => { setComments([]); setProjectId(null); setAiProfile(null); setProjectName(''); setUrls(['']); }}>
              Nova Extração
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Extract;
