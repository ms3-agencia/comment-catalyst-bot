import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Youtube, MessageSquare, Sparkles, ArrowRight, Check, Zap, Crown, ShieldCheck,
  Coins, Loader2, ShoppingCart, Flame, TrendingUp, Clock, Star, Users, Brain, HelpCircle,
  Wand2, Image as ImageIcon, Film, Mic, Music2, Type, Layers, FolderOpen, BarChart3,
  Palette, Settings, Lock,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { TestimonialsCarousel } from '@/components/TestimonialsCarousel';
import { useBranding } from '@/hooks/useBranding';
import { InstallPwaPopup } from '@/components/InstallPwaPopup';

type Pkg = { id: string; name: string; credits: number; price_brl: number; sort_order: number; features: string[] | null };
type Plan = { plan: 'free' | 'pro' | 'enterprise'; display_name: string; monthly_credits: number; price_brl: number; description: string | null; features: string[] | null };

// === Top 3 highlight features (hero section) ===
const features = [
  { icon: Youtube, title: 'Extração em segundos', desc: 'Cole os links e nós trazemos centenas de comentários para você analisar.' },
  { icon: Brain, title: 'Perfil de avatar com IA', desc: 'Descubra dores, desejos e linguagem da sua audiência sem fazer pesquisa.' },
  { icon: Film, title: 'Editor de vídeo com IA', desc: 'Transforme o conteúdo gerado em vídeos prontos para Reels, Shorts e TikTok.' },
];

// === Full feature catalog (everything the platform does today) ===
const allFeatures: { icon: any; title: string; desc: string; tag: string }[] = [
  { tag: 'Análise', icon: Youtube, title: 'Extração de comentários do YouTube', desc: 'Cole até dezenas de links e importamos comentários, autores, curtidas e datas em segundos.' },
  { tag: 'Análise', icon: Brain, title: 'Perfil de avatar com IA', desc: 'A IA lê os comentários e gera o perfil completo: dores, desejos, objeções e linguagem real da audiência.' },
  { tag: 'Análise', icon: BarChart3, title: 'Análise de sentimento', desc: 'Veja a proporção de comentários positivos, neutros e negativos para guiar o tom do conteúdo.' },
  { tag: 'Conteúdo', icon: Wand2, title: 'Geração de conteúdo por IA', desc: 'Roteiros, legendas, hashtags e CTAs sob medida para Instagram, TikTok, YouTube e LinkedIn.' },
  { tag: 'Conteúdo', icon: ImageIcon, title: 'Geração de imagens', desc: 'Crie capas e visuais únicos com IA — uma imagem por cena, prontas para a timeline do vídeo.' },
  { tag: 'Vídeo', icon: Film, title: 'Editor de vídeo no navegador', desc: 'Monte cenas com texto, imagens, efeitos de zoom/pan e exporte em WebM ou MP4 sem instalar nada.' },
  { tag: 'Vídeo', icon: Layers, title: 'Transições drag & drop', desc: 'Fade, slide, zoom, wipe e mais — arraste para o quadro entre cenas e veja o efeito no preview.' },
  { tag: 'Vídeo', icon: Mic, title: 'Narração automática (TTS)', desc: 'Escolha a voz uma vez e ela vale para o vídeo todo. Ducking automático com a trilha sonora.' },
  { tag: 'Vídeo', icon: Music2, title: 'Trilha sonora e biblioteca', desc: 'Música de fundo por cena ou global, com fade in/out e volume independente da narração.' },
  { tag: 'Vídeo', icon: Type, title: 'Legendas e tipografia', desc: 'Posição, cor, fundo, fonte e tamanho. Defina uma vez e propague para todas as cenas.' },
  { tag: 'Vídeo', icon: Sparkles, title: 'Estilos visuais prontos', desc: 'Presets criados pela equipe que aplicam efeitos, fontes e cores coerentes em um clique.' },
  { tag: 'Workspace', icon: FolderOpen, title: 'Meus projetos e rascunhos', desc: 'Tudo fica salvo: vídeos extraídos, conteúdos gerados e edições em andamento com versões.' },
  { tag: 'Workspace', icon: Coins, title: 'Créditos & histórico', desc: 'Saldo em tempo real, próximo reset mensal e histórico completo de consumo e compras.' },
  { tag: 'Workspace', icon: Palette, title: 'Marca personalizada', desc: 'Logo, nome e textos do site editáveis pelo painel admin — ideal para uso white-label.' },
  { tag: 'Workspace', icon: Settings, title: 'Painel administrativo', desc: 'Gerencie usuários, planos, pacotes, provedores de IA e custos das ações em um só lugar.' },
  { tag: 'Workspace', icon: Lock, title: 'Segurança e privacidade', desc: 'Autenticação por e-mail/senha, papéis de acesso e dados protegidos por políticas server-side.' },
];

