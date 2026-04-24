import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, MessageSquare, ThumbsUp, Sparkles, ChevronDown, ChevronUp, Trash2, Loader2, Calendar, Pencil, Check, X } from 'lucide-react';
import { AiProfileCard } from '@/components/AiProfileCard';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type Project = {
  id: string;
  name: string;
  video_urls: string[];
  status: string;
  total_comments: number | null;
  ai_profile: string | null;
  created_at: string;
};

type Comment = {
  id: string;
  author: string | null;
  author_avatar: string | null;
  content: string;
  likes: number | null;
  published_at: string | null;
  video_url: string;
};

const Projects = () => {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);

  const startEditName = (e: React.MouseEvent, p: Project) => {
    e.stopPropagation();
    setEditingNameId(p.id);
    setEditingName(p.name);
  };

  const cancelEditName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNameId(null);
    setEditingName('');
  };

  const saveName = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const name = editingName.trim();
    if (!name) {
      toast({ title: 'Nome inválido', variant: 'destructive' });
      return;
    }
    setSavingId(projectId);
    const { error } = await supabase.from('projects').update({ name }).eq('id', projectId);
    setSavingId(null);
    if (error) {
      toast({ title: 'Erro ao renomear', description: error.message, variant: 'destructive' });
    } else {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
      setEditingNameId(null);
      toast({ title: 'Projeto renomeado' });
    }
  };

  const startEditProfile = (p: Project) => {
    setEditingProfileId(p.id);
    setEditingProfile(p.ai_profile || '');
  };

  const saveProfile = async (projectId: string) => {
    setSavingId(projectId);
    const { error } = await supabase.from('projects').update({ ai_profile: editingProfile }).eq('id', projectId);
    setSavingId(null);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, ai_profile: editingProfile } : p));
      setEditingProfileId(null);
      toast({ title: 'Perfil atualizado' });
    }
  };

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar projetos', description: error.message, variant: 'destructive' });
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, []);

  const toggleExpand = async (projectId: string) => {
    if (expandedId === projectId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(projectId);
    if (!comments[projectId]) {
      setLoadingComments(projectId);
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('project_id', projectId)
        .order('likes', { ascending: false })
        .limit(100);
      setComments(prev => ({ ...prev, [projectId]: data || [] }));
      setLoadingComments(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast({ title: 'Projeto excluído' });
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl space-y-6 animate-fade-in">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="text-primary" /> Meus Projetos
          </h1>
          <p className="text-muted-foreground mt-1">Histórico de todas as suas extrações</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : projects.length === 0 ? (
          <Card className="glass p-8 text-center">
            <FolderOpen className="mx-auto text-muted-foreground" size={48} />
            <p className="mt-4 text-muted-foreground">Nenhuma extração realizada ainda.</p>
            <Button className="mt-4" asChild>
              <a href="/dashboard/extract">Fazer primeira extração</a>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {projects.map(project => (
              <Card key={project.id} className="glass overflow-hidden">
                <button
                  onClick={() => toggleExpand(project.id)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    {editingNameId === project.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          className="h-9"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveName(e as any, project.id);
                            if (e.key === 'Escape') cancelEditName(e as any);
                          }}
                        />
                        <Button size="icon" variant="ghost" onClick={(e) => saveName(e, project.id)} disabled={savingId === project.id}>
                          {savingId === project.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-success" />}
                        </Button>
                        <Button size="icon" variant="ghost" onClick={cancelEditName}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-bold text-lg truncate">{project.name}</h3>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={(e) => startEditName(e, project)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageSquare size={14} /> {project.total_comments ?? 0} comentários
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={14} /> {new Date(project.created_at).toLocaleDateString('pt-BR')}
                      </span>
                      {project.ai_profile && (
                        <span className="flex items-center gap-1 text-warning">
                          <Sparkles size={14} /> Perfil IA
                        </span>
                      )}
                    </div>
                  </div>
                  {expandedId === project.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>

                {expandedId === project.id && (
                  <div className="border-t border-border p-5 space-y-4">
                    {/* URLs */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Vídeos</p>
                      <div className="space-y-1">
                        {project.video_urls.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline truncate">
                            {url}
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* AI Profile */}
                    {editingProfileId === project.id ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase">Perfil IA</p>
                        <Textarea
                          value={editingProfile}
                          onChange={(e) => setEditingProfile(e.target.value)}
                          rows={12}
                          className="font-mono text-xs"
                        />
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingProfileId(null)}>
                            <X className="mr-1 h-4 w-4" /> Cancelar
                          </Button>
                          <Button size="sm" onClick={() => saveProfile(project.id)} disabled={savingId === project.id}>
                            {savingId === project.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Check className="mr-1 h-4 w-4" />}
                            Salvar
                          </Button>
                        </div>
                      </div>
                    ) : project.ai_profile ? (
                      <div className="space-y-2">
                        <AiProfileCard profile={project.ai_profile} projectName={project.name} />
                        <div className="flex justify-end">
                          <Button size="sm" variant="outline" onClick={() => startEditProfile(project)}>
                            <Pencil className="mr-1 h-3.5 w-3.5" /> Editar Perfil IA
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => startEditProfile(project)}>
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Adicionar Perfil IA
                      </Button>
                    )}

                    {/* Comments */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Comentários</p>
                      {loadingComments === project.id ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="max-h-[400px] overflow-y-auto divide-y divide-border rounded-lg border border-border">
                          {(comments[project.id] || []).map(c => (
                            <div key={c.id} className="p-3 flex gap-3">
                              {c.author_avatar ? (
                                <img src={c.author_avatar} alt={c.author || ''} className="h-8 w-8 shrink-0 rounded-full" />
                              ) : (
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs">
                                  {c.author?.charAt(0) || '?'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-xs">{c.author}</span>
                                <p className="text-xs text-muted-foreground mt-0.5" dangerouslySetInnerHTML={{ __html: c.content }} />
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                  <span className="flex items-center gap-1"><ThumbsUp size={10} /> {c.likes}</span>
                                  {c.published_at && <span>{new Date(c.published_at).toLocaleDateString('pt-BR')}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                          {(comments[project.id] || []).length === 0 && (
                            <p className="p-4 text-sm text-muted-foreground text-center">Nenhum comentário encontrado.</p>
                          )}
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Projects;
