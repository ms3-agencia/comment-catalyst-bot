import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasRecovery, setHasRecovery] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Supabase coloca os tokens no hash quando o usuário clica no link do e-mail.
    // O cliente os processa automaticamente e dispara PASSWORD_RECOVERY.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasRecovery(true);
        setReady(true);
      }
    });

    // Caso o usuário já tenha sessão de recovery (ou já esteja autenticado),
    // libera o formulário após o cliente terminar de processar o hash.
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setHasRecovery(true);
      }
      setReady(true);
    })();

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: 'Senha muito curta', description: 'Use pelo menos 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (password !== confirm) {
      toast({ title: 'Senhas diferentes', description: 'A confirmação não corresponde à nova senha.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast({ title: 'Erro ao redefinir', description: error.message, variant: 'destructive' });
      return;
    }

    setSuccess(true);
    toast({ title: 'Senha redefinida', description: 'Sua nova senha foi salva com sucesso.' });
    // Desloga o usuário para que ele entre com a nova senha
    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate('/login', { replace: true });
    }, 1800);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 animate-fade-in">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/30 glow-primary">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-heading text-2xl font-bold gradient-text">Redefinir senha</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Escolha uma nova senha para acessar sua conta.
          </p>
        </div>

        {!ready ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : success ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="font-medium">Senha alterada com sucesso!</p>
            <p className="mt-1 text-xs text-muted-foreground">Redirecionando para o login...</p>
          </div>
        ) : !hasRecovery ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
              Link inválido ou expirado. Solicite um novo link de redefinição na tela de login.
            </div>
            <Button asChild className="w-full glow-primary">
              <Link to="/login">Voltar ao login</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Mínimo de 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <Input
                id="confirm"
                type={showPass ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full glow-primary" disabled={loading}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                'Salvar nova senha'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Lembrou a senha?{' '}
              <Link to="/login" className="text-primary hover:underline">
                Voltar ao login
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
