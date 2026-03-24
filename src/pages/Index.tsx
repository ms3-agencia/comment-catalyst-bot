import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Youtube, MessageSquare, Sparkles, ArrowRight, Check } from 'lucide-react';

const features = [
  { icon: Youtube, title: 'Extração YouTube', desc: 'Cole links e extraia comentários automaticamente' },
  { icon: MessageSquare, title: 'Relatórios Detalhados', desc: 'Análise de sentimento e catalogação inteligente' },
  { icon: Sparkles, title: 'Perfil com IA', desc: 'Gere um perfil detalhado do avatar da audiência' },
];

const plans = [
  { name: 'Free', price: 'R$ 0', features: ['3 projetos', '100 comentários/projeto', 'Relatório básico'], popular: false },
  { name: 'Pro', price: 'R$ 49', features: ['25 projetos', 'Comentários ilimitados', 'Perfil IA', 'Exportação CSV'], popular: true },
  { name: 'Enterprise', price: 'R$ 149', features: ['Projetos ilimitados', 'API dedicada', 'Suporte prioritário', 'White-label'], popular: false },
];

const Index = () => (
  <div className="min-h-screen bg-background">
    {/* Nav */}
    <nav className="flex items-center justify-between px-6 lg:px-12 h-16 border-b border-border/50">
      <span className="font-heading text-xl font-bold gradient-text">CommentIQ</span>
      <div className="flex gap-3">
        <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
        <Link to="/register"><Button size="sm" className="glow-primary">Criar Conta</Button></Link>
      </div>
    </nav>

    {/* Hero */}
    <section className="px-6 lg:px-12 py-24 text-center max-w-4xl mx-auto animate-fade-in">
      <h1 className="font-heading text-4xl lg:text-6xl font-bold leading-tight">
        Extraia e analise <span className="gradient-text">comentários do YouTube</span> com IA
      </h1>
      <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
        Cole os links dos vídeos, extraia comentários, gere relatórios detalhados e descubra o perfil da sua audiência com inteligência artificial.
      </p>
      <div className="mt-8 flex gap-4 justify-center">
        <Link to="/register"><Button size="lg" className="glow-primary">Começar Grátis <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
      </div>
    </section>

    {/* Features */}
    <section className="px-6 lg:px-12 py-20 max-w-5xl mx-auto">
      <div className="grid gap-6 md:grid-cols-3">
        {features.map((f, i) => (
          <Card key={i} className="glass p-6 hover:border-primary/30 transition-colors">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
              <f.icon className="text-primary" size={24} />
            </div>
            <h3 className="font-heading font-bold text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </Card>
        ))}
      </div>
    </section>

    {/* Pricing */}
    <section className="px-6 lg:px-12 py-20 max-w-5xl mx-auto">
      <h2 className="font-heading text-3xl font-bold text-center mb-12">Planos</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((p, i) => (
          <Card key={i} className={`glass p-6 relative ${p.popular ? 'border-primary glow-primary' : ''}`}>
            {p.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">Popular</span>}
            <h3 className="font-heading text-xl font-bold">{p.name}</h3>
            <p className="text-3xl font-bold font-heading mt-2">{p.price}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
            <ul className="mt-6 space-y-3">
              {p.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-sm"><Check size={16} className="text-success" /> {f}</li>
              ))}
            </ul>
            <Link to="/register"><Button className={`w-full mt-6 ${p.popular ? 'glow-primary' : ''}`} variant={p.popular ? 'default' : 'outline'}>Começar</Button></Link>
          </Card>
        ))}
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t border-border/50 px-6 lg:px-12 py-8 text-center text-sm text-muted-foreground">
      <p>© 2026 CommentIQ. Todos os direitos reservados.</p>
    </footer>
  </div>
);

export default Index;
