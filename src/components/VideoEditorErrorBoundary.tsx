import { Component, ReactNode } from 'react';
import { AlertTriangle, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  children: ReactNode;
  onClose: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * ErrorBoundary específico para o Editor de Vídeo.
 * Antes, qualquer erro durante a renderização derrubava o conteúdo do overlay
 * e o usuário via apenas uma "tela preta" (o backdrop bg-background/95).
 * Agora mostramos uma mensagem clara, com botões de Recarregar / Fechar.
 */
export class VideoEditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Log para diagnóstico no console do navegador
    console.error('[VideoEditor] crash:', error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="max-w-md w-full rounded-lg border border-destructive/40 bg-card p-6 space-y-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-destructive/15 p-2 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-base">Não foi possível abrir o Editor de Vídeo</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ocorreu um erro inesperado ao montar o editor. Tente novamente — se persistir,
                recarregue a página.
              </p>
              {this.state.error?.message && (
                <p className="text-xs text-muted-foreground/80 mt-2 font-mono break-all">
                  {this.state.error.message}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={this.props.onClose}>
              <X className="h-3.5 w-3.5 mr-1" /> Fechar
            </Button>
            <Button
              size="sm"
              onClick={() => {
                this.reset();
                window.location.reload();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Recarregar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
