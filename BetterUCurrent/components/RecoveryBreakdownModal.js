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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.85, 560);
const SCROLL_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.42, 300);

function getScoreColor(score) {
  if (score >= 90) return '#00e676';
  if (score >= 70) return '#ffca28';
  if (score >= 50) return '#ff7043';
  return '#ff7043';
}

export function RecoveryBreakdownModal({
  visible,
  onClose,
  score,
  hoursToRecoverLabel,
  breakdown,
  onWhatShouldIDo,
  onViewRecoveryMap,
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
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={onClose}
          accessibilityLabel="Close recovery breakdown"
          accessibilityRole="button"
        />

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
            showsVerticalScrollIndicator
            nestedScrollEnabled
            bounces
            keyboardShouldPersistTaps="handled"
          >
            {draggingDown.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="trending-down" size={18} color="#ff7043" />
                  <Text style={styles.sectionTitle}>Bringing it down</Text>
                </View>
                {draggingDown.map((item, i) => (
                  <View key={`down-${item.label}-${i}`} style={styles.row}>
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
                  <View key={`up-${item.label}-${i}`} style={styles.row}>
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

          {onViewRecoveryMap && (
            <TouchableOpacity
              style={styles.secondaryCta}
              onPress={onViewRecoveryMap}
              activeOpacity={0.85}
            >
              <Ionicons name="body" size={18} color="#00ffff" />
              <Text style={styles.secondaryCtaText}>View muscle recovery map</Text>
            </TouchableOpacity>
          )}

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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  overlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    width: '100%',
    maxWidth: 400,
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#111',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    zIndex: 1,
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
    marginBottom: 16,
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
    maxHeight: SCROLL_MAX_HEIGHT,
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 8,
    flexGrow: 1,
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
    marginRight: 8,
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
  },
  emptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingVertical: 24,
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
    backgroundColor: 'rgba(0,255,255,0.06)',
  },
  secondaryCtaText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#00ffff',
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
