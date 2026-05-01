import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Send,
  Clock,
  AlertTriangle,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';

type Status = 'loading' | 'success' | 'already' | 'expired' | 'invalid' | 'error';

type StatusConfig = {
  icon: JSX.Element;
  title: string;
  desc: string;
  hint?: string;
  tone: 'success' | 'danger' | 'warning' | 'neutral';
  ctaLabel?: string;
};

const ConfirmEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const emailFromUrl = params.get('email') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState(emailFromUrl);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('confirm-email', {
          body: { token },
        });
        if (error || !data?.success) {
          const err = (data?.error || '').toString();
          if (err === 'rate_limit_exceeded') {
            const secs = Number((data as any)?.retry_after_seconds || 0);
            setRetryAfter(secs);
            toast.error((data as any)?.message || 'Muitas tentativas. Aguarde alguns minutos.');
            setStatus('error');
            return;
          }
          if (err === 'expired_token') setStatus('expired');
          else if (err === 'invalid_token' || err === 'missing_token') setStatus('invalid');
          else setStatus('error');
          return;
        }
        // Servidor não diferencia mais "já usado" de sucesso, por segurança:
        // qualquer success=true significa que o email está confirmado agora.
        setStatus('success');
      } catch {
        setStatus('error');
      }
    })();
  }, [token]);

  const canResend = status === 'expired' || status === 'invalid' || status === 'error';

  const handleResend = async () => {
    const value = email.trim().toLowerCase();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('Informe um email válido');
      return;
    }
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-confirmation', {
        body: { email: value },
      });
      if (error) throw error;
      if ((data as any)?.error === 'rate_limit_exceeded') {
        const secs = Number((data as any)?.retry_after_seconds || 0);
        const mins = Math.ceil(secs / 60);
        setRetryAfter(secs);
        toast.error((data as any)?.message || `Muitas tentativas. Aguarde ${mins} min.`);
        return;
      }
      if ((data as any)?.alreadyConfirmed) {
        toast.success('Este email já está confirmado. Faça login normalmente.');
      } else {
        toast.success('Se este email estiver cadastrado, enviaremos um novo link de confirmação em instantes.');
      }
      setResent(true);
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível reenviar agora. Tente novamente.');
    } finally {
      setResending(false);
    }
  };

  const config: Record<Status, StatusConfig> = {
    loading: {
      icon: <Loader2 className="h-12 w-12 animate-spin text-primary" />,
      title: 'Confirmando seu email...',
      desc: 'Estamos validando seu link de confirmação. Isso leva apenas alguns instantes.',
      tone: 'neutral',
    },
    success: {
      icon: <CheckCircle2 className="h-12 w-12 text-primary" />,
      title: 'Email confirmado com sucesso! 🎉',
      desc: 'Sua conta foi ativada e está pronta para uso. Faça login para começar.',
      tone: 'success',
      ctaLabel: 'Ir para login',
    },
    already: {
      icon: <CheckCircle2 className="h-12 w-12 text-primary" />,
      title: 'Este email já foi confirmado',
      desc: 'Sua conta já estava ativa — não é preciso confirmar novamente.',
      hint: 'Se você não consegue acessar, use a opção "Esqueci minha senha" na tela de login.',
      tone: 'success',
      ctaLabel: 'Ir para login',
    },
    expired: {
      icon: <Clock className="h-12 w-12 text-amber-500" />,
      title: 'Link de confirmação expirado',
      desc: 'Por segurança, links de confirmação valem por 24 horas. Este já passou desse prazo.',
      hint: 'Sem problemas! Informe seu email abaixo e enviaremos um link novo na hora.',
      tone: 'warning',
      ctaLabel: 'Solicitar novo link',
    },
    invalid: {
      icon: <ShieldAlert className="h-12 w-12 text-destructive" />,
      title: 'Link inválido ou já utilizado',
      desc: 'Este link não pôde ser validado. Ele pode ter sido digitado errado, já ter sido usado ou ter sido invalidado.',
      hint: 'Solicite um novo link de confirmação abaixo para continuar.',
      tone: 'danger',
      ctaLabel: 'Solicitar novo link',
    },
    error: {
      icon: <AlertTriangle className="h-12 w-12 text-destructive" />,
      title: 'Não conseguimos validar agora',
      desc: 'Ocorreu um erro ao processar seu link de confirmação. Pode ser uma instabilidade temporária.',
      hint: 'Aguarde alguns instantes e tente reenviar a confirmação. Se o problema persistir, fale com o suporte.',
      tone: 'danger',
      ctaLabel: 'Reenviar confirmação',
    },
  };
  const c = config[status];

  const toneRing: Record<StatusConfig['tone'], string> = {
    success: 'ring-1 ring-primary/30 bg-primary/5',
    danger: 'ring-1 ring-destructive/30 bg-destructive/5',
    warning: 'ring-1 ring-amber-500/30 bg-amber-500/5',
    neutral: 'ring-1 ring-border bg-muted/20',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in text-center">
        <div className="mb-6 flex justify-center">
          <Mail className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full ${toneRing[c.tone]}`}>
          {c.icon}
        </div>

        <h1 className="font-heading text-2xl font-bold mb-2">{c.title}</h1>
        <p className="text-muted-foreground mb-3">{c.desc}</p>

        {c.hint && (
          <p className="text-sm text-muted-foreground/80 mb-6">{c.hint}</p>
        )}

        {retryAfter && retryAfter > 0 && status === 'error' && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            Aguarde {Math.ceil(retryAfter / 60)} min antes de tentar novamente.
          </div>
        )}

        {canResend && !resent && (
          <div className="space-y-3 text-left mb-4">
            <div className="space-y-1.5">
              <Label htmlFor="resend-email">Seu email</Label>
              <Input
                id="resend-email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={resending}
                autoComplete="email"
              />
            </div>
            <Button onClick={handleResend} disabled={resending} className="w-full">
              {resending ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
              ) : status === 'expired' ? (
                <><RefreshCw className="h-4 w-4 mr-2" /> Solicitar novo link</>
              ) : (
                <><Send className="h-4 w-4 mr-2" /> {c.ctaLabel || 'Reenviar email de confirmação'}</>
              )}
            </Button>
            <p className="text-xs text-muted-foreground/80">
              Não recebeu? Verifique a pasta de spam ou tente novamente em alguns minutos.
            </p>
          </div>
        )}

        {resent && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground/90 mb-4 text-left">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Novo link enviado!</p>
                <p className="text-muted-foreground text-xs mt-1">
                  Verifique sua caixa de entrada e a pasta de spam. O link chega em poucos instantes e expira em 24 horas.
                </p>
              </div>
            </div>
          </div>
        )}

        {status !== 'loading' && (
          <Button asChild variant={canResend ? 'outline' : 'default'} className="w-full">
            <Link to="/login">{c.ctaLabel && !canResend ? c.ctaLabel : 'Ir para login'}</Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConfirmEmail;
