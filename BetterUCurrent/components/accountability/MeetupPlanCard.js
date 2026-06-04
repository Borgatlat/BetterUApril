import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDayLabel } from '../../utils/accountabilityUtils';

function formatMeetupTime(hour = 12, minute = 0) {
  const h = hour ?? 12;
  const m = minute ?? 0;
  const mm = m > 0 ? `:${String(m).padStart(2, '0')}` : '';
  if (h === 0) return `12${mm} AM`;
  if (h < 12) return `${h}${mm} AM`;
  if (h === 12) return `12${mm} PM`;
  return `${h - 12}${mm} PM`;
}

/**
 * Shows in-person meetup plan for a partnership.
 * @param {{ partnership: object, onEdit?: () => void }} props
 */
export default function MeetupPlanCard({ partnership, onEdit }) {
  if (!partnership?.meetup_day) {
    return (
      <TouchableOpacity style={styles.empty} onPress={onEdit} disabled={!onEdit}>
        <Ionicons name="cafe-outline" size={22} color="#00ffff" />
        <View style={styles.emptyText}>
          <Text style={styles.emptyTitle}>Plan an in-person chat</Text>
          <Text style={styles.emptySub}>
            Pick a day, time, and spot so you both know when to meet face-to-face.
          </Text>
        </View>
        {onEdit ? <Ionicons name="chevron-forward" size={20} color="#666" /> : null}
      </TouchableOpacity>
    );
  }

  const day = formatDayLabel(partnership.meetup_day);
  const time = formatMeetupTime(
    partnership.meetup_hour_local,
    partnership.meetup_minute_local,
  );
  const spot = partnership.meetup_spot?.trim();
  const notes = partnership.meetup_notes?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Ionicons name="people" size={20} color="#00ffff" />
        <Text style={styles.heading}>In-person meetup</Text>
        {onEdit ? (
          <TouchableOpacity onPress={onEdit} hitSlop={12}>
            <Text style={styles.edit}>Edit</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.when}>
        {day} · {time}
        {spot ? ` · ${spot}` : ''}
      </Text>
      {notes ? <Text style={styles.notes}>{notes}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#252525',
    gap: 12,
  },
  emptyText: { flex: 1 },
  emptyTitle: { color: '#fff', fontWeight: '600', fontSize: 14 },
  emptySub: { color: '#666', fontSize: 12, marginTop: 4 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#00ffff33',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 14 },
  edit: { color: '#00ffff', fontSize: 13, fontWeight: '600' },
  when: { color: '#ccc', marginTop: 8, fontSize: 14 },
  notes: { color: '#888', marginTop: 8, fontSize: 13, lineHeight: 18 },
});
