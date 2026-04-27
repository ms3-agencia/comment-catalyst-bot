import { supabase } from '@/integrations/supabase/client';

export type EditorDraftState = {
  scenes: any[];
  format: any;
  globalAudio: any;
  selectedPresetId: string;
  container: string;
  codec: string;
  quality: string;
  customBitrate: number;
  resolutionScale: number;
  selectedProvider: string;
  genKind: string;
};

export type DraftVersion = {
  id: string;
  version: number;
  label: string | null;
  state: EditorDraftState;
  created_at: string;
};

export async function loadDraft(contentId: string): Promise<EditorDraftState | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('video_editor_drafts' as any)
    .select('state')
    .eq('user_id', user.id)
    .eq('content_id', contentId)
    .maybeSingle();
  if (error || !data) return null;
  return ((data as any).state as EditorDraftState) || null;
}

export async function saveDraft(contentId: string, state: EditorDraftState): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from('video_editor_drafts' as any)
    .upsert(
      { user_id: user.id, content_id: contentId, state: state as any, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,content_id' }
    );
  return !error;
}

export async function deleteDraft(contentId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('video_editor_drafts' as any)
    .delete()
    .eq('user_id', user.id)
    .eq('content_id', contentId);
}

// ---------- Versions ----------

export async function listDraftVersions(contentId: string): Promise<DraftVersion[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('video_editor_draft_versions' as any)
    .select('id, version, label, state, created_at')
    .eq('user_id', user.id)
    .eq('content_id', contentId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data as unknown as DraftVersion[];
}

/**
 * Create a new version snapshot. Auto-increments `version` based on existing rows.
 */
export async function createDraftVersion(
  contentId: string,
  state: EditorDraftState,
  label?: string,
): Promise<DraftVersion | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: last } = await supabase
    .from('video_editor_draft_versions' as any)
    .select('version')
    .eq('user_id', user.id)
    .eq('content_id', contentId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((last as any)?.version || 0) + 1;
  const { data, error } = await supabase
    .from('video_editor_draft_versions' as any)
    .insert({
      user_id: user.id,
      content_id: contentId,
      state: state as any,
      version: nextVersion,
      label: label || null,
    })
    .select('id, version, label, state, created_at')
    .single();
  if (error || !data) return null;
  return data as unknown as DraftVersion;
}

export async function deleteDraftVersion(versionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('video_editor_draft_versions' as any)
    .delete()
    .eq('id', versionId);
  return !error;
}
