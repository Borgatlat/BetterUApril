import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function CrisisRow({ icon, label, hint, onPress, accent = '#00ffff' }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <View style={[styles.rowIcon, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={styles.rowTextCol}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color="#666" />
    </TouchableOpacity>
  );
}

/**
 * B2C crisis resources — tap-to-call 988 and Crisis Text Line.
 * Eleos is support, not emergency care; this card makes that distinction clear.
 */
export function B2CCrisisSupportCard({ accentColor = '#00ffff' }) {
  return (
    <View style={[styles.card, { borderColor: `${accentColor}33` }]}>
      <View style={styles.headerRow}>
        <Ionicons name="heart-circle" size={22} color="#ff6b6b" />
        <Text style={styles.title}>Need help right now?</Text>
      </View>
      <Text style={styles.sub}>
        If you or someone else is in danger, call emergency services. These lines are free and confidential.
      </Text>
      <Text style={styles.disclaimer}>
        Eleos (AI therapist) is not a replacement for professional or crisis care.
      </Text>
      <CrisisRow
        icon="call"
        label="988 — Suicide & Crisis Lifeline"
        hint="Call or text 988 (US)"
        accent="#ff6b6b"
        onPress={() => Linking.openURL('tel:988')}
      />
      <CrisisRow
        icon="chatbubble-ellipses"
        label="Crisis Text Line"
        hint="Text HOME to 741741"
        accent={accentColor}
        onPress={() => Linking.openURL('sms:741741&body=HOME')}
      />
      <CrisisRow
        icon="globe-outline"
        label="SAMHSA treatment locator"
        hint="Find local support"
        accent={accentColor}
        onPress={() => Linking.openURL('https://www.samhsa.gov/find-help/988')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  sub: { color: '#aaa', fontSize: 13, lineHeight: 19, marginBottom: 8 },
  disclaimer: { color: '#888', fontSize: 12, fontStyle: 'italic', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextCol: { flex: 1 },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowHint: { color: '#888', fontSize: 12, marginTop: 2 },
});
