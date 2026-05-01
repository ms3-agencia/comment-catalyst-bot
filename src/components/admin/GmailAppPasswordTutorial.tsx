import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  HelpCircle,
  ShieldCheck,
  KeyRound,
  Mail,
  ExternalLink,
  Copy,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  trigger?: React.ReactNode;
}

const Step = ({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="flex gap-3">
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-bold">
      {n}
    </div>
    <div className="flex-1 space-y-2 pb-1">
      <h4 className="font-semibold text-sm">{title}</h4>
      <div className="text-sm text-muted-foreground space-y-2">{children}</div>
    </div>
  </div>
);

export const GmailAppPasswordTutorial = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado` });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5">
            <HelpCircle size={14} />
            Como gerar a senha de app do Gmail?
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="text-primary" size={20} />
            Como gerar a Senha de App do Gmail
          </DialogTitle>
          <DialogDescription>
            Guia passo a passo para criar uma senha exclusiva de 16 caracteres
            que o Gmail usa para autenticar aplicativos externos (como o envio
            de emails deste sistema).
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-warning/40 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            <b>Importante:</b> a senha normal da sua conta Google{' '}
            <b>não funciona</b> para SMTP. Você precisa de uma{' '}
            <b>Senha de App</b> de 16 caracteres, gerada apenas uma vez e
            específica para este sistema.
          </AlertDescription>
        </Alert>

        <div className="space-y-5 mt-2">
          <Step n={1} title="Ative a Verificação em 2 etapas (pré-requisito)">
            <p>
              Senhas de app só ficam disponíveis quando a sua conta Google tem a
              verificação em 2 etapas ativa. Se ainda não tem, ative agora:
            </p>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              asChild
            >
              <a
                href="https://myaccount.google.com/signinoptions/two-step-verification"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ShieldCheck size={14} />
                Abrir Verificação em 2 etapas
                <ExternalLink size={12} />
              </a>
            </Button>
          </Step>

          <Step n={2} title="Acesse a página de Senhas de App">
            <p>Faça login na conta Google que enviará os emails e abra:</p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" className="gap-1.5" asChild>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Lock size={14} />
                  myaccount.google.com/apppasswords
                  <ExternalLink size={12} />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8"
                onClick={() =>
                  copy(
                    'https://myaccount.google.com/apppasswords',
                    'Link'
                  )
                }
              >
                <Copy size={12} /> Copiar link
              </Button>
            </div>
            <p className="text-xs">
              Caso apareça "Esta configuração não está disponível", revise o
              passo 1 (verificação em 2 etapas) ou confirme que sua conta não é
              gerenciada por uma organização (Workspace) que bloqueia o
              recurso.
            </p>
          </Step>

          <Step n={3} title="Crie uma nova senha de app">
            <ul className="list-disc list-inside space-y-1">
              <li>
                No campo <b>Nome do aplicativo</b>, digite algo como{' '}
                <code className="text-primary">YCaptura SMTP</code> (apenas para
                você identificar depois).
              </li>
              <li>
                Clique em <b>Criar</b>.
              </li>
            </ul>
          </Step>

          <Step n={4} title="Copie a senha gerada (16 caracteres)">
            <p>
              O Google mostrará uma senha em <b>4 grupos de 4 letras</b>{' '}
              separados por espaços, por exemplo:
            </p>
            <Card className="bg-muted/40 p-3 font-mono text-sm tracking-widest text-center select-all">
              abcd efgh ijkl mnop
            </Card>
            <p className="text-xs">
              Copie a senha imediatamente — ela só é exibida uma vez. Os
              espaços podem ser mantidos ou removidos ao colar; o Gmail aceita
              ambos os formatos.
            </p>
          </Step>

          <Step n={5} title="Cole a senha aqui no painel SMTP">
            <p>
              Volte para a aba <b>Servidor SMTP</b> e preencha exatamente
              assim:
            </p>
            <Card className="bg-muted/40 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Host:</span>
                <code className="font-mono">smtp.gmail.com</code>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Porta:</span>
                <code className="font-mono">587</code>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Criptografia:</span>
                <code className="font-mono">tls</code>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Usuário:</span>
                <code className="font-mono">seuemail@gmail.com</code>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Senha:</span>
                <code className="font-mono">a senha de app de 16 letras</code>
              </div>
            </Card>
            <p className="text-xs">
              Clique em <b>Salvar SMTP</b> e use o botão{' '}
              <b>Enviar email de teste</b> para confirmar.
            </p>
          </Step>

          <Step n={6} title="Pronto! 🎉">
            <p className="flex items-start gap-1.5">
              <CheckCircle2
                size={16}
                className="text-success shrink-0 mt-0.5"
              />
              <span>
                A partir de agora, o sistema poderá enviar emails de boas-vindas,
                avisos de pagamento, recuperação de senha e demais notificações
                pela sua conta Gmail. Você pode revogar essa senha a qualquer
                momento na mesma página de Senhas de App.
              </span>
            </p>
          </Step>
        </div>

        <Alert className="mt-2 border-primary/30 bg-primary/5">
          <Mail className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs space-y-1">
            <p>
              <b>Limites do Gmail gratuito:</b> ~500 emails/dia. Para volumes
              maiores, considere Google Workspace (2.000/dia) ou um serviço
              dedicado de SMTP transacional.
            </p>
          </AlertDescription>
        </Alert>

        <DialogFooter className="gap-2 mt-2">
          <Badge variant="outline" className="mr-auto">
            <ShieldCheck size={12} className="mr-1" /> Conexão segura via TLS
          </Badge>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button asChild className="glow-primary">
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
            >
              <KeyRound size={14} className="mr-1.5" />
              Gerar senha agora
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GmailAppPasswordTutorial;
