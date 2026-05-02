import { Youtube, MessageCircle, ThumbsUp, Sparkles } from "lucide-react";

/**
 * Animação exibida enquanto os comentários do YouTube estão sendo extraídos.
 * Usa apenas tokens semânticos do design system + keyframes do tailwind.config.
 */
export const ExtractionAnimation = () => {
  return (
    <div className="relative flex flex-col items-center justify-center py-12 px-6 overflow-hidden">
      {/* Halo pulsante de fundo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-56 w-56 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      </div>

      {/* Núcleo: ícone do YouTube com órbita */}
      <div className="relative h-40 w-40 flex items-center justify-center">
        {/* Anéis orbitando */}
        <div className="absolute inset-0 rounded-full border border-primary/30 animate-[spin_6s_linear_infinite]" />
        <div className="absolute inset-3 rounded-full border border-primary/20 animate-[spin_4s_linear_infinite_reverse]" />
        <div className="absolute inset-6 rounded-full border border-primary/10 animate-[spin_8s_linear_infinite]" />

        {/* Ícones flutuando na órbita externa */}
        <div className="absolute inset-0 animate-[spin_5s_linear_infinite]">
          <MessageCircle
            className="absolute -top-2 left-1/2 -translate-x-1/2 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
            size={20}
          />
          <ThumbsUp
            className="absolute top-1/2 -right-2 -translate-y-1/2 text-success drop-shadow-[0_0_8px_hsl(var(--success)/0.6)]"
            size={20}
          />
          <Sparkles
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-warning drop-shadow-[0_0_8px_hsl(var(--warning)/0.6)]"
            size={20}
          />
          <MessageCircle
            className="absolute top-1/2 -left-2 -translate-y-1/2 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
            size={20}
          />
        </div>

        {/* YouTube central com pulse */}
        <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/30 backdrop-blur-sm animate-pulse">
          <Youtube className="text-destructive" size={40} />
        </div>
      </div>

      {/* Texto + barra */}
      <div className="mt-8 text-center space-y-3 relative z-10">
        <h3 className="font-heading text-lg font-bold animate-fade-in">
          Extraindo comentários
          <span className="inline-block animate-pulse">.</span>
          <span className="inline-block animate-pulse [animation-delay:200ms]">.</span>
          <span className="inline-block animate-pulse [animation-delay:400ms]">.</span>
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Conectando ao YouTube, lendo comentários e preparando os dados para análise.
        </p>

        {/* Barra de progresso indeterminada */}
        <div className="mx-auto mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent animate-[slide-in-right_1.4s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
};

export default ExtractionAnimation;
