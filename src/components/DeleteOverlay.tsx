import { Trash2, Loader2, CheckCircle2, FileX } from 'lucide-react';
import { useEffect, useState } from 'react';

interface DeleteOverlayProps {
  open: boolean;
  count?: number;
  label?: string;
  done?: boolean;
}

/**
 * Full-screen overlay shown while items are being deleted.
 * Uses semantic design tokens — dark glass background, animated trash icon,
 * file icons "flying" into the bin, then a success state before unmount.
 */
export const DeleteOverlay = ({ open, count = 1, label = 'conteúdo(s)', done = false }: DeleteOverlayProps) => {
  const [show, setShow] = useState(open);

  useEffect(() => {
    if (open) setShow(true);
    else {
      const t = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!show) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-background/85 backdrop-blur-md transition-opacity duration-300 ${
        open ? 'opacity-100' : 'opacity-0'
      }`}
      role="alertdialog"
      aria-busy={!done}
      aria-label="Excluindo conteúdos"
    >
      <div className="relative flex flex-col items-center gap-6 rounded-2xl border border-border bg-card/80 px-10 py-8 shadow-2xl shadow-primary/10 animate-scale-in">
        <div className="relative h-28 w-28 flex items-center justify-center">
          {/* Pulsing ring */}
          <span className="absolute inset-0 rounded-full border-2 border-destructive/30 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-destructive/10" />

          {/* Flying files (hidden when done) */}
          {!done && (
            <>
              <FileX
                className="absolute h-5 w-5 text-primary"
                style={{
                  animation: 'delete-fly 1.2s ease-in infinite',
                  top: '-4px',
                  left: '6px',
                }}
              />
              <FileX
                className="absolute h-5 w-5 text-primary/80"
                style={{
                  animation: 'delete-fly 1.2s ease-in infinite',
                  animationDelay: '0.4s',
                  top: '-4px',
                  right: '6px',
                }}
              />
              <FileX
                className="absolute h-5 w-5 text-primary/60"
                style={{
                  animation: 'delete-fly 1.2s ease-in infinite',
                  animationDelay: '0.8s',
                  top: '-4px',
                  left: '50%',
                  marginLeft: '-10px',
                }}
              />
            </>
          )}

          {/* Center icon */}
          {done ? (
            <CheckCircle2 className="relative h-14 w-14 text-green-500 animate-scale-in" />
          ) : (
            <Trash2 className="relative h-14 w-14 text-destructive animate-pulse" />
          )}
        </div>

        <div className="text-center space-y-1">
          <h3 className="font-heading text-lg font-semibold text-foreground">
            {done ? 'Concluído!' : 'Excluindo arquivos'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {done
              ? `${count} ${label} removido(s) com sucesso`
              : `Removendo ${count} ${label}, aguarde...`}
          </p>
        </div>

        {!done && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            <span>Processando exclusão segura</span>
          </div>
        )}
      </div>
    </div>
  );
};
