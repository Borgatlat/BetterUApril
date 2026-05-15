import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  loadFutureuPlanArtifact,
  updateFutureuPlanChecklistItem,
} from '../utils/futureuPlanStorage';

/** Stripe + label colors: high = red, medium = yellow, low = green (per user request). */
function getPriorityTheme(priority) {
  const p = String(priority || '').toLowerCase().trim();
  if (p === 'high')
    return { stripe: '#dc2626', label: '#fca5a5', pillBg: 'rgba(220, 38, 38, 0.22)' };
  if (p === 'medium')
    return { stripe: '#ca8a04', label: '#fde047', pillBg: 'rgba(202, 138, 4, 0.25)' };
  if (p === 'low')
    return { stripe: '#16a34a', label: '#86efac', pillBg: 'rgba(22, 163, 74, 0.22)' };
  return { stripe: '#475569', label: '#94a3b8', pillBg: 'rgba(71, 85, 105, 0.25)' };
}

/**
 * Home / Future U "artifact" card: shows saved plan title, milestones summary, checklist with toggles.
 *
 * @param {object} props
 * @param {object | null | undefined} [props.externalPlan] — `undefined` = home screen (load from storage on focus). `null` or object = Future U syncs from parent / storage.
 * @param {(plan: object) => void} [props.onPlanChange] — called after checklist toggle so parent state stays in sync.
 * @param {boolean} [props.compact] — tighter padding when embedded under Future U header.
 * @param {string} [props.textColor] — optional theme from home.
 * @param {string} [props.subtextColor]
 * @param {boolean} [props.chatEmbed] — Future U: bubble-like card + scrollable checklist (max height).
 * @param {boolean} [props.hideOpenButton] — hide "Future U" link (e.g. already on that screen).
 * @param {boolean} [props.showPlansLibrary] — show "All plans" link (home only; off when chatEmbed).
 */
