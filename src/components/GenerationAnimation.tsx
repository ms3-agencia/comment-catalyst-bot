import { Sparkles, FileText, Image as ImageIcon, Video, User, Wand2, Stars, Brain } from "lucide-react";

type Variant = "avatar" | "content" | "image" | "video";

interface Props {
  variant: Variant;
  title?: string;
  subtitle?: string;
  className?: string;
}

const PRESETS: Record<Variant, { icon: any; orbiters: any[]; accent: string; title: string; subtitle: string }> = {
  avatar: {
    icon: User,
    orbiters: [Brain, Sparkles, Stars, Wand2],
    accent: "primary",
    title: "Gerando perfil de avatar",
    subtitle: "Analisando comentários e construindo o perfil ideal da audiência…",
  },
  content: {
    icon: FileText,
    orbiters: [Sparkles, Wand2, Stars, FileText],
    accent: "primary",
    title: "Gerando conteúdo",
    subtitle: "A IA está escrevendo um conteúdo original para sua rede social…",
  },
  image: {
    icon: ImageIcon,
    orbiters: [Sparkles, Wand2, Stars, ImageIcon],
    accent: "warning",
    title: "Gerando imagem",
    subtitle: "Compondo pixels, luz e cor para criar sua imagem…",
  },
  video: {
    icon: Video,
    orbiters: [Sparkles, Stars, Wand2, Video],
    accent: "destructive",
    title: "Gerando vídeo",
    subtitle: "Renderizando cenas e movimento — isso pode levar alguns instantes…",
  },
};

/**
 * Animação reutilizável usada durante operações de geração com IA.
 * Usa apenas tokens semânticos (HSL) do design system.
 */
export const GenerationAnimation = ({ variant, title, subtitle, className = "" }: Props) => {
  const preset = PRESETS[variant];
  const Icon = preset.icon;
  const accent = preset.accent; // primary | warning | destructive

  // Mapas de classes (Tailwind precisa de strings completas para fazer purge corretamente)
  const accentText: Record<string, string> = {
    primary: "text-primary",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  const accentBg: Record<string, string> = {
    primary: "bg-primary/10 border-primary/30",
    warning: "bg-warning/10 border-warning/30",
    destructive: "bg-destructive/10 border-destructive/30",
  };
  const accentRing: Record<string, string> = {
    primary: "border-primary/30",
    warning: "border-warning/30",
    destructive: "border-destructive/30",
  };
  const accentRingDim: Record<string, string> = {
    primary: "border-primary/15",
    warning: "border-warning/15",
    destructive: "border-destructive/15",
  };
  const accentBlur: Record<string, string> = {
    primary: "bg-primary/10",
    warning: "bg-warning/10",
    destructive: "bg-destructive/10",
  };

  return (
    <div className={`relative flex flex-col items-center justify-center py-10 px-6 overflow-hidden ${className}`}>
      {/* Halo de fundo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`h-56 w-56 rounded-full ${accentBlur[accent]} blur-3xl animate-pulse`} />
      </div>

      {/* Núcleo com órbitas */}
      <div className="relative h-40 w-40 flex items-center justify-center">
        <div className={`absolute inset-0 rounded-full border ${accentRing[accent]} animate-[spin_6s_linear_infinite]`} />
        <div className={`absolute inset-3 rounded-full border ${accentRingDim[accent]} animate-[spin_4s_linear_infinite_reverse]`} />
        <div className={`absolute inset-6 rounded-full border ${accentRingDim[accent]} animate-[spin_8s_linear_infinite]`} />

        {/* Ícones orbitando */}
        <div className="absolute inset-0 animate-[spin_5s_linear_infinite]">
          {preset.orbiters.map((O, i) => {
            const positions = [
              "absolute -top-2 left-1/2 -translate-x-1/2",
              "absolute top-1/2 -right-2 -translate-y-1/2",
              "absolute -bottom-2 left-1/2 -translate-x-1/2",
              "absolute top-1/2 -left-2 -translate-y-1/2",
            ];
            return (
              <O
                key={i}
                size={18}
                className={`${positions[i]} ${accentText[accent]} drop-shadow-[0_0_8px_hsl(var(--${accent})/0.6)]`}
              />
            );
          })}
        </div>

        {/* Ícone central */}
        <div className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl border backdrop-blur-sm animate-pulse ${accentBg[accent]}`}>
          <Icon className={accentText[accent]} size={40} />
        </div>
      </div>

      {/* Texto + barra indeterminada */}
      <div className="mt-7 text-center space-y-2 relative z-10">
        <h3 className="font-heading text-lg font-bold animate-fade-in">
          {title || preset.title}
          <span className="inline-block animate-pulse">.</span>
          <span className="inline-block animate-pulse [animation-delay:200ms]">.</span>
          <span className="inline-block animate-pulse [animation-delay:400ms]">.</span>
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          {subtitle || preset.subtitle}
        </p>

        <div className="mx-auto mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-muted">
          <div className={`h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-current to-transparent ${accentText[accent]} animate-[slide-in-right_1.4s_ease-in-out_infinite]`} />
        </div>
      </div>
    </div>
  );
};

export default GenerationAnimation;
