import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Smartphone,
  Download,
  Share2,
  Plus,
  Check,
  ArrowLeft,
  Apple,
  Chrome,
  AlertTriangle,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

type Platform = 'ios' | 'android' | 'desktop';
type Browser =
  | 'safari'
  | 'chrome-ios'
  | 'firefox-ios'
  | 'chrome-android'
  | 'samsung'
  | 'firefox-android'
  | 'edge'
  | 'chrome-desktop'
  | 'safari-desktop'
  | 'firefox-desktop'
  | 'in-app'
  | 'other';

const detectPlatform = (ua: string): Platform => {
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
};

const detectBrowser = (ua: string, platform: Platform): Browser => {
  // In-app browsers (Instagram, Facebook, TikTok, LinkedIn) — não permitem instalar
  if (/instagram|fban|fbav|fb_iab|tiktok|linkedinapp|line\/|micromessenger/i.test(ua)) return 'in-app';

  if (platform === 'ios') {
    if (/crios/i.test(ua)) return 'chrome-ios';
    if (/fxios/i.test(ua)) return 'firefox-ios';
    if (/safari/i.test(ua)) return 'safari';
    return 'other';
  }

  if (platform === 'android') {
    if (/samsungbrowser/i.test(ua)) return 'samsung';
    if (/edga|edg\//i.test(ua)) return 'edge';
    if (/firefox/i.test(ua)) return 'firefox-android';
    if (/chrome/i.test(ua)) return 'chrome-android';
    return 'other';
  }

  if (/edg\//i.test(ua)) return 'edge';
  if (/chrome/i.test(ua)) return 'chrome-desktop';
  if (/firefox/i.test(ua)) return 'firefox-desktop';
  if (/safari/i.test(ua)) return 'safari-desktop';
  return 'other';
};

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [browser, setBrowser] = useState<Browser>('other');
  const [isStandalone, setIsStandalone] = useState(false);
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const p = detectPlatform(ua);
    setPlatform(p);
    setBrowser(detectBrowser(ua, p));
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        // @ts-ignore
        window.navigator.standalone === true,
    );
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }

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

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast.success('Link copiado! Cole no navegador correto.');
    } catch {
      toast.error('Não foi possível copiar. Copie manualmente.');
    }
  };

  // ========= Estados especiais =========
  if (isStandalone || installed) {
    return (
      <Shell>
        <Card className="p-6 text-center space-y-3 border-emerald-500/30 bg-emerald-500/5">
          <Check className="h-10 w-10 text-emerald-500 mx-auto" />
          <h3 className="font-heading font-semibold">App instalado!</h3>
          <p className="text-sm text-muted-foreground">Você já está usando o YCaptura como app.</p>
          <Button asChild>
            <Link to="/dashboard">Ir para o Dashboard</Link>
          </Button>
        </Card>
      </Shell>
    );
  }

  const showIosSafari = platform === 'ios' && browser === 'safari';
  const showIosWrongBrowser = platform === 'ios' && (browser === 'chrome-ios' || browser === 'firefox-ios' || browser === 'other');
  const showAndroidNative = platform === 'android' && deferredPrompt;
  const showAndroidManual = platform === 'android' && !deferredPrompt;
  const showInApp = browser === 'in-app';

  return (
    <Shell>
      {/* Aviso: navegador embutido (Instagram, TikTok, etc.) */}
      {showInApp && (
        <Card className="p-5 border-amber-500/40 bg-amber-500/10 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h3 className="font-heading font-semibold text-sm">Abra no navegador do celular</h3>
              <p className="text-xs text-muted-foreground">
                Você está em um navegador interno (Instagram, TikTok, Facebook…) que não permite instalar apps.
                Toque em <strong>⋯</strong> e escolha <strong>“Abrir no navegador”</strong>
                {platform === 'ios' ? ' (Safari)' : ' (Chrome)'} para continuar.
              </p>
              <Button variant="outline" size="sm" onClick={copyUrl}>
                <Copy className="mr-2 h-4 w-4" /> Copiar link
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Aviso: dentro do preview/iframe */}
      {isInIframe && !showInApp && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              A instalação só funciona na URL publicada (fora deste preview). Abra
              <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">ycaptura.ms3.com.br</code>
              direto no navegador do celular.
            </p>
          </div>
        </Card>
      )}

      {/* iOS — Safari (caminho oficial) */}
      {showIosSafari && !showInApp && (
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <Apple className="h-6 w-6 text-primary" />
            <h3 className="font-heading font-semibold">No iPhone / iPad (Safari)</h3>
          </div>
          <ol className="space-y-3 text-sm">
            <Step n={1}>
              Toque no botão <Share2 className="inline h-4 w-4" /> <strong>Compartilhar</strong> na barra inferior.
            </Step>
            <Step n={2}>
              Role e selecione <Plus className="inline h-4 w-4" /> <strong>Adicionar à Tela de Início</strong>.
            </Step>
            <Step n={3}>
              Confirme em <strong>Adicionar</strong>. Pronto!
            </Step>
          </ol>
        </Card>
      )}

      {/* iOS — outro navegador (Chrome iOS, Firefox iOS) */}
      {showIosWrongBrowser && !showInApp && (
        <Card className="p-6 space-y-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <h3 className="font-heading font-semibold">Abra no Safari para instalar</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            No iPhone, somente o <strong>Safari</strong> instala apps na tela inicial.
            Chrome e Firefox no iOS não suportam essa função (limitação da Apple).
          </p>
          <Button variant="outline" onClick={copyUrl} className="w-full">
            <Copy className="mr-2 h-4 w-4" /> Copiar link e abrir no Safari
          </Button>
        </Card>
      )}

      {/* Android — instalação nativa via prompt */}
      {showAndroidNative && (
        <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
          <div className="flex items-center gap-3">
            <Chrome className="h-6 w-6 text-primary" />
            <h3 className="font-heading font-semibold">Instalação rápida disponível</h3>
          </div>
          <p className="text-sm text-muted-foreground">Toque no botão para instalar com um clique.</p>
          <Button onClick={promptInstall} className="w-full" size="lg">
            <Download className="mr-2 h-4 w-4" /> Instalar agora
          </Button>
        </Card>
      )}

      {/* Android — fallback manual */}
      {showAndroidManual && !showInApp && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Chrome className="h-6 w-6" />
            <h3 className="font-heading font-semibold">
              {browser === 'samsung'
                ? 'No Samsung Internet'
                : browser === 'firefox-android'
                  ? 'No Firefox (Android)'
                  : 'No Android (Chrome / Edge)'}
            </h3>
          </div>
          <ol className="space-y-3 text-sm">
            <Step n={1}>Abra o menu (⋮ ou ☰) do navegador.</Step>
            <Step n={2}>
              Toque em{' '}
              <strong>
                {browser === 'samsung'
                  ? 'Adicionar página a > Tela inicial'
                  : 'Instalar app / Adicionar à tela inicial'}
              </strong>
              .
            </Step>
            <Step n={3}>Confirme em <strong>Instalar / Adicionar</strong>.</Step>
          </ol>
          <p className="text-xs text-muted-foreground border-t border-border pt-3">
            Não vê a opção? Recarregue a página, navegue por alguns segundos ou tente novamente em alguns minutos —
            o navegador precisa reconhecer o app primeiro.
          </p>
        </Card>
      )}

      {/* Desktop */}
      {platform === 'desktop' && !showInApp && (
        <>
          {deferredPrompt ? (
            <Card className="p-6 space-y-4 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3">
                <Chrome className="h-6 w-6 text-primary" />
                <h3 className="font-heading font-semibold">Instalar no computador</h3>
              </div>
              <Button onClick={promptInstall} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" /> Instalar agora
              </Button>
            </Card>
          ) : (
            <Card className="p-6 space-y-3">
              <h3 className="font-heading font-semibold">Instalar no computador</h3>
              <p className="text-sm text-muted-foreground">
                No Chrome ou Edge, clique no ícone <Download className="inline h-4 w-4" /> na barra de endereço
                ou em <strong>Menu → Instalar YCaptura</strong>. No Safari (Mac), use{' '}
                <strong>Arquivo → Adicionar ao Dock</strong>.
              </p>
            </Card>
          )}
        </>
      )}
    </Shell>
  );
};

const Step = ({ n, children }: { n: number; children: React.ReactNode }) => (
  <li className="flex items-start gap-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
      {n}
    </span>
    <span className="flex items-center gap-1 flex-wrap">{children}</span>
  </li>
);

const Shell = ({ children }: { children: React.ReactNode }) => (
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
      {children}
    </main>
  </div>
);

export default Install;
