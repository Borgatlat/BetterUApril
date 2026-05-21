/**
 * Shared inserts/reads for group_events + group_event_attendees.
 * Used by AddEventModal (share step) and group screens.
 */

/** Expo Router params are sometimes string | string[]. */
export function resolveRouteId(routeId) {
  if (routeId == null) return null;
  if (Array.isArray(routeId)) return routeId[0] || null;
  return String(routeId);
}

/** Local calendar date YYYY-MM-DD (avoids UTC off-by-one for "today" filters). */
export function getLocalDateIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function shareEventToGroupIds(client, {
  groupIds,
  title,
  description,
  eventDate,
  eventTime,
  userId,
}) {
  const created = [];
  const errors = [];
  const uniqueIds = [
    ...new Set((groupIds || []).map(resolveRouteId).filter(Boolean)),
  ];

  for (const groupId of uniqueIds) {
    const { data: groupEvent, error: insertErr } = await client
      .from('group_events')
      .insert({
        group_id: groupId,
        title: (title || '').trim(),
        description: (description || '').trim() || null,
        event_date: eventDate,
        event_time: (eventTime || '').trim() || '12:00',
        created_by: userId,
      })
      .select('id, group_id, title, created_at')
      .single();

    if (insertErr) {
      console.error('Error sharing event to group', groupId, insertErr);
      errors.push({ groupId, error: insertErr });
      continue;
    }

    const { error: attendeeErr } = await client.from('group_event_attendees').insert({
      event_id: groupEvent.id,
      user_id: userId,
    });

    if (attendeeErr) {
      console.error('Error adding creator as attendee', groupEvent.id, attendeeErr);
      errors.push({ groupId, error: attendeeErr });
      continue;
    }

    created.push(groupEvent);
  }

  return { created, errors };
}

/** Recent group_events rows for merging into group activity / feed lists. */
export async function fetchGroupEventsForFeed(client, groupId, { limit = 20 } = {}) {
  const gid = resolveRouteId(groupId);
  if (!gid) return [];

  const { data, error } = await client
    .from('group_events')
    .select('id, group_id, title, description, event_date, event_time, created_by, created_at')
    .eq('group_id', gid)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}
