import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Plan-intake card for Future U: same fields as the old header (goal + days + hrs/wk),
 * styled to match the purple / cyan chat UI. Parent owns all state; this only renders
 * and calls onSubmit when the user taps Save. onSkip dismisses the card without saving.
 */
export default function QuestionsArtifact({
  goal = '',
  timeFrameDays = '',
  hoursPerWeek = '',
  onChangeGoal,
  onChangeTimeFrameDays,
  onChangeHoursPerWeek,
  onSubmit,
  onSkip,
  disabled = false,
}) {
  return (
    <View style={localStyles.outer}>
      <LinearGradient
        colors={['rgba(139, 92, 246, 0.35)', 'rgba(34, 211, 238, 0.12)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={localStyles.gradientBorder}
      >
        <View style={localStyles.card}>
          <View style={localStyles.cardHeader}>
            <Ionicons name="clipboard-outline" size={22} color="#22d3ee" />
            <Text style={localStyles.cardTitle}>Shape your plan</Text>
          </View>
          <Text style={localStyles.cardSubtitle}>
            Answer these so Future U can match timelines and weekly effort to your goal.
          </Text>

          <View style={localStyles.fieldColumn}>
            <Text style={localStyles.label}>Goal (optional)</Text>
            <TextInput
              style={localStyles.input}
              placeholder="e.g. Become a software engineer"
              placeholderTextColor="#64748b"
              value={goal}
              onChangeText={onChangeGoal}
              maxLength={200}
              editable={!disabled}
            />

            <Text style={localStyles.label}>Days to complete</Text>
            <TextInput
              style={localStyles.input}
              placeholder="How many days for this goal? (e.g. 90)"
              placeholderTextColor="#64748b"
              value={String(timeFrameDays)}
              onChangeText={onChangeTimeFrameDays}
              keyboardType="number-pad"
              editable={!disabled}
            />

            <Text style={localStyles.label}>Hours per week</Text>
            <TextInput
              style={localStyles.input}
              placeholder="How many hours per week can you commit? (e.g. 7)"
              placeholderTextColor="#64748b"
              value={String(hoursPerWeek)}
              onChangeText={onChangeHoursPerWeek}
              keyboardType="number-pad"
              editable={!disabled}
            />
          </View>

          <TouchableOpacity
            style={[localStyles.saveBtn, disabled && localStyles.saveBtnDisabled]}
            onPress={onSubmit}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#8b5cf6', '#6366f1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={localStyles.saveBtnGradient}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
              <Text style={localStyles.saveBtnText}>Save and use for my plan</Text>
            </LinearGradient>
          </TouchableOpacity>

          {typeof onSkip === 'function' ? (
            <TouchableOpacity
              style={[localStyles.skipBtn, disabled && localStyles.skipBtnDisabled]}
              onPress={onSkip}
              disabled={disabled}
              activeOpacity={0.75}
              accessibilityLabel="Skip for now"
            >
              <Ionicons name="arrow-forward-circle-outline" size={18} color="#94a3b8" />
              <Text style={localStyles.skipBtnText}>Skip for now</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const localStyles = StyleSheet.create({
  outer: {
    marginTop: 12,
    marginBottom: 8,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },
  gradientBorder: {
    borderRadius: 16,
    padding: 1.5,
  },
  card: {
    backgroundColor: 'rgba(15, 12, 28, 0.96)',
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  cardTitle: {
    color: '#f5f3ff',
    fontSize: 17,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  /** Column stack: each label sits above its field (readable “form” layout). */
  fieldColumn: {
    flexDirection: 'column',
    gap: 4,
  },
  label: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 15,
  },
  saveBtn: {
    marginTop: 18,
    borderRadius: 14,
    overflow: 'hidden',
  },
  saveBtnDisabled: {
    opacity: 0.45,
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  skipBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  skipBtnDisabled: {
    opacity: 0.45,
  },
  skipBtnText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});
