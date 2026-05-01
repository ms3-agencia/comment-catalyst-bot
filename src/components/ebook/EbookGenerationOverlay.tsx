import { useEffect, useRef, useState } from 'react';
import { Loader2, BookOpen, Sparkles, CheckCircle2, FileText, Wand2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export type EbookGenStage = 'outline' | 'chapter' | 'section' | 'batch' | 'done';

interface EbookGenerationOverlayProps {
  visible: boolean;
  stage: EbookGenStage;
  /** título principal */
  title?: string;
  /** texto secundário */
  subtitle?: string;
  /** progresso real 0..100. Se ausente, usa estimativa por tempo. */
  progress?: number;
  /** duração esperada em ms — usada para cronometrar a barra até ~92% */
  estimatedMs?: number;
  /** Para batch / múltiplos capítulos */
  current?: number;
  total?: number;
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

const DEFAULT_ESTIMATED_MS: Record<EbookGenStage, number> = {
  outline: 25_000,
  chapter: 60_000,
  section: 35_000,
  batch: 60_000, // por item; total = batch * total
  done: 500,
};

export function EbookGenerationOverlay({
  visible,
  stage,
  title,
  subtitle,
  progress,
  estimatedMs,
  current,
  total,
  phases,
}: EbookGenerationOverlayProps) {
  const phaseList = phases?.length ? phases : DEFAULT_PHASES[stage];
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [estimated, setEstimated] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const stageRef = useRef(stage);

  // Reinicia ao reabrir, ao mudar de estágio (ex.: outline → chapter), ou ao avançar item do batch
  const resetKey = `${visible}:${stage}:${current ?? ''}:${total ?? ''}`;

  useEffect(() => {
    if (!visible) return;
    startedAt.current = Date.now();
    stageRef.current = stage;
    setEstimated(0);
    setPhaseIdx(0);
    setFinishing(false);

    const phaseTimer = setInterval(() => {
      setPhaseIdx(i => (i + 1) % phaseList.length);
    }, 2200);

    // Estimativa baseada em tempo: curva log-like que tende a 92%
    const expected = estimatedMs ?? DEFAULT_ESTIMATED_MS[stage] ?? 30_000;
    const tickTimer = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      // ratio 0..1 que satura em ~1 quando elapsed >> expected
      const ratio = 1 - Math.exp(-elapsed / expected);
      // mapeia 0..1 → 0..92
      const next = Math.min(92, ratio * 92);
      setEstimated(next);
    }, 150);

    return () => { clearInterval(phaseTimer); clearInterval(tickTimer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Quando stage vira 'done' OU progress chega a 100, anima até 100%
  useEffect(() => {
    const done = stage === 'done' || (typeof progress === 'number' && progress >= 100);
    if (done && visible) {
      setFinishing(true);
    }
  }, [stage, progress, visible]);

  if (!visible) return null;

  // Valor exibido: prioridade para progress externo; senão estimativa; ao concluir, 100
  let value: number;
  if (finishing) {
    value = 100;
  } else if (typeof progress === 'number') {
    value = Math.max(progress, estimated * 0.5); // deixa a barra avançar mesmo sem refresh externo
  } else {
    value = estimated;
  }

  const steps: Array<{ key: EbookGenStage | 'writing'; label: string; icon: typeof BookOpen }> = [
    { key: 'outline', label: 'Estrutura', icon: BookOpen },
    { key: 'writing', label: 'Escrita', icon: Wand2 },
    { key: 'done', label: 'Pronto', icon: CheckCircle2 },
  ];
  const stageIndex = finishing || stage === 'done' ? 2 : stage === 'outline' ? 0 : 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/85 backdrop-blur-md animate-fade-in p-4">
      <div className="relative h-24 w-24">
        <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-pulse" style={{ boxShadow: 'var(--shadow-glow)' }} />
        <div className="absolute inset-2 rounded-full border-2 border-dashed border-primary/60 animate-spin [animation-duration:6s]" />
        <div className="absolute inset-0 flex items-center justify-center">
          {finishing || stage === 'done' ? (
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
          ) : stage === 'outline' ? (
            <Sparkles className="h-9 w-9 text-primary animate-pulse" />
          ) : (
            <FileText className="h-9 w-9 text-primary" />
          )}
        </div>
      </div>

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
                  isActive && !finishing && 'border-primary bg-primary/10 text-primary',
                  (isDone || (isActive && finishing)) && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
                  !isActive && !isDone && 'border-border text-muted-foreground',
                )}
              >
                {isActive && !finishing && stage !== 'done' ? (
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
            {finishing
              ? 'Concluído!'
              : title || (stage === 'outline' ? 'Estruturando seu eBook' : 'Gerando conteúdo')}
          </h3>
          {subtitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>}
          {typeof current === 'number' && typeof total === 'number' && total > 0 && (
            <p className="text-xs text-primary mt-1 tabular-nums">{Math.min(current + (finishing ? 1 : 0), total)} de {total}</p>
          )}
        </div>

        <Progress value={value} className="h-2 transition-[--value] duration-300" />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground gap-2">
          <span className="truncate animate-fade-in" key={phaseIdx}>
            {finishing ? 'Pronto!' : phaseList[phaseIdx]}
          </span>
          <span className="tabular-nums shrink-0">{Math.round(value)}%</span>
        </div>

        <p className="text-[11px] text-muted-foreground/70 italic">
          {finishing ? 'Salvando…' : 'A IA está escrevendo com profundidade. Isso pode levar alguns instantes.'}
        </p>
      </div>
    </div>
  );
}
