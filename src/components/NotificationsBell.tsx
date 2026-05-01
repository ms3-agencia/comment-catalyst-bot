import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const fetchItems = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    setItems((data || []) as Notification[]);
  };

  useEffect(() => {
    if (!user) return;
    fetchItems();
    const channel = supabase
      .channel('notifications-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_notifications', filter: `user_id=eq.${user.id}` }, () => fetchItems())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const unread = items.filter(n => !n.read).length;

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('system_notifications').update({ read: true, read_at: new Date().toISOString() }).eq('user_id', user.id).eq('read', false);
    fetchItems();
  };

  const markRead = async (id: string) => {
    await supabase.from('system_notifications').update({ read: true, read_at: new Date().toISOString() }).eq('id', id);
    fetchItems();
  };

  const removeOne = async (id: string) => {
    await supabase.from('system_notifications').delete().eq('id', id);
    fetchItems();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" aria-label="Notificações">
          <Bell size={20} />
          {unread > 0 && (
            <Badge className="absolute -top-0.5 -right-0.5 h-5 min-w-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </Badge>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <span className="text-sm font-semibold">Notificações</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead} className="h-7 text-xs">
              <Check size={12} className="mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
          ) : (
            <div className="divide-y divide-border">
              {items.map(n => (
                <div key={n.id} className={`p-3 text-sm ${!n.read ? 'bg-primary/5' : ''} group relative`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground line-clamp-2">{n.title}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                        </span>
                        {n.link && (
                          <Link to={n.link} onClick={() => { markRead(n.id); setOpen(false); }} className="text-[11px] text-primary hover:underline">
                            Abrir
                          </Link>
                        )}
                        {!n.read && (
                          <button onClick={() => markRead(n.id)} className="text-[11px] text-muted-foreground hover:text-foreground">
                            Marcar lida
                          </button>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeOne(n.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive" aria-label="Excluir">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
