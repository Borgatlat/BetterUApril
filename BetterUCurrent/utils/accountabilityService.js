import { supabase } from '../lib/supabase';
import { formatApiError } from '../lib/formatApiError';
import { getWeekStartDate } from './accountabilityUtils';
import {
  createAccountabilityPartnerNoti,
  createAccountabilityCheckInReceivedNotification,
} from './notificationHelpers';

const MIGRATION_HINT =
  'Run Supabase migration 20260602000000_accountability_partners_repair.sql (or 20260606000000_accountability_grants_refresh.sql) in the SQL editor.';

/**
 * Map accountability-specific errors after formatApiError.
 * @param {unknown} error
 */
function accountabilityMessage(error) {
  const msg = formatApiError(error);
  const code = /** @type {{ code?: string }} */ (error)?.code ?? '';

  if (msg.includes('user must be an accepted friend') || msg.includes('accepted friend')) {
    return 'You need to be friends first. Accept their friend request in Community → Friends, then try again.';
  }
  if (msg.includes('already accountability partners')) {
    return 'You are already accountability partners.';
  }
  if (msg.includes('partner profile not found')) {
    return 'That user could not be found.';
  }
  if (code === '42P01' || (msg.includes('not set up') && msg.includes('Accountability'))) {
    return `Accountability partners is not on Supabase yet. ${MIGRATION_HINT}`;
  }
  if (msg.includes('not signed in')) {
    return 'Please sign in again and retry.';
  }
  return msg;
}

/** @param {unknown} data */
function parseAddPartnerRpcResult(data) {
  if (!data) return null;
  let payload = data;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (Array.isArray(payload)) payload = payload[0];
  if (payload && typeof payload === 'object' && payload.ok === true) {
    return payload;
  }
  return null;
}

function rpcIsMissing(error) {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = error.message ?? '';
  return (
    code === '42883' ||
    code === 'PGRST202' ||
    msg.includes('add_accountability_partner') ||
    msg.includes('Could not find the function')
  );
}

/**
 * Confirms accountability_partners exists (call from add-partner screen on load).
 */
export async function checkAccountabilityPartnersAvailable() {
  const { error } = await supabase.from('accountability_partners').select('id').limit(1);
  if (error) throw new Error(accountabilityMessage(error));
  return true;
}

/**
 * Confirms an accepted friendship exists between two users.
 */
async function assertAcceptedFriendship(userId, friendId) {
  const { data: forward, error: errA } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', userId)
    .eq('friend_id', friendId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (errA) throw new Error(accountabilityMessage(errA));

  if (forward?.id) return;

  const { data: reverse, error: errB } = await supabase
    .from('friends')
    .select('id')
    .eq('user_id', friendId)
    .eq('friend_id', userId)
    .eq('status', 'accepted')
    .maybeSingle();

  if (errB) throw new Error(accountabilityMessage(errB));
  if (!reverse?.id) {
    throw new Error('User must be an accepted friend first.');
  }
}

/**
 * Add a friend as accountability partner.
 * Uses RPC add_accountability_partner when deployed; otherwise direct insert.
 */
export async function addAccountabilityPartner(currentUserId, friendId) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) {
    throw new Error('Not signed in');
  }

  const me = user.id;
  if (me !== currentUserId) {
    console.warn('[accountability] profile id !== auth uid; using auth uid', { currentUserId, me });
  }

  await checkAccountabilityPartnersAvailable();

  const { data: rpcData, error: rpcError } = await supabase.rpc('add_accountability_partner', {
    p_partner_id: friendId,
  });

  const parsed = parseAddPartnerRpcResult(rpcData);
  if (!rpcError && parsed) {
    return {
      id: parsed.id,
      user_id: parsed.user_id,
      partner_id: parsed.partner_id,
    };
  }

  if (rpcError && !rpcIsMissing(rpcError)) {
    throw new Error(accountabilityMessage(rpcError));
  }

  if (rpcError && rpcIsMissing(rpcError)) {
    console.warn('[accountability] RPC not deployed, using direct insert fallback');
  }

  await assertAcceptedFriendship(me, friendId);

  const { data: already, error: alreadyError } = await supabase
    .from('accountability_partners')
    .select('id, user_id, partner_id')
    .or(
      `and(user_id.eq.${me},partner_id.eq.${friendId}),and(user_id.eq.${friendId},partner_id.eq.${me})`,
    );

  if (alreadyError) throw new Error(accountabilityMessage(alreadyError));
  if (already?.length > 0) {
    throw new Error('Already accountability partners.');
  }

  const { data: partnership, error } = await supabase
    .from('accountability_partners')
    .insert({ user_id: me, partner_id: friendId })
    .select('id, user_id, partner_id')
    .single();

  if (error) throw new Error(accountabilityMessage(error));

  try {
    await createAccountabilityPartnerNoti(friendId, me, partnership.id);
  } catch (notifyErr) {
    console.warn(
      '[accountability] partner added; notification failed:',
      accountabilityMessage(notifyErr),
    );
  }

  return partnership;
}

/**
 * Remove accountability partnership (either side can remove).
 */
export async function removeAccountabilityPartner(currentUserId, partnershipId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? currentUserId;

  const { error } = await supabase
    .from('accountability_partners')
    .delete()
    .eq('id', partnershipId)
    .or(`user_id.eq.${me},partner_id.eq.${me}`);
  if (error) throw new Error(accountabilityMessage(error));
}

/**
 * List partnerships for current user with partner profile.
 */
