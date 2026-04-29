import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, Share2, Plus, Check, ArrowLeft, Apple, Chrome } from 'lucide-react';

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      // @ts-ignore
      window.navigator.standalone === true
    );

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto max-w-3xl px-4 h-14 flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground p-2 -ml-2">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-heading font-bold text-lg">Instalar YCaptura</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Smartphone className="h-10 w-10 text-primary" />
          </div>
          <h2 className="font-heading text-2xl font-bold">Tenha o YCaptura na tela inicial</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Acesso rápido, tela cheia e visual de app nativo. Sem precisar baixar da loja.
          </p>
        </div>

        {isStandalone || installed ? (
          <Card className="p-6 text-center space-y-3 border-emerald-500/30 bg-emerald-500/5">
            <Check className="h-10 w-10 text-emerald-500 mx-auto" />
            <h3 className="font-heading font-semibold">App instalado!</h3>
            <p className="text-sm text-muted-foreground">Você já está usando o YCaptura como app.</p>
            <Button asChild><Link to="/dashboard">Ir para o Dashboard</Link></Button>
          </Card>
        ) : (
          <>
            {deferredPrompt && (
              <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-3">
                  <Chrome className="h-6 w-6 text-primary" />
                  <h3 className="font-heading font-semibold">Instalação rápida disponível</h3>
                </div>
                <p className="text-sm text-muted-foreground">Toque no botão abaixo para instalar com um clique.</p>
                <Button onClick={promptInstall} className="w-full" size="lg">
                  <Download className="mr-2 h-4 w-4" /> Instalar agora
                </Button>
              </Card>
            )}

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Apple className="h-6 w-6" />
                <h3 className="font-heading font-semibold">No iPhone / iPad (Safari)</h3>
              </div>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                  <span>Abra este site no <strong>Safari</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                  <span className="flex items-center gap-1 flex-wrap">
                    Toque no botão <Share2 className="inline h-4 w-4" /> <strong>Compartilhar</strong> na barra inferior.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                  <span className="flex items-center gap-1 flex-wrap">
                    Selecione <Plus className="inline h-4 w-4" /> <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                  <span>Confirme em <strong>Adicionar</strong>. Pronto!</span>
                </li>
              </ol>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Chrome className="h-6 w-6" />
                <h3 className="font-heading font-semibold">No Android (Chrome / Edge)</h3>
              </div>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                  <span>Abra o menu (⋮) no canto superior direito.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                  <span>Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                  <span>Confirme em <strong>Instalar</strong>.</span>
                </li>
              </ol>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default Install;
