import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
import { loginSchema, forgotSchema } from '@/lib/security';
import { reportSecurityEvent, checkLoginLockout } from '@/lib/securityEvents';
import { TurnstileWidget } from '@/components/TurnstileWidget';
import { supabase as sb } from '@/integrations/supabase/client';

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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [forgotCaptchaToken, setForgotCaptchaToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Validação client-side
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast({ title: 'Dados inválidos', description: first?.message || 'Verifique os campos.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    // 2. CAPTCHA Turnstile (se configurado)
    const captchaCheck = await sb.functions.invoke('verify-turnstile', { body: { token: captchaToken || '' } });
    if (captchaCheck.error || !(captchaCheck.data as any)?.success) {
      setLoading(false);
      toast({
        title: 'Verificação de segurança falhou',
        description: 'Por favor, complete o CAPTCHA antes de continuar.',
        variant: 'destructive',
      });
      return;
    }

    // 3. Lockout (anti brute-force)
    const lock = await checkLoginLockout(parsed.data.email);
    if (lock.locked) {
      setLoading(false);
      toast({
        title: 'Conta temporariamente bloqueada',
        description: lock.message || 'Excesso de tentativas. Tente novamente em alguns minutos.',
        variant: 'destructive',
      });
      return;
    }

    // 3. Tentar login
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setLoading(false);

    if (error) {
      // Registra falha (alimenta lockout) — fire-and-forget
      reportSecurityEvent('login_failure', { email: parsed.data.email });

      if (isEmailNotConfirmedError(error)) {
        setShowUnconfirmedDialog(true);
        return;
      }
      toast({
        title: 'Erro ao entrar',
        description: 'E-mail ou senha incorretos.',
        variant: 'destructive',
      });
      return;
    }

    // 4. Sucesso → registra evento (e dispara alerta se for novo dispositivo)
    reportSecurityEvent('login_success', { email: parsed.data.email });
    navigate('/dashboard');
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

  const handleForgot = async () => {
    const parsed = forgotSchema.safeParse({ email: forgotEmail });
    if (!parsed.success) {
      toast({ title: 'E-mail inválido', description: parsed.error.errors[0]?.message || 'Digite um e-mail válido.', variant: 'destructive' });
      return;
    }
    setSendingReset(true);

    // CAPTCHA Turnstile (se configurado)
    const captchaCheck = await sb.functions.invoke('verify-turnstile', { body: { token: forgotCaptchaToken || '' } });
    if (captchaCheck.error || !(captchaCheck.data as any)?.success) {
      setSendingReset(false);
      toast({ title: 'Verificação de segurança falhou', description: 'Complete o CAPTCHA antes de continuar.', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast({ title: 'Não foi possível enviar', description: error.message, variant: 'destructive' });
      return;
    }
    reportSecurityEvent('password_reset_requested', { email: parsed.data.email });
    toast({ title: 'Link enviado', description: `Se o e-mail existir, enviaremos um link de redefinição para ${parsed.data.email}.` });
    setShowForgotDialog(false);
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
          <TurnstileWidget onToken={setCaptchaToken} />
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

      <Dialog open={showForgotDialog} onOpenChange={setShowForgotDialog}>
        <DialogContent className="glass border-primary/20 sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/30 glow-primary">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-center font-heading text-xl">
              Recuperar acesso à conta
            </DialogTitle>
            <DialogDescription className="text-center">
              Informe o e-mail cadastrado e enviaremos um link para você criar uma nova senha.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="forgot-email">E-mail</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="seu@email.com"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              autoFocus
            />
          </div>

          {showForgotDialog && <TurnstileWidget onToken={setForgotCaptchaToken} />}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={handleForgot} disabled={sendingReset} className="w-full glow-primary">
              {sendingReset ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando link...</>
              ) : (
                <><Send className="mr-2 h-4 w-4" /> Enviar link de redefinição</>
              )}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setShowForgotDialog(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
