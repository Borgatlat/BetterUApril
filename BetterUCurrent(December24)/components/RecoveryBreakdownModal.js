/**
 * RecoveryBreakdownModal – Shows what's dragging the score down and what's bringing it up.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getScoreColor(score) {
  if (score >= 70) return '#00e676';
  if (score >= 40) return '#ffca28';
  return '#ff7043';
}

export function RecoveryBreakdownModal({
  visible,
  onClose,
  score,
  hoursToRecoverLabel,
  breakdown,
  onWhatShouldIDo,
}) {
  const color = getScoreColor(score ?? 0);
  const { draggingDown = [], bringingUp = [] } = breakdown || {};

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.container}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>Recovery Score</Text>
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.closeBtn}
                  hitSlop={16}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              </View>

              <View style={styles.scoreSection}>
                <Text style={[styles.scoreValue, { color }]}>{Math.round(score ?? 0)}</Text>
                <Text style={styles.recoverLabel}>Recover: {hoursToRecoverLabel}</Text>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {draggingDown.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="trending-down" size={18} color="#ff7043" />
                      <Text style={styles.sectionTitle}>Bringing it down</Text>
                    </View>
                    {draggingDown.map((item, i) => (
                      <View key={i} style={styles.row}>
                        <View style={styles.rowContent}>
                          <Text style={styles.rowLabel}>{item.label}</Text>
                          <Text style={styles.rowDetail}>{item.detail}</Text>
                        </View>
                        <Text style={styles.rowImpact}>−{item.impact}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {bringingUp.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="trending-up" size={18} color="#00e676" />
                      <Text style={styles.sectionTitle}>Bringing it up</Text>
                    </View>
                    {bringingUp.map((item, i) => (
                      <View key={i} style={styles.row}>
                        <View style={styles.rowContent}>
                          <Text style={styles.rowLabel}>{item.label}</Text>
                          <Text style={styles.rowDetail}>{item.detail}</Text>
                        </View>
                        <Text style={[styles.rowImpact, { color: '#00e676' }]}>+{item.impact}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {draggingDown.length === 0 && bringingUp.length === 0 && (
                  <Text style={styles.emptyText}>No recent activity affecting your score.</Text>
                )}
              </ScrollView>

              {onWhatShouldIDo && (
                <TouchableOpacity
                  style={[styles.cta, { backgroundColor: color }]}
                  onPress={onWhatShouldIDo}
                  activeOpacity={0.85}
                >
                  <Ionicons name="sparkles" size={18} color="#000" />
                  <Text style={styles.ctaText}>What should I do?</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
  },
  sheet: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    padding: 4,
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '800',
  },
  recoverLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  scroll: {
    maxHeight: 280,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 8,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  rowDetail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  rowImpact: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ff7043',
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
});