const featureTags = ['Todos', 'Análise', 'Conteúdo', 'Vídeo', 'Workspace'] as const;

// === Persuasive "how each feature makes you money" blocks ===
const moneyFeatures: {
  icon: any;
  badge: string;
  title: string;
  problem: string;
  solution: string;
  money: string;
  bullets: string[];
}[] = [
  {
    icon: Brain,
    badge: '🧠 Inteligência de audiência',
    title: 'Descubra o que sua audiência implora para comprar',
    problem: 'Você gasta horas criando produtos e conteúdos no escuro, torcendo para acertar — e a maioria não vende.',
    solution: 'A IA lê centenas de comentários reais do YouTube e entrega o avatar completo: dores, desejos, objeções e até as palavras exatas que seu público usa.',
    money: 'Com o avatar na mão, você cria ofertas que vendem sozinhas porque falam a língua de quem compra. Menos achismo, mais conversão.',
    bullets: ['Pare de adivinhar o que vender', 'Crie ofertas irresistíveis baseadas em dados reais', 'Antecipe objeções antes da venda'],
  },
  {
    icon: BarChart3,
    badge: '📊 Análise de sentimento',
    title: 'Saiba exatamente o tom que faz seu público comprar',
    problem: 'Um único conteúdo no tom errado afasta clientes e queima a sua autoridade.',
    solution: 'Veja na hora a proporção de comentários positivos, neutros e negativos e entenda o clima emocional da sua audiência.',
    money: 'Ajuste a comunicação para o tom que gera conexão e confiança — e confiança é o que faz o cartão sair do bolso.',
    bullets: ['Identifique gatilhos emocionais que convertem', 'Evite conteúdos que afastam compradores', 'Construa autoridade com a mensagem certa'],
  },
  {
    icon: Wand2,
    badge: '✍️ Geração de conteúdo',
    title: 'Roteiros e legendas que vendem, prontos em segundos',
    problem: 'Ficar travado na frente da tela em branco custa tempo — e tempo parado é dinheiro que você deixa na mesa.',
    solution: 'A IA gera roteiros, legendas, hashtags e CTAs sob medida para Instagram, TikTok, YouTube e LinkedIn, já alinhados ao avatar da sua audiência.',
    money: 'Produza em minutos o que levaria dias. Poste mais, alcance mais e venda mais — escalando seu faturamento sem contratar uma equipe.',
    bullets: ['Conteúdo diário sem bloqueio criativo', 'CTAs persuasivos que convertem seguidor em cliente', 'Escale sua produção sem aumentar custos'],
  },
  {
    icon: Film,
    badge: '🎬 Editor de vídeo com IA',
    title: 'Transforme ideias em vídeos prontos para viralizar',
    problem: 'Contratar editor é caro e demorado, e softwares profissionais têm curva de aprendizado gigante.',
    solution: 'Monte cenas com texto, imagens, narração automática, trilha sonora e transições direto no navegador — e exporte para Reels, Shorts e TikTok.',
    money: 'Vídeo é o formato que mais vende hoje. Produza conteúdo profissional todos os dias e multiplique seu alcance — mais visualizações, mais clientes, mais vendas.',
    bullets: ['Economize milhares em edição terceirizada', 'Publique em todas as redes sem sair da plataforma', 'Aproveite o formato que mais converte: vídeo'],
  },
  {
    icon: ImageIcon,
    badge: '🎨 Imagens com IA',
    title: 'Capas e visuais que param o dedo do seu cliente',
    problem: 'Uma capa fraca faz o conteúdo perfeito ser ignorado no feed.',
    solution: 'Gere capas e visuais únicos com IA, uma imagem por cena, prontos para a timeline do seu vídeo.',
    money: 'Capas que chamam atenção aumentam cliques e retenção — e mais gente assistindo significa mais gente comprando.',
    bullets: ['Aumente a taxa de cliques (CTR)', 'Tenha identidade visual profissional', 'Nunca dependa de banco de imagens genérico'],
  },
  {
    icon: FolderOpen,
    badge: '🚀 Workspace completo',
    title: 'Sua máquina de conteúdo organizada num só lugar',
    problem: 'Trabalho espalhado em mil ferramentas faz você perder tempo, arquivos e oportunidades.',
    solution: 'Projetos, rascunhos com versões, créditos em tempo real, marca personalizada e painel admin — tudo centralizado e seguro.',
    money: 'Mais organização = mais entregas no prazo. E quem entrega rápido e com consistência cobra mais e fideliza clientes.',
    bullets: ['Trabalhe como agência, sozinho', 'Use white-label e revenda para clientes', 'Nunca mais perca um projeto ou ideia'],
  },
];

