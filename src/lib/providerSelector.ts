import { supabase } from '@/integrations/supabase/client';

export type ProviderKind = 'video_ai' | 'tts' | 'music';

export type ProviderRow = {
  id: string;
  kind: ProviderKind;
  provider: string;
  weight: number;
  enabled: boolean;
  config: Record<string, any>;
};

export type ResolvedProvider = ProviderRow & {
  costActionKey: string;
  costPerUnit: number; // credits per unit (per second / per scene / per 100 chars / etc.)
};

export type CostMap = Record<string, number>;

const FALLBACK_COST_KEY: Record<ProviderKind, string> = {
  video_ai: 'video_render_basic',
  tts: 'tts_browser',
  music: 'music_library',
};

/**
 * Fetch all enabled providers and credit action costs in one go.
 */
export async function loadProvidersAndCosts(): Promise<{
  providers: ProviderRow[];
  costs: CostMap;
}> {
  const [{ data: provs }, { data: costs }] = await Promise.all([
    supabase.from('video_providers').select('*').eq('enabled', true),
    supabase.from('credit_action_costs').select('action_key, cost'),
  ]);
  const costMap: CostMap = {};
  (costs || []).forEach((c: any) => { costMap[c.action_key] = c.cost; });
  return {
    providers: ((provs as any[]) || []).map(p => ({
      ...p,
      config: p.config || {},
    })),
    costs: costMap,
  };
}

/**
 * Weighted random pick from a list. weight=0 entries are excluded.
 * Deterministic in tests if Math.random() is mocked.
 */
export function weightedPick<T extends { weight: number }>(items: T[]): T | null {
  const positives = items.filter(i => (i.weight || 0) > 0);
  if (positives.length === 0) return items[0] || null;
  const total = positives.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of positives) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return positives[positives.length - 1];
}

/**
 * Select a provider for a given kind, weighted by `weight`.
 * Optional filter (e.g. exclude `browser_canvas` when picking among "real" AI video).
 */
export function selectWeightedProvider(
  providers: ProviderRow[],
  kind: ProviderKind,
  costs: CostMap,
  filter?: (p: ProviderRow) => boolean,
): ResolvedProvider | null {
  let pool = providers.filter(p => p.kind === kind && p.enabled);
  if (filter) pool = pool.filter(filter);
  if (pool.length === 0) return null;
  const picked = weightedPick(pool);
  if (!picked) return null;
  const costActionKey: string = picked.config?.cost_action_key || FALLBACK_COST_KEY[kind];
  const costPerUnit = costs[costActionKey] ?? 0;
  return { ...picked, costActionKey, costPerUnit };
}

/**
 * Compute total credits for a render given the selection.
 * - video basic: cost per second
 * - video AI: cost per scene
 * - TTS: cost per 100 characters of narration text (across all scenes)
 * - music: cost per render (flat)
 */
export function computeRenderCost(args: {
  videoProvider: ResolvedProvider | null;
  ttsProvider: ResolvedProvider | null;
  musicProvider: ResolvedProvider | null;
  totalDurationSec: number;
  scenesCount: number;
  ttsCharsTotal: number;
  hasMusic: boolean;
}): { total: number; breakdown: Array<{ label: string; key: string; amount: number; detail: string }> } {
  const breakdown: Array<{ label: string; key: string; amount: number; detail: string }> = [];

  if (args.videoProvider) {
    const isAi = args.videoProvider.provider !== 'browser_canvas';
    const amount = isAi
      ? Math.max(1, Math.ceil(args.scenesCount * args.videoProvider.costPerUnit))
      : Math.max(1, Math.ceil(args.totalDurationSec * args.videoProvider.costPerUnit));
    breakdown.push({
      label: `Vídeo (${args.videoProvider.provider})`,
      key: args.videoProvider.costActionKey,
      amount,
      detail: isAi
        ? `${args.scenesCount} cenas × ${args.videoProvider.costPerUnit}`
        : `${Math.ceil(args.totalDurationSec)}s × ${args.videoProvider.costPerUnit}`,
    });
  }

  if (args.ttsProvider && args.ttsCharsTotal > 0 && args.ttsProvider.costPerUnit > 0) {
    const blocks = Math.max(1, Math.ceil(args.ttsCharsTotal / 100));
    const amount = blocks * args.ttsProvider.costPerUnit;
    breakdown.push({
      label: `TTS (${args.ttsProvider.provider})`,
      key: args.ttsProvider.costActionKey,
      amount,
      detail: `${args.ttsCharsTotal} chars (${blocks} × 100) × ${args.ttsProvider.costPerUnit}`,
    });
  }

  if (args.musicProvider && args.hasMusic && args.musicProvider.costPerUnit > 0) {
    breakdown.push({
      label: `Música (${args.musicProvider.provider})`,
      key: args.musicProvider.costActionKey,
      amount: args.musicProvider.costPerUnit,
      detail: `flat × ${args.musicProvider.costPerUnit}`,
    });
  }

  const total = breakdown.reduce((s, b) => s + b.amount, 0);
  return { total: Math.max(0, total), breakdown };
}

/**
 * Charge each component sequentially via consume_credits RPC.
 * If any step fails, returns success=false (previous successful charges are kept;
 * caller should usually pre-validate balance >= total before calling).
 */
export async function chargeRenderCredits(args: {
  breakdown: Array<{ label: string; key: string; amount: number; detail: string }>;
  referenceId?: string;
}): Promise<{ success: boolean; error?: string; finalBalance?: number }> {
  let balance = 0;
  for (const item of args.breakdown) {
    if (item.amount <= 0) continue;
    const { data, error } = await supabase.rpc('consume_credits', {
      _amount: item.amount,
      _action_key: item.key,
      _description: `${item.label} - ${item.detail}`,
      _reference_id: args.referenceId,
    });
    if (error) return { success: false, error: error.message };
    const res = data as any;
    if (!res?.success) return { success: false, error: res?.error || 'insufficient_credits', finalBalance: res?.balance };
    balance = res.balance;
  }
  return { success: true, finalBalance: balance };
}
