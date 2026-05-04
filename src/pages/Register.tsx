import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Eye, EyeOff, Mail } from 'lucide-react';
import { registerSchema } from '@/lib/security';
import { TurnstileWidget } from '@/components/TurnstileWidget';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();



  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsed = registerSchema.safeParse({
      full_name: fullName,
      email,
      password,
    });
    if (!parsed.success) {
      const first = parsed.error.errors[0];
      toast({ title: 'Dados inválidos', description: first?.message || 'Verifique os campos.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', description: 'Confirme sua senha corretamente.', variant: 'destructive' });
      return;
    }

    setLoading(true);

    // CAPTCHA Turnstile (se configurado)
    const captchaCheck = await supabase.functions.invoke('verify-turnstile', { body: { token: captchaToken || '' } });
    if (captchaCheck.error || !(captchaCheck.data as any)?.success) {
      setLoading(false);
      toast({ title: 'Verificação de segurança falhou', description: 'Complete o CAPTCHA antes de continuar.', variant: 'destructive' });
      return;
    }

    const { data, error } = await supabase.functions.invoke('register-user', {
      body: { email, password, fullName },
    });
    setLoading(false);

    if (error || !(data as any)?.success) {
      const errCode = (data as any)?.error;
      let msg = (data as any)?.message || error?.message || 'Tente novamente.';
      if (errCode === 'email_already_registered') {
        msg = 'Este email já está cadastrado. Tente fazer login.';
      } else if (errCode === 'weak_password') {
        msg = 'A senha deve ter pelo menos 6 caracteres.';
      }
      toast({ title: 'Erro ao criar conta', description: msg, variant: 'destructive' });
      return;
    }

    setPendingEmail(email);
  };

  if (pendingEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in text-center">
          <div className="mb-4 flex justify-center">
            <Mail className="h-12 w-12 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-2">Confirme seu email</h1>
          <p className="text-muted-foreground mb-6">
            Enviamos um link de confirmação para <strong className="text-foreground">{pendingEmail}</strong>.
            Acesse seu email e clique no link para ativar sua conta.
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Não recebeu? Verifique a caixa de spam. O link expira em 24 horas.
          </p>
          <Button asChild className="w-full"><Link to="/login">Ir para login</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in">
        <div className="mb-8 text-center">
          <h1 className="font-heading text-3xl font-bold gradient-text">YCaptura</h1>
          <p className="mt-2 text-muted-foreground">Crie sua conta</p>
        </div>
        <form onSubmit={handleRegister} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input id="name" placeholder="Seu nome" value={fullName} onChange={e => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mín. 8 caracteres (com maiúscula, minúscula e número)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar senha</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>
          <TurnstileWidget onToken={setCaptchaToken} />
          <Button type="submit" className="w-full glow-primary" disabled={loading}>
            {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" /> : <><UserPlus className="mr-2 h-4 w-4" /> Criar conta</>}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
