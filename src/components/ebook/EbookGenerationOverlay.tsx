import { useEffect, useRef, useState } from 'react';
import { Loader2, BookOpen, Sparkles, CheckCircle2, FileText, Wand2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type EbookGenStage = 'outline' | 'chapter' | 'section' | 'batch' | 'done';

interface EbookGenerationOverlayProps {
  visible: boolean;
  stage: EbookGenStage;
  /** título principal exibido (ex.: "Gerando Capítulo 3") */
  title?: string;
  /** texto secundário (ex.: nome do capítulo) */
  subtitle?: string;
  /** progresso real 0..100 (opcional). Se ausente, anima de forma indeterminada. */
  progress?: number;
  /** Para batch / múltiplos capítulos */
  current?: number;
  total?: number;
  /** Frase de fase, fica rodando entre várias para dar sensação viva */
  phases?: string[];
}

const DEFAULT_PHASES: Record<EbookGenStage, string[]> = {
  outline: [
    'Analisando o tema…',
    'Estruturando capítulos…',
    'Definindo arco narrativo…',
    'Refinando títulos…',
  ],
  chapter: [
    'Pesquisando ideias-chave…',
    'Escrevendo introdução do capítulo…',
    'Aprofundando conceitos…',
    'Adicionando exemplos e analogias…',
    'Revisando coesão…',
  ],
  section: [
    'Compondo a seção…',
    'Ajustando tom de voz…',
    'Refinando o texto final…',
  ],
  batch: [
    'Trabalhando em lote…',
    'Gerando próximo capítulo…',
    'Conectando capítulos…',
  ],
  done: ['Concluído!'],
};

export function EbookGenerationOverlay({
  visible,
  stage,
  title,
  subtitle,
  progress,
  current,
  total,
  phases,
}: EbookGenerationOverlayProps) {
  const phaseList = phases?.length ? phases : DEFAULT_PHASES[stage];
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [pseudo, setPseudo] = useState(0);
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!visible) return;
    startedAt.current = Date.now();
    setPseudo(0);
    setPhaseIdx(0);
    const phaseTimer = setInterval(() => {
      setPhaseIdx(i => (i + 1) % phaseList.length);
    }, 2200);
    // animação pseudo-progresso quando não há valor real (curva que tende a 92%)
    const tickTimer = setInterval(() => {
      setPseudo(p => {
        if (typeof progress === 'number') return p;
        const target = 92;
        return p + Math.max(0.4, (target - p) * 0.025);
      });
    }, 200);
    return () => { clearInterval(phaseTimer); clearInterval(tickTimer); };
  }, [visible, phaseList.length, progress]);

  if (!visible) return null;

  const value = typeof progress === 'number' ? progress : pseudo;

  const steps: Array<{ key: EbookGenStage | 'writing'; label: string; icon: typeof BookOpen }> = [
    { key: 'outline', label: 'Estrutura', icon: BookOpen },
    { key: 'writing', label: 'Escrita', icon: Wand2 },
    { key: 'done', label: 'Pronto', icon: CheckCircle2 },
  ];
  const stageIndex = stage === 'outline' ? 0 : stage === 'done' ? 2 : 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md animate-fade-in p-4">
      {/* Halo animado */}
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" style={{ boxShadow: 'var(--shadow-glow)' }} />
        <div className="absolute inset-2 rounded-full border-2 border-dashed border-primary/60 animate-spin [animation-duration:6s]" />
        <div className="absolute inset-0 flex items-center justify-center">
          {stage === 'done' ? (
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          ) : stage === 'outline' ? (
            <Sparkles className="h-9 w-9 text-primary animate-pulse" />
          ) : (
            <FileText className="h-9 w-9 text-primary" />
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
                  'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  isActive && 'border-primary bg-primary/10 text-primary',
                  isDone && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
                  !isActive && !isDone && 'border-border text-muted-foreground',
                )}
              >
                {isActive && stage !== 'done' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
                <span>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn('h-px w-5', isDone ? 'bg-emerald-500/40' : 'bg-border')} />
              )}
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-md space-y-3 text-center">
        <div>
          <h3 className="font-heading text-lg font-bold gradient-text">
            {title || (stage === 'outline' ? 'Estruturando seu eBook' : stage === 'done' ? 'Concluído!' : 'Gerando conteúdo')}
          </h3>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>}
          {typeof current === 'number' && typeof total === 'number' && total > 0 && (
            <p className="text-xs text-primary mt-1 tabular-nums">{current} de {total}</p>
          )}
        </div>

        <Progress value={value} className="h-2" />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
          <span className="truncate animate-fade-in" key={phaseIdx}>
            {phaseList[phaseIdx]}
          </span>
          <span className="tabular-nums shrink-0">{Math.round(value)}%</span>
        </div>

        <p className="text-[11px] text-muted-foreground/70 italic">
          A IA está escrevendo com profundidade. Isso pode levar alguns instantes.
        </p>
      </div>
    </div>
  );
}
