import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';

type Status = 'loading' | 'success' | 'already' | 'expired' | 'invalid' | 'error';

const ConfirmEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('confirm-email', {
          body: { token },
        });
        if (error || !data?.success) {
          const err = (data?.error || '').toString();
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

  const config: Record<Status, { icon: JSX.Element; title: string; desc: string }> = {
    loading: { icon: <Loader2 className="h-12 w-12 animate-spin text-primary" />, title: 'Confirmando seu email...', desc: 'Aguarde um instante.' },
    success: { icon: <CheckCircle2 className="h-12 w-12 text-primary" />, title: 'Email confirmado!', desc: 'Sua conta foi ativada. Você já pode fazer login.' },
    already: { icon: <CheckCircle2 className="h-12 w-12 text-primary" />, title: 'Email já confirmado', desc: 'Esta conta já estava ativa. Faça login normalmente.' },
    expired: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: 'Link expirado', desc: 'Este link de confirmação expirou. Crie a conta novamente para receber um novo email.' },
    invalid: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: 'Link inválido', desc: 'Não foi possível validar este link de confirmação.' },
    error: { icon: <XCircle className="h-12 w-12 text-destructive" />, title: 'Erro ao confirmar', desc: 'Ocorreu um erro. Tente novamente em instantes.' },
  };
  const c = config[status];

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in text-center">
        <div className="mb-6 flex justify-center"><Mail className="h-8 w-8 text-muted-foreground" /></div>
        <div className="mb-4 flex justify-center">{c.icon}</div>
        <h1 className="font-heading text-2xl font-bold mb-2">{c.title}</h1>
        <p className="text-muted-foreground mb-6">{c.desc}</p>
        {status !== 'loading' && (
          <Button asChild className="w-full"><Link to="/login">Ir para login</Link></Button>
        )}
      </div>
    </div>
  );
};

export default ConfirmEmail;