const socialProof = [
  { icon: Users, label: '+2.500', desc: 'criadores ativos' },
  { icon: MessageSquare, label: '+1,2 mi', desc: 'comentários processados' },
  { icon: Star, label: '4.9/5', desc: 'satisfação' },
];

const planIcon = (p: string) => p === 'enterprise' ? Crown : p === 'pro' ? Zap : Sparkles;

const Index = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { branding } = useBranding('landing');
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<typeof featureTags[number]>('Todos');
  const visibleFeatures = activeTag === 'Todos' ? allFeatures : allFeatures.filter(f => f.tag === activeTag);

  useEffect(() => {
    (async () => {
      const fetchData = () => Promise.all([
        supabase.from('credit_packages').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('plan_configs').select('*').order('price_brl'),
      ]);
      const [pkgRes, planRes] = await fetchData();
      setPackages((pkgRes.data as Pkg[]) || []);
      setPlans((planRes.data as Plan[]) || []);
      setLoading(false);
    })();
  }, []);

  const buyPackage = async (pkg: Pkg) => {
    if (!user) {
      navigate(`/register?next=/dashboard/credits`);
      return;
    }
    setBuying(pkg.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-mp-preference', { body: { package_id: pkg.id } });
      if (error) throw error;
      if (data?.init_point) window.location.href = data.init_point;
      else throw new Error(data?.error || 'Resposta inválida');
    } catch (err: any) {
      toast({ title: 'Erro ao iniciar pagamento', description: err.message, variant: 'destructive' });
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <InstallPwaPopup />
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border/50 sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          {branding.logo_url && (
            <img src={branding.logo_url} alt={branding.site_name} className="h-8 w-8 object-contain rounded" />
          )}
          <span className="font-heading text-xl font-bold gradient-text truncate">{branding.site_name}</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="#recursos" className="hidden md:inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">Recursos</a>
          <a href="#planos" className="hidden md:inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">Planos</a>
          <a href="#pacotes" className="hidden md:inline-block text-sm text-muted-foreground hover:text-foreground transition-colors">Pacotes</a>
          {user ? (
            <Link to="/dashboard"><Button size="sm" className="glow-primary">Ir para o painel</Button></Link>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
              <Link to="/register"><Button size="sm" className="glow-primary">Criar conta grátis</Button></Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 lg:px-12 py-20 lg:py-28 text-center max-w-4xl mx-auto animate-fade-in">
        <Badge variant="outline" className="mb-6 border-primary/40 text-primary">
          <Flame size={12} className="mr-1" /> Oferta de lançamento — 50% mais créditos
        </Badge>
        <h1 className="font-heading text-4xl lg:text-6xl font-bold leading-tight">
          Transforme comentários do YouTube no <span className="gradient-text">avatar perfeito</span> da sua audiência
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Pare de adivinhar o que sua audiência quer. Extraia comentários, gere perfis com IA e descubra exatamente o que vender, escrever e postar — em minutos.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/register">
            <Button size="lg" className="glow-primary w-full sm:w-auto">
              Começar grátis agora <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#pacotes">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <ShoppingCart className="mr-2 h-4 w-4" /> Ver pacotes
            </Button>
          </a>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">✓ Sem cartão de crédito  ✓ Créditos grátis no cadastro  ✓ Cancele quando quiser</p>

        {/* Social proof */}
        <div className="mt-12 grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {socialProof.map((s, i) => (
            <div key={i} className="text-center">
              <s.icon className="mx-auto text-primary mb-1" size={20} />
              <p className="font-heading text-xl lg:text-2xl font-bold">{s.label}</p>
              <p className="text-xs text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 lg:px-12 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">Tudo que você precisa para <span className="gradient-text">conhecer sua audiência</span></h2>
          <p className="mt-3 text-muted-foreground">Três passos simples. Resultados que mudam o jogo.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f, i) => (
            <Card key={i} className="glass p-6 hover:border-primary/40 transition-all hover:scale-[1.02]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <f.icon className="text-primary" size={24} />
              </div>
              <h3 className="font-heading font-bold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Recursos completos */}
      <section id="recursos" className="px-6 lg:px-12 py-16 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
            <Sparkles size={12} className="mr-1" /> Recursos completos
          </Badge>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">
            Tudo o que você ganha ao <span className="gradient-text">entrar agora</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Da extração ao vídeo final pronto para postar — todas as ferramentas em uma só plataforma.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {featureTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                activeTag === tag
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFeatures.map((f, i) => (
            <Card key={i} className="glass p-5 hover:border-primary/40 transition-all">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="text-primary" size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-semibold text-sm">{f.title}</h3>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-border/60 text-muted-foreground">
                      {f.tag}
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Como cada recurso vira dinheiro */}
      <section id="ganhar-dinheiro" className="px-6 lg:px-12 py-16 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-14">
          <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
            <Coins size={12} className="mr-1" /> Do recurso ao faturamento
          </Badge>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">
            Como cada recurso te ajuda a <span className="gradient-text">ganhar dinheiro</span>
          </h2>
          <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
            Não vendemos botões e funcionalidades. Vendemos atalhos para você vender mais, gastar menos e crescer mais rápido. Veja na prática:
          </p>
        </div>

        <div className="space-y-10 lg:space-y-16">
          {moneyFeatures.map((f, i) => (
            <div
              key={i}
              className={`flex flex-col lg:flex-row items-stretch gap-6 lg:gap-10 ${i % 2 === 1 ? 'lg:flex-row-reverse' : ''}`}
            >
              {/* Visual side */}
              <div className="lg:w-2/5 flex">
                <Card className="glass w-full p-8 flex flex-col justify-center items-center text-center border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 mb-5">
                    <f.icon className="text-primary" size={40} />
                  </div>
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs">{f.badge}</Badge>
                  <h3 className="font-heading text-xl font-bold mt-4 leading-snug">{f.title}</h3>
                </Card>
              </div>

              {/* Copy side */}
              <div className="lg:w-3/5 flex flex-col justify-center space-y-4">
                <div className="flex gap-3">
                  <span className="text-destructive font-bold text-sm mt-0.5">✗</span>
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">O problema:</strong> {f.problem}</p>
                </div>
                <div className="flex gap-3">
                  <Check size={18} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground"><strong className="text-foreground">A solução:</strong> {f.solution}</p>
                </div>
                <div className="flex gap-3 rounded-xl bg-success/10 border border-success/20 p-4">
                  <Coins size={18} className="text-success shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground"><strong>Como vira dinheiro:</strong> {f.money}</p>
                </div>
                <ul className="grid sm:grid-cols-2 gap-2 pt-1">
                  {f.bullets.map((b, j) => (
                    <li key={j} className="flex gap-2 text-xs text-muted-foreground">
                      <Check size={14} className="text-primary shrink-0 mt-0.5" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-14">
          <Link to="/register">
            <Button size="lg" className="glow-primary">
              Quero faturar mais com IA <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">✓ Comece grátis hoje · ✓ Sem cartão de crédito</p>
        </div>
      </section>

      {/* Depoimentos */}
      <section className="px-6 lg:px-12 py-16 max-w-6xl mx-auto">

        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 border-primary/40 text-primary">
            <Star size={12} className="mr-1 fill-primary" /> Histórias reais
          </Badge>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">
            Quem já usa, <span className="gradient-text">vende mais</span>
          </h2>
          <p className="mt-3 text-muted-foreground">Resultados de criadores e infoprodutores que pararam de adivinhar.</p>
        </div>
        <TestimonialsCarousel />
      </section>

      {/* Planos */}
      <section id="planos" className="px-6 lg:px-12 py-16 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-12">
          <Badge variant="outline" className="mb-3 border-primary/40 text-primary"><ShieldCheck size={12} className="mr-1" /> Planos mensais</Badge>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">Escolha o plano e <span className="gradient-text">comece a vender mais</span></h2>
          <p className="mt-3 text-muted-foreground">Créditos renovam todo mês. Cancele quando quiser, sem multa.</p>
        </div>
        {loading ? (
          <Card className="glass p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map(p => {
              const Icon = planIcon(p.plan);
              const popular = p.plan === 'pro';
              return (
                <Card key={p.plan} className={`relative p-6 transition-all hover:scale-[1.02] ${popular ? 'border-primary glow-primary md:scale-105' : 'glass'}`}>
                  {popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary"><TrendingUp size={12} className="mr-1" /> Mais escolhido</Badge>}
                  <div className="flex items-center gap-2">
                    <Icon className="text-primary" size={22} />
                    <h3 className="font-heading text-xl font-bold">{p.display_name}</h3>
                  </div>
                  <p className="mt-3 font-heading text-4xl font-bold">
                    {p.price_brl > 0
                      ? <>R$ {Number(p.price_brl).toFixed(2).replace('.', ',')}<span className="text-sm font-normal text-muted-foreground">/mês</span></>
                      : 'Grátis'}
                  </p>
                  {p.description && <p className="text-sm text-muted-foreground mt-1">{p.description}</p>}
                  <ul className="mt-5 space-y-2 text-sm">
                    <li className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" /> <strong>{p.monthly_credits.toLocaleString('pt-BR')}</strong> créditos por mês</li>
                    {(p.features && p.features.length > 0
                      ? p.features
                      : ['Extração de comentários do YouTube', 'Perfil de avatar com IA', 'Relatórios e análise de sentimento']
                    ).map((feat, i) => (
                      <li key={i} className="flex gap-2"><Check size={16} className="text-success shrink-0 mt-0.5" /> {feat}</li>
                    ))}
                  </ul>
                  <Link to="/register">
                    <Button className={`w-full mt-6 ${popular ? 'glow-primary' : ''}`} variant={popular ? 'default' : 'outline'}>
                      {p.plan === 'free' ? 'Criar conta grátis' : 'Assinar agora'} <ArrowRight className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Pacotes */}
      <section id="pacotes" className="px-6 lg:px-12 py-16 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 border-primary/40 text-primary"><Coins size={12} className="mr-1" /> Recargas avulsas</Badge>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">Precisa de <span className="gradient-text">mais créditos agora</span>?</h2>
          <p className="mt-3 text-muted-foreground">Compre uma vez, use quando quiser. Créditos não expiram enquanto sua conta estiver ativa.</p>
          <p className="mt-2 text-sm text-primary flex items-center justify-center gap-1">
            <Clock size={14} /> Pagamento processado na hora via Mercado Pago
          </p>
        </div>
        {loading ? (
          <Card className="glass p-12 flex justify-center"><Loader2 className="animate-spin text-primary" /></Card>
        ) : packages.length === 0 ? (
          <Card className="glass p-8 text-center text-muted-foreground">Pacotes em breve.</Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {packages.map((pkg, idx) => {
              const featured = idx === 1;
              const pricePerCredit = pkg.price_brl / pkg.credits;
              const cheapest = packages.reduce((min, p) => (p.price_brl / p.credits) < (min.price_brl / min.credits) ? p : min, packages[0]);
              const isCheapest = pkg.id === cheapest.id;
              return (
                <Card key={pkg.id} className={`p-6 relative transition-all hover:scale-[1.02] ${featured ? 'border-primary glow-primary' : 'glass'}`}>
                  {featured && <Badge className="absolute -top-3 right-4 bg-primary"><Flame size={12} className="mr-1" /> Mais vendido</Badge>}
                  {isCheapest && !featured && <Badge variant="outline" className="absolute -top-3 right-4 border-success text-success">Melhor custo</Badge>}
                  <h3 className="font-heading text-lg font-bold">{pkg.name}</h3>
                  <p className="font-heading text-4xl font-bold mt-2 gradient-text">{pkg.credits.toLocaleString('pt-BR')}</p>
                  <p className="text-xs text-muted-foreground">créditos</p>
                  <div className="mt-4 pt-4 border-t border-border">
                    <p className="font-heading text-2xl font-bold">R$ {Number(pkg.price_brl).toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-muted-foreground">≈ R$ {pricePerCredit.toFixed(3).replace('.', ',')} por crédito</p>
                  </div>
                  {pkg.features && pkg.features.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-sm">
                      {pkg.features.map((feat, i) => (
                        <li key={i} className="flex gap-2"><Check size={14} className="text-success shrink-0 mt-1" /> <span className="text-muted-foreground">{feat}</span></li>
                      ))}
                    </ul>
                  )}
                  <Button
                    className={`w-full mt-5 ${featured ? 'glow-primary' : ''}`}
                    variant={featured ? 'default' : 'outline'}
                    onClick={() => buyPackage(pkg)}
                    disabled={buying === pkg.id}
                  >
                    {buying === pkg.id
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                      : <><ShoppingCart className="mr-2 h-4 w-4" /> {user ? 'Comprar agora' : 'Criar conta e comprar'}</>}
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground mt-6">
          🔒 Pagamento 100% seguro via Mercado Pago · Pix, cartão ou boleto
        </p>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-12 py-16 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-3 border-primary/40 text-primary"><HelpCircle size={12} className="mr-1" /> Perguntas frequentes</Badge>
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">Tire suas <span className="gradient-text">dúvidas</span></h2>
          <p className="mt-3 text-muted-foreground">Tudo que você precisa saber sobre pacotes, créditos e cobrança.</p>
        </div>
        <Card className="glass p-2 md:p-6">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="q1">
              <AccordionTrigger className="text-left">Como funcionam os créditos?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Cada ação na plataforma — extrair comentários de um vídeo, gerar perfil de avatar com IA, rodar análise de sentimento — consome uma quantidade específica de créditos. Você acompanha seu saldo em tempo real no painel e recebe alertas quando estiver acabando.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger className="text-left">Qual a diferença entre planos mensais e pacotes avulsos?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Os <strong>planos mensais</strong> renovam seus créditos automaticamente todo mês e têm o melhor custo-benefício para quem usa com frequência. Os <strong>pacotes avulsos</strong> são compras únicas, ideais para quem precisa de um reforço pontual ou ainda está testando. Você pode combinar os dois.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q3">
              <AccordionTrigger className="text-left">Os créditos expiram?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Créditos de <strong>pacotes avulsos</strong> não expiram enquanto sua conta estiver ativa. Já os créditos do <strong>plano mensal</strong> são renovados a cada ciclo — o saldo do mês anterior não acumula, então use sem medo.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q4">
              <AccordionTrigger className="text-left">Posso cancelar meu plano a qualquer momento?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim. Você cancela direto no painel, sem multa, sem burocracia e sem precisar falar com ninguém. Após o cancelamento, você continua usando até o fim do ciclo já pago.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q5">
              <AccordionTrigger className="text-left">Quais formas de pagamento são aceitas?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Todo o pagamento é processado com segurança pelo <strong>Mercado Pago</strong>. Aceitamos Pix (aprovação na hora), cartão de crédito (parcelamento disponível) e boleto bancário.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q6">
              <AccordionTrigger className="text-left">Quando os créditos caem na minha conta após o pagamento?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Pagamentos via Pix e cartão são creditados <strong>automaticamente em segundos</strong> após a confirmação. Boletos podem levar até 2 dias úteis para compensar.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q7">
              <AccordionTrigger className="text-left">Recebo nota fiscal?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Sim. Toda compra gera comprovante via Mercado Pago. Para nota fiscal eletrônica, basta solicitar pelo suporte informando seus dados de faturamento.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q8">
              <AccordionTrigger className="text-left">Existe garantia ou reembolso?</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                Você pode testar a plataforma <strong>gratuitamente</strong> com os créditos do cadastro antes de comprar. Por se tratar de serviço digital de uso imediato, créditos já consumidos não são reembolsáveis — mas nossa equipe está pronta para resolver qualquer problema.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      </section>

      {/* CTA Final */}
      <section className="px-6 lg:px-12 py-20 max-w-4xl mx-auto text-center">
        <Card className="glass p-10 lg:p-14 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
          <Sparkles className="mx-auto text-primary mb-4" size={32} />
          <h2 className="font-heading text-3xl lg:text-4xl font-bold">Cada dia sem {branding.site_name} é um <span className="gradient-text">insight perdido</span></h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Seus concorrentes já estão usando IA para entender a audiência. Comece grátis hoje e descubra o que está deixando passar.
          </p>
          <Link to="/register">
            <Button size="lg" className="glow-primary mt-6">
              Quero começar agora <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <p className="mt-3 text-xs text-muted-foreground">Sem cartão · Créditos grátis no cadastro</p>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 px-6 lg:px-12 py-8 text-center text-sm text-muted-foreground">
        <p>{branding.footer_text || '© 2026 YCaptura. Todos os direitos reservados.'}</p>
      </footer>
    </div>
  );
};

export default Index;
