import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Converts duration in minutes to a readable string like "7h 30m"
const formatDuration = (minutes) => {
  if (!minutes) return '--';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// Parses "HH:mm" or "H:mm" string to minutes since midnight (for duration calculation)
const timeToMinutes = (timeStr) => {
  if (!timeStr || !timeStr.trim()) return null;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) return null;
  return h * 60 + m;
};

export function SleepTracker({
  sleep,
  logSleep,
  cardBg,
  cardBorder,
  textColor,
  textSecondary,
  accentColor = '#00ffff'
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [bedtime, setBedtime] = useState(sleep?.bedtime || '');
  const [waketime, setWaketime] = useState(sleep?.waketime || '');
  const [quality, setQuality] = useState(sleep?.quality ?? null);
  // While true, Save is disabled — avoids double-taps and shows that Supabase work is in progress.
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setBedtime(sleep?.bedtime || '');
    setWaketime(sleep?.waketime || '');
    setQuality(sleep?.quality ?? null);
    setModalVisible(true);
  };

  const handleSave = async () => {
    const bedMins = timeToMinutes(bedtime);
    const wakeMins = timeToMinutes(waketime);
    let duration_minutes = 0;
    if (bedMins != null && wakeMins != null) {
      // Handle overnight: e.g. 23:00 to 07:00 = 8h
      duration_minutes = wakeMins > bedMins
        ? wakeMins - bedMins
        : (24 * 60 - bedMins) + wakeMins;
    }
    setSaving(true);
    // logSleep lives in TrackingContext: it upserts into Supabase table `sleep_tracking` and updates React state.
    // It returns true only if the database write succeeded (and you are signed in with a profile id).
    const ok = await logSleep({
      bedtime: bedtime.trim() || null,
      waketime: waketime.trim() || null,
      duration_minutes,
      quality: quality ?? null
    });
    setSaving(false);
    if (!ok) {
      Alert.alert(
        'Could not save sleep',
        'Make sure you are signed in and online. If you just set up the app, run the sleep_tracking migration in Supabase so the table exists.'
      );
      return;
    }
    setModalVisible(false);
  };

  const qualityOptions = [1, 2, 3, 4, 5];

  return (
    <>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: textColor }]}>Sleep</Text>
          <TouchableOpacity onPress={openModal} style={styles.logButton}>
            <Ionicons name="bed-outline" size={18} color={accentColor} />
            <Text style={[styles.logButtonText, { color: accentColor }]}>
              {sleep ? 'Edit' : 'Log sleep'}
            </Text>
          </TouchableOpacity>
        </View>
        {sleep ? (
          <>
            <Text style={[styles.duration, { color: textColor }]}>
              {formatDuration(sleep.duration_minutes)}
            </Text>
            <View style={styles.bar}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.min(100, (sleep.duration_minutes / 480) * 100)}%`,
                    backgroundColor: accentColor
                  }
                ]}
              />
            </View>
            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: textColor }]}>{sleep.bedtime || '--'}</Text>
                <Text style={[styles.statLabel, { color: textSecondary }]}>Bed</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: textColor }]}>{sleep.waketime || '--'}</Text>
                <Text style={[styles.statLabel, { color: textSecondary }]}>Wake</Text>
              </View>
              {sleep.quality != null && (
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: textColor }]}>{sleep.quality}/5</Text>
                  <Text style={[styles.statLabel, { color: textSecondary }]}>Quality</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <Text style={[styles.placeholder, { color: textSecondary }]}>
            Tap "Log sleep" to record last night
          </Text>
        )}
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Log last night&apos;s sleep</Text>
            <Text style={[styles.hint, { color: textSecondary }]}>Use 24h format, e.g. 23:00 or 7:30</Text>
            <TextInput
              style={[styles.input, { color: textColor, borderColor: cardBorder }]}
              placeholder="Bedtime (e.g. 23:00)"
              placeholderTextColor={textSecondary}
              value={bedtime}
              onChangeText={setBedtime}
            />
            <TextInput
              style={[styles.input, { color: textColor, borderColor: cardBorder }]}
              placeholder="Waketime (e.g. 7:30)"
              placeholderTextColor={textSecondary}
              value={waketime}
              onChangeText={setWaketime}
            />
            <Text style={[styles.qualityLabel, { color: textSecondary }]}>Quality (optional)</Text>
            <View style={styles.qualityRow}>
              {qualityOptions.map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setQuality(quality === n ? null : n)}
                  style={[
                    styles.qualityBtn,
                    { borderColor: cardBorder },
                    quality === n && { backgroundColor: accentColor, borderColor: accentColor }
                  ]}
                >
                  <Text style={[styles.qualityBtnText, { color: quality === n ? '#000' : textColor }]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, { borderColor: cardBorder }]} onPress={() => setModalVisible(false)}>
                <Text style={[styles.modalButtonText, { color: textColor }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: accentColor }, saving && styles.modalButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: '#000' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '600' },
  logButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logButtonText: { fontSize: 14 },
  duration: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#1a1a1a', overflow: 'hidden', marginBottom: 12 },
  barFill: { height: '100%', borderRadius: 4 },
  stats: { flexDirection: 'row', gap: 16 },
  statItem: {},
  statValue: { fontSize: 16, fontWeight: '600' },
  statLabel: { fontSize: 12, color: '#888' },
  placeholder: { fontSize: 14, marginTop: 4 },
  // Backdrop behind the sheet: fourth number is opacity (0.8 = 80% opaque black, darker than 0.6).
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 24 },
  modalContent: { borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  qualityLabel: { fontSize: 12, marginBottom: 8 },
  qualityRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  qualityBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qualityBtnText: { fontSize: 16, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, borderWidth: 1, minWidth: 100, alignItems: 'center' },
  modalButtonDisabled: { opacity: 0.7 },
  modalButtonText: { fontSize: 16, fontWeight: '600' }
});
