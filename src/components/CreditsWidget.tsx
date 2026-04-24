import { Link } from 'react-router-dom';
import { Coins, Plus } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { Progress } from '@/components/ui/progress';

export const CreditsWidget = () => {
  const { profile } = useAuth();
  const { credits, loading } = useCredits();

  const balance = credits?.balance ?? 0;
  const allocation = credits?.monthly_allocation ?? 0;
  const pct = allocation > 0 ? Math.min(100, Math.max(0, (balance / allocation) * 100)) : 0;
  const low = balance <= Math.max(5, Math.floor(allocation * 0.1));

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-primary/10 to-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary shrink-0">
            <Coins size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Créditos</p>
            <p className="text-sm font-bold truncate" title={profile?.full_name || 'Usuário'}>
              {profile?.full_name?.split(' ')[0] || 'Usuário'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className={`font-heading text-2xl font-bold ${low ? 'text-destructive' : 'text-foreground'}`}>
            {loading ? '—' : balance.toLocaleString('pt-BR')}
          </span>
          <span className="text-[11px] text-muted-foreground">/ {allocation.toLocaleString('pt-BR')} mês</span>
        </div>
        <Progress value={pct} className="h-1.5" />
      </div>

      <Link
        to="/dashboard/credits"
        className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
          low
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        <Plus size={14} /> Comprar mais créditos
      </Link>
    </div>
  );
};