const UserPlan = ({
  externalPlan = undefined,
  onPlanChange,
  compact = false,
  textColor = '#f8fafc',
  subtextColor = '#94a3b8',
  chatEmbed = false,
  hideOpenButton = false,
  showPlansLibrary = true,
}) => {
  const router = useRouter();
  const [plan, setPlan] = useState(null);

  const refreshFromStorage = useCallback(async () => {
    const loaded = await loadFutureuPlanArtifact();
    setPlan(loaded);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (externalPlan !== undefined) {
      if (externalPlan && typeof externalPlan === 'object') {
        setPlan(externalPlan);
        return () => {
          cancelled = true;
        };
      }
      loadFutureuPlanArtifact().then((p) => {
        if (!cancelled) setPlan(p);
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [externalPlan]);

  useFocusEffect(
    useCallback(() => {
      if (externalPlan !== undefined) return;
      refreshFromStorage();
    }, [externalPlan, refreshFromStorage])
  );

  const toggleItem = async (itemId, current) => {
    const next = await updateFutureuPlanChecklistItem(itemId, !current);
    if (next) {
      setPlan(next);
      onPlanChange?.(next);
    }
  };

  if (!plan || typeof plan !== 'object') {
    return null;
  }

  const hasContent =
    !!(plan.plan_title && String(plan.plan_title).trim()) ||
    !!(plan.goal && String(plan.goal).trim()) ||
    (Array.isArray(plan.checklist) && plan.checklist.length > 0) ||
    (Array.isArray(plan.milestones) && plan.milestones.length > 0);
  if (!hasContent) {
    return null;
  }

  const title = plan.plan_title || plan.goal || 'Your Future U plan';
  const goal = plan.goal ? String(plan.goal) : '';
  const tf = plan.timeframe_days != null ? Number(plan.timeframe_days) : null;
  const checklist = Array.isArray(plan.checklist) ? plan.checklist : [];
  const milestones = Array.isArray(plan.milestones) ? plan.milestones : [];
  const ii =
    plan.implementation_intentions && typeof plan.implementation_intentions === 'object'
      ? plan.implementation_intentions
      : null;
  const iiQuestions = Array.isArray(ii?.questions_for_user) ? ii.questions_for_user : [];
  const iiIfThen = Array.isArray(ii?.suggested_if_then) ? ii.suggested_if_then : [];
  const iiCommitments = Array.isArray(ii?.user_commitments) ? ii.user_commitments : [];
  const iiSummary = ii?.summary ? String(ii.summary).trim() : '';
  const hasImplementationBlock =
    !!iiSummary || iiQuestions.length > 0 || iiIfThen.length > 0 || iiCommitments.length > 0;
  const done = checklist.filter((c) => c.completed).length;
  const total = checklist.length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const cardStyles = [
    styles.card,
    compact && styles.cardCompact,
    chatEmbed && styles.cardChatEmbed,
  ];

  const renderChecklistRows = () =>
    checklist.map((item) => {
      const pri = getPriorityTheme(item.priority);
      return (
        <TouchableOpacity
          key={String(item.id)}
          style={[styles.checkRow, chatEmbed && styles.checkRowEmbed]}
          onPress={() => toggleItem(item.id, item.completed)}
          activeOpacity={0.75}
        >
          <View style={[styles.priorityStripe, { backgroundColor: pri.stripe }]} />
          <Ionicons
            name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={chatEmbed ? 20 : 22}
            color={item.completed ? '#34d399' : '#64748b'}
          />
          <View style={styles.checkTextWrap}>
            <Text
              style={[
                styles.checkText,
                chatEmbed && styles.checkTextEmbed,
                { color: textColor },
                item.completed && styles.checkTextDone,
              ]}
            >
              {item.text || 'Untitled step'}
            </Text>
            {(item.due_day > 0 || item.priority) && (
              <View style={styles.checkMetaRow}>
                {item.due_day > 0 ? (
                  <Text style={[styles.checkMeta, { color: subtextColor }]}>Day {item.due_day}</Text>
                ) : null}
                {item.priority ? (
                  <View style={[styles.priorityPill, { backgroundColor: pri.pillBg }]}>
                    <Text style={[styles.priorityPillText, { color: pri.label }]}>
                      {String(item.priority).toLowerCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
            )}
          </View>
        </TouchableOpacity>
      );
    });

  return (
    <View style={chatEmbed ? styles.chatEmbedOuter : undefined}>
      {chatEmbed ? (
        <Text style={styles.chatEmbedCaption} numberOfLines={1}>
          Your plan
        </Text>
      ) : null}
      <View style={cardStyles}>
        <View style={[styles.cardHeader, chatEmbed && styles.cardHeaderEmbed]}>
          <View style={[styles.iconWrap, chatEmbed && styles.iconWrapEmbed]}>
            <Ionicons name="map" size={chatEmbed ? 18 : 22} color="#22d3ee" />
          </View>
          <View style={styles.headerText}>
            <Text
              style={[styles.title, chatEmbed && styles.titleEmbed, { color: textColor }]}
              numberOfLines={2}
            >
              {title}
            </Text>
            {goal ? (
              <Text
                style={[styles.subtitle, chatEmbed && styles.subtitleEmbed, { color: subtextColor }]}
                numberOfLines={2}
              >
                {goal}
                {tf != null && !Number.isNaN(tf) ? ` · ${tf} days` : ''}
              </Text>
            ) : tf != null && !Number.isNaN(tf) ? (
              <Text style={[styles.subtitle, { color: subtextColor }]}>{tf} day horizon</Text>
            ) : null}
          </View>
          {!hideOpenButton ? (
            <TouchableOpacity
              onPress={() => router.push('/Futureuai')}
              style={styles.openBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.openBtnText}>Future U</Text>
              <Ionicons name="chevron-forward" size={16} color="#c4b5fd" />
            </TouchableOpacity>
          ) : (
            <View style={styles.openBtnPlaceholder} />
          )}
        </View>

        {total > 0 && (
          <View style={[styles.progressRow, chatEmbed && styles.progressRowEmbed]}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
            </View>
            <Text style={[styles.progressLabel, { color: subtextColor }]}>
              {done}/{total}
            </Text>
          </View>
        )}

        {milestones.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.milestoneScroll, chatEmbed && styles.milestoneScrollEmbed]}
            nestedScrollEnabled
          >
            {milestones.slice(0, 8).map((m, i) => (
              <View key={m.id || `m-${i}`} style={[styles.milestoneChip, chatEmbed && styles.milestoneChipEmbed]}>
                <Text style={styles.milestoneTitle} numberOfLines={2}>
                  {m.title || `Phase ${i + 1}`}
                </Text>
                {m.start_day != null && m.end_day != null ? (
                  <Text style={styles.milestoneMeta}>
                    D{m.start_day}–D{m.end_day}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}

        {hasImplementationBlock ? (
          <View style={[styles.iiBlock, chatEmbed && styles.iiBlockEmbed]}>
            <View style={styles.iiHeaderRow}>
              <Ionicons name="flash-outline" size={16} color="#a78bfa" />
              <Text style={[styles.iiTitle, { color: textColor }]}>Implementation intentions</Text>
            </View>
            {iiSummary ? (
              <Text style={[styles.iiSummary, { color: subtextColor }]}>{iiSummary}</Text>
            ) : null}
            {iiQuestions.length > 0 ? (
              <View style={styles.iiList}>
                {iiQuestions.slice(0, 8).map((q, i) => (
                  <Text key={`iiq-${i}`} style={[styles.iiQuestionLine, { color: textColor }]}>
                    {i + 1}. {q}
                  </Text>
                ))}
              </View>
            ) : null}
            {iiIfThen.length > 0 ? (
              <View style={styles.iiIfThenWrap}>
                {iiIfThen.slice(0, 6).map((row, i) => (
                  <View key={`iit-${i}`} style={styles.iiIfThenCard}>
                    <Text style={[styles.iiIfLabel, { color: subtextColor }]}>If</Text>
                    <Text style={[styles.iiIfText, { color: textColor }]}>{row.if || '—'}</Text>
                    <Text style={[styles.iiThenLabel, { color: subtextColor }]}>Then</Text>
                    <Text style={[styles.iiThenText, { color: '#86efac' }]}>{row.then || '—'}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {iiCommitments.length > 0 ? (
              <View style={styles.iiCommitWrap}>
                <Text style={[styles.iiCommitLabel, { color: subtextColor }]}>Your commitments</Text>
                {iiCommitments.map((line, i) => (
                  <Text key={`iic-${i}`} style={[styles.iiCommitLine, { color: textColor }]}>
                    • {line}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {checklist.length > 0 ? (
          chatEmbed ? (
            <ScrollView
              style={styles.checklistScroll}
              contentContainerStyle={styles.checklistScrollContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {renderChecklistRows()}
            </ScrollView>
          ) : (
            <View style={styles.checklist}>{renderChecklistRows()}</View>
          )
        ) : null}

        {!chatEmbed && showPlansLibrary ? (
          <TouchableOpacity
            style={styles.plansLibraryRow}
            onPress={() => router.push('/(modals)/ViewPlansModal')}
            activeOpacity={0.8}
          >
            <Ionicons name="list-outline" size={18} color="#22d3ee" />
            <Text style={[styles.plansLibraryText, { color: textColor }]}>All plans</Text>
            <Ionicons name="chevron-forward" size={18} color="#64748b" />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export default UserPlan;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(24, 24, 32, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  cardCompact: {
    marginHorizontal: 0,
    marginBottom: 10,
  },
  chatEmbedOuter: {
    marginBottom: 6,
  },
  chatEmbedCaption: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardChatEmbed: {
    marginBottom: 4,
    padding: 11,
    borderRadius: 20,
    borderTopLeftRadius: 6,
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 211, 238, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openBtnPlaceholder: { width: 8 },
  openBtnText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  cardHeaderEmbed: { alignItems: 'flex-start' },
  iconWrapEmbed: {
    width: 34,
    height: 34,
    borderRadius: 10,
  },
  titleEmbed: { fontSize: 15 },
  subtitleEmbed: { fontSize: 11, marginTop: 1 },
  progressRowEmbed: { marginTop: 8 },
  milestoneScrollEmbed: { marginTop: 8, maxHeight: 64 },
  milestoneChipEmbed: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    maxWidth: 140,
  },
  checklistScroll: {
    marginTop: 8,
    maxHeight: 200,
  },
  checklistScrollContent: {
    paddingBottom: 4,
    gap: 4,
  },
  checkRowEmbed: {
    paddingVertical: 3,
    gap: 8,
  },
  checkTextEmbed: {
    fontSize: 13,
    lineHeight: 18,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#22d3ee',
  },
  progressLabel: { fontSize: 11, fontWeight: '600', width: 72, textAlign: 'right' },
  milestoneScroll: { marginTop: 12, maxHeight: 72 },
  milestoneChip: {
    maxWidth: 160,
    marginRight: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(196, 181, 253, 0.3)',
  },
  milestoneTitle: { color: '#e2e8f0', fontSize: 12, fontWeight: '700' },
  milestoneMeta: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  iiBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.35)',
  },
  iiBlockEmbed: {
    marginTop: 8,
    paddingTop: 8,
  },
  iiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  iiTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  iiSummary: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  iiList: {
    gap: 4,
    marginBottom: 8,
  },
  iiQuestionLine: {
    fontSize: 12,
    lineHeight: 17,
  },
  iiIfThenWrap: {
    gap: 8,
    marginBottom: 8,
  },
  iiIfThenCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderRadius: 10,
    padding: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(139, 92, 246, 0.35)',
  },
  iiIfLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  iiIfText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  iiThenLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  iiThenText: {
    fontSize: 12,
    lineHeight: 16,
  },
  iiCommitWrap: {
    marginTop: 4,
  },
  iiCommitLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  iiCommitLine: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 2,
  },
  checklist: { marginTop: 12, gap: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  priorityStripe: {
    width: 4,
    borderRadius: 2,
    marginTop: 3,
    minHeight: 22,
    alignSelf: 'flex-start',
  },
  checkTextWrap: { flex: 1 },
  checkText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  checkTextDone: { opacity: 0.55, textDecorationLine: 'line-through' },
  checkMeta: { fontSize: 11, marginTop: 2 },
  checkMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  plansLibraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.25)',
  },
  plansLibraryText: { flex: 1, fontSize: 14, fontWeight: '700' },
});