export async function getAccountabilityPartners(currentUserId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const me = user?.id ?? currentUserId;

  const { data: rows, error } = await supabase
    .from('accountability_partners')
    .select(
      `id, user_id, partner_id, check_in_day, reminder_hour_utc, reminders_enabled,
       meetup_day, meetup_hour_local, meetup_minute_local, meetup_spot, meetup_notes, created_at`,
    )
    .or(`user_id.eq.${me},partner_id.eq.${me}`);
  if (error) throw new Error(accountabilityMessage(error));

  const list = rows || [];
  if (list.length === 0) return [];

  const partnerIds = [...new Set(list.map((r) => (r.user_id === me ? r.partner_id : r.user_id)))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', partnerIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return list.map((row) => {
    const partnerId = row.user_id === me ? row.partner_id : row.user_id;
    return {
      id: row.id,
      partner_id: partnerId,
      partner: profileMap.get(partnerId) || null,
      check_in_day: row.check_in_day,
      reminder_hour_utc: row.reminder_hour_utc,
      reminders_enabled: row.reminders_enabled !== false,
      meetup_day: row.meetup_day,
      meetup_hour_local: row.meetup_hour_local,
      meetup_minute_local: row.meetup_minute_local ?? 0,
      meetup_spot: row.meetup_spot ?? '',
      meetup_notes: row.meetup_notes ?? '',
      created_at: row.created_at,
    };
  });
}

/**
 * Fetch one partnership row (for rhythm settings + meetup plan).
 */
export async function getPartnershipDetail(partnershipId) {
  const { data, error } = await supabase
    .from('accountability_partners')
    .select('*')
    .eq('id', partnershipId)
    .single();
  if (error) throw new Error(accountabilityMessage(error));
  return data;
}

/**
 * Save weekly rhythm + in-person meetup plan (RPC).
 */
export async function updatePartnershipRhythm(partnershipId, rhythm) {
  const { data, error } = await supabase.rpc('update_accountability_partnership_rhythm', {
    p_partnership_id: partnershipId,
    p_check_in_day: rhythm.checkInDay ?? null,
    p_reminder_hour_utc: rhythm.reminderHourUtc ?? null,
    p_reminders_enabled: rhythm.remindersEnabled ?? null,
    p_meetup_day: rhythm.meetupDay ?? null,
    p_meetup_hour_local: rhythm.meetupHourLocal ?? null,
    p_meetup_minute_local: rhythm.meetupMinuteLocal ?? null,
    p_meetup_spot: rhythm.meetupSpot ?? null,
    p_meetup_notes: rhythm.meetupNotes ?? null,
  });
  if (error) throw new Error(accountabilityMessage(error));
  return data;
}

/**
 * In-app weekly check-in reminders (server). Call when opening accountability hub.
 */
export async function triggerWeeklyCheckInReminders() {
  const { data, error } = await supabase.rpc('send_my_accountability_check_in_reminders');
  if (error) {
    const missing =
      error.code === '42883' || error.message?.includes('send_my_accountability_check_in_reminders');
    if (missing) return { sent: 0, skipped: true };
    throw new Error(accountabilityMessage(error));
  }
  return data ?? { sent: 0 };
}

/**
 * Get or create pending check-in for current week for a partnership.
 */
export async function getOrCreateCheckIn(partnershipId, userId, partnerId) {
  const weekStart = getWeekStartDate();
  const { data: existing } = await supabase
    .from('accountability_check_ins')
    .select('*')
    .eq('partnership_id', partnershipId)
    .eq('week_start_date', weekStart)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from('accountability_check_ins')
    .insert({
      partnership_id: partnershipId,
      user_id: userId,
      partner_id: partnerId,
      week_start_date: weekStart,
      status: 'pending',
    })
    .select('*')
    .single();
  if (error) throw new Error(accountabilityMessage(error));
  return created;
}

/**
 * Submit check-in (notes, goals, prompts, rating).
 */
export async function submitCheckIn(checkInId, payload) {
  const { data, error } = await supabase
    .from('accountability_check_ins')
    .update({
      status: 'submitted',
      notes: payload.notes ?? undefined,
      goals_met: payload.goals_met ?? undefined,
      goals_total: payload.goals_total ?? undefined,
      consistency_rating: payload.consistency_rating ?? undefined,
      biggest_win: payload.biggest_win ?? undefined,
      next_focus: payload.next_focus ?? undefined,
      how_you_can_help: payload.how_you_can_help ?? undefined,
      message_to_partner: payload.message_to_partner ?? undefined,
      guided_prompt_ids: payload.guidedPromptIds?.length ? payload.guidedPromptIds : undefined,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkInId)
    .select('*')
    .single();
  if (error) throw new Error(accountabilityMessage(error));

  const { data: row } = await supabase
    .from('accountability_check_ins')
    .select('partner_id, user_id, week_start_date')
    .eq('id', checkInId)
    .single();

  if (row?.partner_id) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', row.user_id)
      .single();
    const name = profile?.full_name || profile?.username || 'Your partner';
    try {
      await createAccountabilityCheckInReceivedNotification(
        row.partner_id,
        name,
        row.week_start_date,
      );
    } catch (notifyErr) {
      console.warn('[accountability] check-in saved; notify failed:', accountabilityMessage(notifyErr));
    }
  }

  return data;
}

/**
 * Submit a reply to your partner's check-in (updates their row with reply_by_partner).
 */
export async function submitCheckInReply(checkInId, replyText) {
  const { data, error } = await supabase
    .from('accountability_check_ins')
    .update({
      reply_by_partner: replyText || null,
      reply_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkInId)
    .select('*')
    .single();
  if (error) throw new Error(accountabilityMessage(error));
  return data;
}

/**
 * Get check-ins for a partnership (for history and streak).
 */
export async function getCheckInsForPartnership(partnershipId, limit = 20) {
  const { data, error } = await supabase
    .from('accountability_check_ins')
    .select('*')
    .eq('partnership_id', partnershipId)
    .order('week_start_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(accountabilityMessage(error));
  return data || [];
}
