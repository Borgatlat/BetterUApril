import { supabase } from '../lib/supabase';
import { getWeekStartDate } from './accountabilityUtils';
import {
  createAccountabilityPartnerNoti,
  createAccountabilityCheckInReceivedNotification,
} from './notificationHelpers';

/**
 * Add a friend as accountability partner. They must be an accepted friend.
 * Creates one row in accountability_partners (user_id = currentUser, partner_id = friend).
 */
export async function addAccountabilityPartner(currentUserId, friendId) {
  const { data: existing } = await supabase
    .from('friends')
    .select('id, user_id, friend_id, status')
    .or(`and(user_id.eq.${currentUserId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${currentUserId})`)
    .eq('status', 'accepted');

  const accepted = (existing || []).find(
    (f) =>
      (f.user_id === currentUserId && f.friend_id === friendId) ||
      (f.user_id === friendId && f.friend_id === currentUserId)
  );
  if (!existing?.length || !accepted || accepted.status !== 'accepted') {
    throw new Error('User must be an accepted friend first.');
  }

  const { data: already } = await supabase
    .from('accountability_partners')
    .select('id')
    .or(`and(user_id.eq.${currentUserId},partner_id.eq.${friendId}),and(user_id.eq.${friendId},partner_id.eq.${currentUserId})`);

  if (already?.length > 0) {
    throw new Error('Already accountability partners.');
  }

  const { data: partnership, error } = await supabase
    .from('accountability_partners')
    .insert({ user_id: currentUserId, partner_id: friendId })
    .select('id')
    .single();

  if (error) throw error;

  await createAccountabilityPartnerNoti(friendId, currentUserId, partnership.id);
  return partnership;
}

/**
 * Remove accountability partnership (either side can remove).
 */
export async function removeAccountabilityPartner(currentUserId, partnershipId) {
  const { error } = await supabase
    .from('accountability_partners')
    .delete()
    .eq('id', partnershipId)
    .or(`user_id.eq.${currentUserId},partner_id.eq.${currentUserId}`);
  if (error) throw error;
}

/**
 * List partnerships for current user with partner profile.
 */
export async function getAccountabilityPartners(currentUserId) {
  const { data: rows, error } = await supabase
    .from('accountability_partners')
    .select('id, user_id, partner_id, check_in_day, reminder_hour_utc, created_at')
    .or(`user_id.eq.${currentUserId},partner_id.eq.${currentUserId}`);
  if (error) throw error;

  const list = rows || [];
  if (list.length === 0) return [];

  const partnerIds = [...new Set(list.map((r) => (r.user_id === currentUserId ? r.partner_id : r.user_id)))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', partnerIds);
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  return list.map((row) => {
    const partnerId = row.user_id === currentUserId ? row.partner_id : row.user_id;
    return {
      id: row.id,
      partner_id: partnerId,
      partner: profileMap.get(partnerId) || null,
      check_in_day: row.check_in_day,
      reminder_hour_utc: row.reminder_hour_utc,
      created_at: row.created_at,
    };
  });
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
  if (error) throw error;
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
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', checkInId)
    .select('*')
    .single();
  if (error) throw error;

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
    await createAccountabilityCheckInReceivedNotification(
      row.partner_id,
      name,
      row.week_start_date
    );
  }

  return data;
}

/**
 * Submit a reply to your partner's check-in (updates their row with reply_by_partner).
 * Only the partner (the other person) can reply; RLS enforces this.
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
  if (error) throw error;
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
  if (error) throw error;
  return data || [];
}
