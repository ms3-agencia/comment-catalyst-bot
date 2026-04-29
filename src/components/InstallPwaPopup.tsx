import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Smartphone, Download, X } from 'lucide-react';

const STORAGE_KEY = 'ycaptura_install_popup_dismissed_at';
const SHOW_AGAIN_AFTER_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

const isMobileUA = (ua: string) => /android|iphone|ipad|ipod/i.test(ua);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  // @ts-ignore
  window.navigator.standalone === true;

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export const InstallPwaPopup = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isInIframe()) return; // não mostrar no preview/iframe
    if (isStandalone()) return; // já está instalado
    if (!isMobileUA(window.navigator.userAgent)) return;

    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt && Date.now() - Number(dismissedAt) < SHOW_AGAIN_AFTER_MS) return;

    const t = setTimeout(() => setOpen(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  const goInstall = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
    navigate('/install');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? dismiss() : setOpen(v))}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader className="items-center text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
            <Smartphone className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="font-heading text-xl">Instale o YCaptura no seu celular</DialogTitle>
          <DialogDescription className="text-sm">
            Acesso rápido na tela inicial, em tela cheia e com cara de app nativo. Sem precisar baixar da loja.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={goInstall} size="lg" className="w-full">
            <Download className="mr-2 h-4 w-4" /> Instalar agora
          </Button>
          <Button onClick={dismiss} variant="ghost" size="sm" className="w-full">
            <X className="mr-2 h-4 w-4" /> Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InstallPwaPopup;
