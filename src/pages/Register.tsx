import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Eye, EyeOff, Mail } from 'lucide-react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateToken = () => {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast({ title: 'Senha muito curta', description: 'Use no mínimo 6 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: 'As senhas não coincidem', description: 'Confirme sua senha corretamente.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (error) {
      setLoading(false);
      toast({ title: 'Erro ao criar conta', description: error.message, variant: 'destructive' });
      return;
    }

    const newUserId = data.user?.id;
    if (newUserId) {
      // Gera token de confirmação e envia email via SMTP da plataforma
      const token = generateToken();
      const confirmationUrl = `${window.location.origin}/auth/confirm?token=${token}`;

      const { error: tokenErr } = await supabase
        .from('email_confirmation_tokens')
        .insert({ user_id: newUserId, email, token });

      if (!tokenErr) {
        await supabase.functions.invoke('send-system-email', {
          body: {
            templateKey: 'email_confirmation',
            userId: newUserId,
            recipientEmail: email,
            variables: {
              user_name: fullName,
              site_name: 'YCaptura',
              confirmation_url: confirmationUrl,
            },
          },
        }).catch((err) => console.warn('confirmation email failed', err));
      } else {
        console.warn('token insert failed', tokenErr);
      }
    }

    setLoading(false);
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
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
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
