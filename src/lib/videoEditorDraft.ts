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
