import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Mail, Send } from 'lucide-react';

type Status = 'loading' | 'success' | 'already' | 'expired' | 'invalid' | 'error';

const ConfirmEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const emailFromUrl = params.get('email') || '';
  const [status, setStatus] = useState<Status>('loading');
  const [email, setEmail] = useState(emailFromUrl);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

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
            toast.error((data as any)?.message || 'Muitas tentativas. Aguarde alguns minutos.');
            setStatus('error');
            return;
          }
          if (err === 'expired_token') setStatus('expired');
          else if (err === 'invalid_token' || err === 'missing_token') setStatus('invalid');
          else setStatus('error');
          return;
        }
        setStatus(data.alreadyUsed ? 'already' : 'success');
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

  const config: Record<Status, { icon: JSX.Element; title: string; desc: string }> = {
    loading: { icon: <Loader2 className="h-12 w-12 animate-spin text-primary" />, title: 'Confirmando seu email...', desc: 'Aguarde um instante.' },
    success: { icon: <CheckCircle2 className="h-12 w-12 text-primary" />, title: 'Email confirmado!', desc: 'Sua conta foi ativada. Você já pode fazer login.' },
    already: { icon: <CheckCircle2 className="h-12 w-12 text-primary" />, title: 'Email já confirmado', desc: 'Esta conta já estava ativa. Faça login normalmente.' },
    expired: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: 'Link expirado', desc: 'Este link de confirmação expirou. Você pode solicitar um novo agora mesmo.' },
    invalid: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: 'Link inválido', desc: 'Não foi possível validar este link. Solicite um novo email de confirmação abaixo.' },
    error: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: 'Erro ao confirmar', desc: 'Ocorreu um erro ao validar o link. Você pode tentar reenviar a confirmação.' },
  };
  const c = config[status];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in text-center">
        <div className="mb-6 flex justify-center"><Mail className="h-8 w-8 text-muted-foreground" /></div>
        <div className="mb-4 flex justify-center">{c.icon}</div>
        <h1 className="font-heading text-2xl font-bold mb-2">{c.title}</h1>
        <p className="text-muted-foreground mb-6">{c.desc}</p>

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
              ) : (
                <><Send className="h-4 w-4 mr-2" /> Reenviar email de confirmação</>
              )}
            </Button>
          </div>
        )}

        {resent && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground/90 mb-4">
            Verifique sua caixa de entrada (e a pasta de spam) — o novo link chega em alguns instantes.
          </div>
        )}

        {status !== 'loading' && (
          <Button asChild variant={canResend ? 'outline' : 'default'} className="w-full">
            <Link to="/login">Ir para login</Link>
          </Button>
        )}
      </div>
    </div>
  );
};

export default ConfirmEmail;
