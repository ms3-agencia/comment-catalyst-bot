import { Loader2, Image as ImageIcon, Film, Sparkles, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

type Stage = 'images' | 'render' | 'done';

interface RenderOverlayProps {
  visible: boolean;
  stage: Stage;
  /** 0..100 */
  progress: number;
  phase?: string;
  eta?: string;
  /** When in 'images' stage */
  imagesCurrent?: number;
  imagesTotal?: number;
}

/**
 * Visual overlay shown over the preview canvas while we (1) generate scene
 * images and then (2) render the video. Two-step pipeline visualization.
 */
export function RenderOverlay({
  visible,
  stage,
  progress,
  phase,
  eta,
  imagesCurrent = 0,
  imagesTotal = 0,
}: RenderOverlayProps) {
  if (!visible) return null;

  const steps: Array<{ key: Stage; label: string; icon: typeof ImageIcon }> = [
    { key: 'images', label: 'Imagens', icon: ImageIcon },
    { key: 'render', label: 'Render', icon: Film },
    { key: 'done', label: 'Pronto', icon: CheckCircle2 },
  ];

  const stageIndex = steps.findIndex(s => s.key === stage);

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-background/85 backdrop-blur-sm animate-fade-in p-4">
      {/* Animated film reel / sparkles */}
      <div className="relative h-20 w-20">
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse-glow" />
        <div className="absolute inset-2 rounded-full border-2 border-dashed border-primary/60 animate-spin [animation-duration:6s]" />
        <div className="absolute inset-0 flex items-center justify-center">
          {stage === 'images' ? (
            <Sparkles className="h-7 w-7 text-primary animate-pulse" />
          ) : stage === 'done' ? (
            <CheckCircle2 className="h-8 w-8 text-success" />
          ) : (
            <Film className="h-7 w-7 text-primary" />
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === stageIndex;
          const isDone = i < stageIndex;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                  isActive && 'border-primary bg-primary/10 text-primary',
                  isDone && 'border-success/40 bg-success/10 text-success',
                  !isActive && !isDone && 'border-border text-muted-foreground',
                )}
              >
                {isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('h-px w-4', isDone ? 'bg-success/40' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase + progress */}
      <div className="w-full max-w-sm space-y-2 text-center">
        <p className="text-sm font-medium">
          {stage === 'images'
            ? `Criando imagens das cenas${imagesTotal ? ` (${imagesCurrent}/${imagesTotal})` : '…'}`
            : stage === 'done'
            ? 'Vídeo concluído!'
            : phase || 'Renderizando vídeo…'}
        </p>
        <Progress value={progress} />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="truncate">{phase || ''}</span>
          <span className="tabular-nums">
            {eta || `${Math.round(progress)}%`}
          </span>
        </div>
        {stage === 'images' && (
          <p className="text-[11px] text-muted-foreground">
            Em seguida o vídeo será renderizado automaticamente.
          </p>
        )}
      </div>
    </div>
  );
}
