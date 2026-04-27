import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CopyIconButtonProps {
  value: string;
  label?: string;
  className?: string;
  size?: number;
}

export const CopyIconButton = ({ value, label = 'Copiar', className, size = 14 }: CopyIconButtonProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast({ title: `${label} copiado!` });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: 'Falha ao copiar', variant: 'destructive' });
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar ${label.toLowerCase()}`}
      aria-label={`Copiar ${label.toLowerCase()}`}
      className={cn(
        'inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors',
        className
      )}
    >
      {copied ? <Check size={size} className="text-success" /> : <Copy size={size} />}
    </button>
  );
};
