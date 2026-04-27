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

// Per-key serialization: ensures only one upsert is in-flight per (user, content)
// at a time. If new saves arrive while one is running, only the LATEST pending
// state is kept and persisted next — older intermediate states are discarded
// (coalesced) since the latest already supersedes them.
type PendingSave = {
  state: EditorDraftState;
  resolve: (ok: boolean) => void;
};
const inflight = new Map<string, Promise<boolean>>();
const pending = new Map<string, PendingSave>();

async function runUpsert(userId: string, contentId: string, state: EditorDraftState): Promise<boolean> {
  const { error } = await supabase
    .from('video_editor_drafts' as any)
    .upsert(
      {
        user_id: userId,
        content_id: contentId,
        state: state as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,content_id' },
    );
  return !error;
}

export async function saveDraft(contentId: string, state: EditorDraftState): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const key = `${user.id}:${contentId}`;

  // If a save is already running, queue this one as the next-to-run, replacing
  // any previously queued state (we only care about the most recent snapshot).
  if (inflight.has(key)) {
    return new Promise<boolean>((resolve) => {
      const prev = pending.get(key);
      if (prev) prev.resolve(true); // superseded by a newer state
      pending.set(key, { state, resolve });
    });
  }

  const run = async (): Promise<boolean> => {
    const ok = await runUpsert(user.id, contentId, state);
    // Drain any pending newer state that arrived while we were saving.
    const next = pending.get(key);
    if (next) {
      pending.delete(key);
      const nextOk = await runUpsert(user.id, contentId, next.state);
      next.resolve(nextOk);
    }
    return ok;
  };

  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
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
