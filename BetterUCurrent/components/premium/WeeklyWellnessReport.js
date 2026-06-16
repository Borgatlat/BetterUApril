import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getWeeklyWellnessReport } from '../../utils/weeklyWellnessReport';
import { navigateToPremiumPaywall } from '../../lib/premiumConversion';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_MAX_HEIGHT = Math.min(SCREEN_HEIGHT * 0.88, 640);

function ReportBody({ report, accentColor, onNavigate }) {
  const router = useRouter();

  const go = (route) => {
    onNavigate?.();
    if (route) router.push(route);
  };

  return (
    <>
      <Text style={styles.insight}>{report.insight}</Text>

      {report.wins?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Wins</Text>
          {report.wins.map((w) => (
            <View key={w} style={styles.winRow}>
              <Ionicons name="checkmark-circle" size={14} color="#00ff64" />
              <Text style={styles.winText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {report.problems?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Gaps to fix</Text>
          {report.problems.map((p) => (
            <View key={p} style={styles.problemRow}>
              <Ionicons name="alert-circle" size={14} color="#ff8844" />
              <Text style={styles.problemText}>{p}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.statRow}>
        {report.highlights.map((h) => (
          <View key={h.label} style={styles.pill}>
            <Ionicons name={h.icon} size={16} color={h.color} />
            <Text style={styles.pillValue}>{h.value}</Text>
            <Text style={styles.pillLabel}>{h.label}</Text>
          </View>
        ))}
      </View>

      {report.actionPlan?.length > 0 && (
        <View style={styles.actionBlock}>
          <Text style={styles.sectionLabel}>Do this next</Text>
          {report.actionPlan.map((step, i) => (
            <TouchableOpacity
              key={step.text}
              style={styles.actionRow}
              onPress={() => go(step.route)}
              disabled={!step.route}
              activeOpacity={0.75}
            >
              <Text style={styles.actionNum}>{i + 1}</Text>
              <Text style={styles.actionText}>{step.text}</Text>
              {step.route ? <Ionicons name="arrow-forward" size={14} color="#00ffff" /> : null}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[styles.footerText, { color: accentColor }]}>
        {report.deltaTotal >= 0 ? '+' : ''}
        {report.deltaTotal} vs last week · {report.streak} day streak
      </Text>
    </>
  );
}

/**
 * Home row button → modal with full weekly digest (Premium).
 * Non-premium row opens the paywall.
 */
export function WeeklyWellnessReport({ userId, isPremium, accentColor = '#FFD700' }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId || !isPremium) {
      setLoading(false);
      setReport(null);
      return undefined;
    }
    setLoading(true);
    (async () => {
      const data = await getWeeklyWellnessReport(userId);
      if (!cancelled) {
        setReport(data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, isPremium]);

  const open = () => {
    if (!isPremium) {
      navigateToPremiumPaywall(router, 'wellness_report');
      return;
    }
    if (loading || !report) return;
    setModalOpen(true);
  };

  const hint = !isPremium
    ? 'See what worked, what slipped, and what to do next'
    : loading
      ? 'Loading your report…'
      : report?.insight
        ? report.insight
        : 'Tap to view your weekly wellness summary';

  return (
    <>
      <TouchableOpacity
        style={[
          styles.button,
          !isPremium && styles.buttonLocked,
          isPremium && { borderColor: `${accentColor}33` },
        ]}
        onPress={open}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Weekly wellness report"
      >
        <View style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
          {loading && isPremium ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Ionicons name="document-text" size={20} color={accentColor} />
          )}
        </View>
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Weekly report</Text>
            {isPremium ? (
              <View style={styles.premiumPill}>
                <Text style={styles.premiumPillText}>Premium</Text>
              </View>
            ) : (
              <Ionicons name="lock-closed" size={14} color="#888" />
            )}
          </View>
          <Text style={styles.hint} numberOfLines={2}>
            {hint}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#666" />
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.overlayTouchable}
            activeOpacity={1}
            onPress={() => setModalOpen(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderLeft}>
                <Ionicons name="document-text" size={22} color={accentColor} />
                <Text style={styles.sheetTitle}>Your weekly report</Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalOpen(false)}
                hitSlop={16}
                accessibilityLabel="Close weekly report"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator
            >
              {report ? (
                <ReportBody
                  report={report}
                  accentColor={accentColor}
                  onNavigate={() => setModalOpen(false)}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  buttonLocked: {
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  title: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  hint: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sheetTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  scroll: {
    maxHeight: SHEET_MAX_HEIGHT - 72,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  premiumPill: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  premiumPillText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '800',
  },
  insight: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  section: {
    marginBottom: 10,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  winRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  winText: {
    color: '#bbb',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  problemRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  problemText: {
    color: '#ffaa88',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
    marginTop: 4,
  },
  pill: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 2,
  },
  pillValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  pillLabel: {
    color: '#888',
    fontSize: 10,
  },
  actionBlock: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  actionNum: {
    color: '#00ffff',
    fontWeight: '800',
    width: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
});
