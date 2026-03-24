import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Save, Loader2, User } from 'lucide-react';

const UserSettings = () => {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('user_id', profile!.user_id);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Perfil atualizado!' });
    }
    setLoading(false);
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg space-y-6 animate-fade-in">
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><User size={24} /> Configurações</h1>
        <Card className="glass p-6">
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={profile?.email || ''} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Plano atual</Label>
              <Input value={(profile?.plan || 'free').toUpperCase()} disabled className="opacity-60" />
            </div>
            <Button type="submit" className="glow-primary" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salvar
            </Button>
          </form>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default UserSettings;
