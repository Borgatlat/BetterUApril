import { supabase } from '../lib/supabase';
import { formatApiError } from '../lib/formatApiError';

/** Primary tables (Feed + community.js preload). */
export const KUDOS_TABLE_BY_TYPE = {
  workout: { table: 'workout_kudos', idColumn: 'workout_id' },
  mental: { table: 'mental_session_kudos', idColumn: 'session_id' },
  run: { table: 'run_kudos', idColumn: 'run_id' },
};

/** If primary mental table missing, try legacy name. */
const MENTAL_KUDOS_FALLBACK = { table: 'mental_kudos', idColumn: 'session_id' };

export function supportsKudos(activityType) {
  return Boolean(KUDOS_TABLE_BY_TYPE[activityType]);
}

export function buildKudosMap(rows, idColumn) {
  const map = {};
  (rows || []).forEach((row) => {
    const id = row[idColumn];
    if (!id) return;
    if (!map[id]) map[id] = [];
    map[id].push(row);
  });
  return map;
}

function isMissingTableError(error) {
  const code = error?.code ?? '';
  const msg = String(error?.message ?? '').toLowerCase();
  return code === '42P01' || msg.includes('does not exist') || msg.includes('schema cache');
}

function configsForType(activityType) {
  const primary = KUDOS_TABLE_BY_TYPE[activityType];
  if (!primary) return [];
  if (activityType === 'mental') {
    return [primary, MENTAL_KUDOS_FALLBACK];
  }
  return [primary];
}

async function findExistingKudos(config, activityId, userId) {
  const { data, error } = await supabase
    .from(config.table)
    .select('id')
    .eq(config.idColumn, activityId)
    .eq('user_id', userId)
    .limit(1);

  if (error) throw error;
  return data?.[0] ?? null;
}

async function toggleOnConfig(config, activityId, userId) {
  const existing = await findExistingKudos(config, activityId, userId);

  if (existing?.id) {
    const { error: deleteError } = await supabase.from(config.table).delete().eq('id', existing.id);
    if (deleteError) throw deleteError;
    return { kudosed: false };
  }

  const insertRow = { [config.idColumn]: activityId, user_id: userId };
  const { error: insertError } = await supabase.from(config.table).insert([insertRow]);
  if (insertError) throw insertError;
  return { kudosed: true };
}

/**
 * Toggle kudos for workout / mental / run feed items.
 * Uses auth.uid() from the session when userId is omitted.
 */
export async function toggleKudos(activityType, activityId, userId) {
  const configs = configsForType(activityType);
  if (!configs.length) {
    throw new Error(`Kudos not supported for type: ${activityType}`);
  }

  let resolvedUserId = userId;
  if (!resolvedUserId) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      throw new Error('Sign in to give kudos');
    }
    resolvedUserId = user.id;
  }

  if (!activityId) {
    throw new Error('Missing activity id');
  }

  let lastError = null;
  for (const config of configs) {
    try {
      return await toggleOnConfig(config, activityId, resolvedUserId);
    } catch (e) {
      lastError = e;
      if (!isMissingTableError(e)) {
        throw new Error(formatApiError(e));
      }
    }
  }

  throw new Error(formatApiError(lastError) || 'Kudos table not found. Run the kudos migration in Supabase.');
}

export async function fetchKudosForIds(activityType, ids) {
  const configs = configsForType(activityType);
  if (!configs.length || !ids?.length) return {};

  for (const config of configs) {
    const { data, error } = await supabase
      .from(config.table)
      .select(`${config.idColumn}, user_id, created_at`)
      .in(config.idColumn, ids);

    if (!error) {
      return buildKudosMap(data, config.idColumn);
    }
    if (!isMissingTableError(error)) {
      throw error;
    }
  }
  return {};
}
