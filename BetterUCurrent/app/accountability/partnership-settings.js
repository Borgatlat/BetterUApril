import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import {
  getPartnershipDetail,
  updatePartnershipRhythm,
  getAccountabilityPartners,
} from '../../utils/accountabilityService';
import { syncPartnershipLocalReminder } from '../../lib/accountabilityReminders';

const DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function DayPicker({ label, value, onChange, allowNone }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dayRow}>
        {allowNone ? (
          <TouchableOpacity
            style={[styles.dayBtn, !value && styles.dayBtnActive]}
            onPress={() => onChange(null)}
          >
            <Text style={[styles.dayText, !value && styles.dayTextActive]}>None</Text>
          </TouchableOpacity>
        ) : null}
        {DAYS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dayBtn, value === d && styles.dayBtnActive]}
            onPress={() => onChange(d)}
          >
            <Text style={[styles.dayText, value === d && styles.dayTextActive]}>
              {d.slice(0, 3)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function PartnershipSettingsScreen() {
  const { partnershipId } = useLocalSearchParams();
  const { userProfile } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [partnerName, setPartnerName] = useState('Partner');
  const [checkInDay, setCheckInDay] = useState('sunday');
  const [reminderHour, setReminderHour] = useState(18);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [meetupDay, setMeetupDay] = useState(null);
  const [meetupHour, setMeetupHour] = useState(12);
  const [meetupMinute, setMeetupMinute] = useState(0);
  const [meetupSpot, setMeetupSpot] = useState('');
  const [meetupNotes, setMeetupNotes] = useState('');

  useEffect(() => {
    if (!partnershipId || !userProfile?.id) return;
    (async () => {
      try {
        const [row, partners] = await Promise.all([
          getPartnershipDetail(partnershipId),
          getAccountabilityPartners(userProfile.id),
        ]);
        const p = partners.find((x) => x.id === partnershipId);
        if (p) {
          setPartnerName(p.partner?.full_name || p.partner?.username || 'Partner');
        }
        setCheckInDay(row.check_in_day || 'sunday');
        setReminderHour(row.reminder_hour_utc ?? 18);
        setRemindersEnabled(row.reminders_enabled !== false);
        setMeetupDay(row.meetup_day || null);
        setMeetupHour(row.meetup_hour_local ?? 12);
        setMeetupMinute(row.meetup_minute_local ?? 0);
        setMeetupSpot(row.meetup_spot || '');
        setMeetupNotes(row.meetup_notes || '');
      } catch (e) {
        console.error(e);
        Alert.alert('Error', e.message || 'Could not load partnership settings.');
      } finally {
        setLoading(false);
      }
    })();
  }, [partnershipId, userProfile?.id]);

  const onSave = async () => {
    setSaving(true);
    try {
      await updatePartnershipRhythm(partnershipId, {
        checkInDay,
        reminderHourUtc: reminderHour,
        remindersEnabled,
        meetupDay: meetupDay == null ? '' : meetupDay,
        meetupHourLocal: meetupDay ? meetupHour : null,
        meetupMinuteLocal: meetupDay ? meetupMinute : null,
        meetupSpot: meetupSpot.trim(),
        meetupNotes: meetupNotes.trim(),
      });
      await syncPartnershipLocalReminder({
        partnershipId,
        partnerName,
        checkInDay,
        reminderHourUtc: reminderHour,
        enabled: remindersEnabled,
      });
      Alert.alert('Saved', 'Your weekly rhythm and meetup plan are updated.');
      router.back();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 16,
      }}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Rhythm with {partnerName}</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={styles.section}>Weekly check-in</Text>
      <DayPicker label="Check-in day" value={checkInDay} onChange={setCheckInDay} />
      <Text style={styles.label}>Reminder hour (UTC, 0–23)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourRow}>
        {HOURS.map((h) => (
          <TouchableOpacity
            key={h}
            style={[styles.hourBtn, reminderHour === h && styles.hourBtnActive]}
            onPress={() => setReminderHour(h)}
          >
            <Text style={[styles.hourText, reminderHour === h && styles.hourTextActive]}>
              {h}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Push reminders on this device</Text>
        <Switch
          value={remindersEnabled}
          onValueChange={setRemindersEnabled}
          trackColor={{ false: '#333', true: '#00ffff88' }}
          thumbColor={remindersEnabled ? '#00ffff' : '#888'}
        />
      </View>

      <Text style={[styles.section, { marginTop: 28 }]}>In-person meetup</Text>
      <DayPicker
        label="Meetup day (optional)"
        value={meetupDay}
        onChange={setMeetupDay}
        allowNone
      />
      {meetupDay ? (
        <>
          <Text style={styles.label}>Meetup time (local hour)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hourRow}>
            {HOURS.map((h) => (
              <TouchableOpacity
                key={h}
                style={[styles.hourBtn, meetupHour === h && styles.hourBtnActive]}
                onPress={() => setMeetupHour(h)}
              >
                <Text style={[styles.hourText, meetupHour === h && styles.hourTextActive]}>
                  {h}:00
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.label}>Spot (cafeteria, library, chapel…)</Text>
          <TextInput
            style={styles.input}
            placeholder="Where you'll meet"
            placeholderTextColor="#666"
            value={meetupSpot}
            onChangeText={setMeetupSpot}
          />
          <Text style={styles.label}>Conversation plan</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="What you'll talk about, how long, etc."
            placeholderTextColor="#666"
            value={meetupNotes}
            onChangeText={setMeetupNotes}
            multiline
          />
        </>
      ) : null}

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save rhythm'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { padding: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff', textAlign: 'center' },
  section: { fontSize: 16, fontWeight: '700', color: '#00ffff', marginBottom: 12 },
  block: { marginBottom: 16 },
  label: { color: '#888', fontSize: 12, marginBottom: 8 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  dayBtnActive: { backgroundColor: '#00ffff', borderColor: '#00ffff' },
  dayText: { color: '#888', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  dayTextActive: { color: '#000' },
  hourRow: { marginBottom: 16, maxHeight: 44 },
  hourBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 6,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  hourBtnActive: { backgroundColor: '#00ffff' },
  hourText: { color: '#888', fontWeight: '600' },
  hourTextActive: { color: '#000' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  switchLabel: { color: '#ccc', flex: 1, paddingRight: 12 },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    marginBottom: 12,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  saveBtn: {
    backgroundColor: '#00ffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#000', fontWeight: '700' },
});
