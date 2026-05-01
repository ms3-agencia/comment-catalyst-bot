import { Component, ReactNode } from 'react';

type State = { hasError: boolean; error: Error | null };

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[AppErrorBoundary]', error, info);
  }

  handleReload = () => {
    try {
      // Limpa tokens potencialmente corrompidos antes de recarregar
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) localStorage.removeItem(k);
      });
    } catch { /* storage bloqueado */ }
    window.location.replace('/login');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="glass w-full max-w-md rounded-2xl p-8 text-center animate-fade-in">
          <h1 className="font-heading text-2xl font-bold gradient-text">Algo deu errado</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Encontramos um problema ao carregar o app neste navegador. Isso pode acontecer em
            modo privado/anônimo ou em navegadores embutidos (Instagram, Facebook, TikTok).
          </p>
          {this.state.error?.message && (
            <p className="mt-3 rounded-md border border-border/60 bg-muted/30 p-2 text-[11px] text-muted-foreground break-words">
              {this.state.error.message}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={this.handleReload}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition"
            >
              Recarregar e fazer login novamente
            </button>
            <p className="text-xs text-muted-foreground">
              Dica: abra <span className="text-primary">ycaptura.ms3.com.br</span> diretamente no Chrome ou Safari (não no navegador interno do app).
            </p>
          </div>
        </div>
      </div>
    );
  }
}
