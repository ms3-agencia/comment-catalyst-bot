import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { LogIn, Eye, EyeOff, MailWarning, Loader2, Send, KeyRound } from 'lucide-react';

const isEmailNotConfirmedError = (error: { message?: string; code?: string; name?: string } | null) => {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return (
    error.code === 'email_not_confirmed' ||
    msg.includes('email not confirmed') ||
    msg.includes('email não confirmado') ||
    msg.includes('confirm your email') ||
    msg.includes('not confirmed')
  );
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showUnconfirmedDialog, setShowUnconfirmedDialog] = useState(false);
  const [resending, setResending] = useState(false);
  const [showForgotDialog, setShowForgotDialog] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      if (isEmailNotConfirmedError(error)) {
        setShowUnconfirmedDialog(true);
        return;
      }
      toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
    } else {
      navigate('/dashboard');
    }
  };

  const handleResend = async () => {
    if (!email) {
      toast({ title: 'Informe o e-mail', description: 'Preencha o campo de e-mail para reenviar a confirmação.', variant: 'destructive' });
      return;
    }
    setResending(true);
    const { data, error } = await supabase.functions.invoke('resend-confirmation', {
      body: { email },
    });
    setResending(false);
    if (error) {
      toast({ title: 'Não foi possível reenviar', description: error.message, variant: 'destructive' });
      return;
    }
    if ((data as any)?.alreadyConfirmed) {
      toast({ title: 'Email já confirmado', description: 'Sua conta já está ativada. Faça login normalmente.' });
      setShowUnconfirmedDialog(false);
      return;
    }
    toast({ title: 'Link enviado', description: `Enviamos um novo link de confirmação para ${email}.` });
    setShowUnconfirmedDialog(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold gradient-text">YCaptura</h1>
          <p className="mt-2 text-muted-foreground">Entre na sua conta</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Senha</Label>
              <button
                type="button"
                onClick={() => { setForgotEmail(email); setShowForgotDialog(true); }}
                className="text-xs text-primary hover:underline"
              >
                Esqueci minha senha
              </button>
            </div>
            <div className="relative">
              <Input id="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full glow-primary" disabled={loading}>
            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <><LogIn className="mr-2 h-4 w-4" /> Entrar</>}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Não tem conta? <Link to="/register" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </div>

      <Dialog open={showUnconfirmedDialog} onOpenChange={setShowUnconfirmedDialog}>
        <DialogContent className="glass border-primary/20 sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/30 glow-primary">
              <MailWarning className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-center font-heading text-xl">
              Confirme seu e-mail para continuar
            </DialogTitle>
            <DialogDescription className="text-center">
              Sua conta ainda não foi ativada. Enviamos um link de confirmação para{' '}
              <span className="font-medium text-foreground">{email || 'seu e-mail'}</span>.
              Verifique sua caixa de entrada (e a pasta de spam) antes de entrar.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Não recebeu o e-mail?</p>
            <p>Aguarde alguns instantes ou clique em <span className="text-primary">Reenviar link</span> abaixo para receber um novo.</p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleResend} disabled={resending} className="w-full glow-primary">
              {resending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Reenviando...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Reenviar link de confirmação</>
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setShowUnconfirmedDialog(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
