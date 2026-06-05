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
 * @param {boolean} [props.chatEmbed] — Future U chat bubble style (legacy; use variant="chatEmbed").
 * @param {'full'|'home'|'library'|'chatEmbed'} [props.variant] — layout preset (home = compact on Home screen).
 * @param {string} [props.accentColor] — progress / accents on home variant.
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
  variant = 'full',
  accentColor = '#22d3ee',
  hideOpenButton = false,
  showPlansLibrary = true,
}) => {
  const router = useRouter();
  const [plan, setPlan] = useState(null);
  const resolvedVariant = chatEmbed ? 'chatEmbed' : variant;
  const isHome = resolvedVariant === 'home';
  const isLibrary = resolvedVariant === 'library';
  const isChatEmbed = resolvedVariant === 'chatEmbed';
  const showImplementation = !isHome && !isLibrary && !isChatEmbed;
  const showMilestones = !isHome && !isChatEmbed;
  // Nested scroll inside chat FlatList feels cramped — let the chat list scroll instead.
  const checklistScroll = false;

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

  const visibleChecklist = (() => {
    if (isHome) {
      // Keep completed steps visible so a mis-tap can be undone (tap again to uncheck).
      const sorted = [...checklist].sort((a, b) => {
        const aDone = !!a.completed;
        const bDone = !!b.completed;
        if (aDone !== bDone) return aDone ? 1 : -1;
        return (Number(a.due_day) || 0) - (Number(b.due_day) || 0);
      });
      return sorted.slice(0, 5);
    }
    return checklist;
  })();

  const cardStyles = [
    styles.card,
    compact && styles.cardCompact,
    isChatEmbed && styles.cardChatEmbed,
    isHome && styles.cardHome,
    isLibrary && styles.cardLibrary,
  ];

  const renderChecklistRows = (items) =>
    items.map((item) => {
      const pri = getPriorityTheme(item.priority);
      return (
        <TouchableOpacity
          key={String(item.id)}
          style={[
            styles.checkRow,
            isChatEmbed && styles.checkRowEmbed,
            (isHome || isLibrary) && styles.checkRowLarge,
          ]}
          onPress={() => toggleItem(item.id, item.completed)}
          activeOpacity={0.75}
        >
          <View style={[styles.priorityStripe, { backgroundColor: pri.stripe }]} />
          <Ionicons
            name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={isHome || isLibrary ? 24 : isChatEmbed ? 22 : 22}
            color={item.completed ? '#34d399' : '#64748b'}
          />
          <View style={styles.checkTextWrap}>
            <Text
              style={[
                styles.checkText,
                isChatEmbed && styles.checkTextEmbed,
                (isHome || isLibrary) && styles.checkTextLarge,
                { color: textColor },
                item.completed && styles.checkTextDone,
              ]}
            >
              {item.text || 'Untitled step'}
            </Text>
            {!isHome && (item.due_day > 0 || item.priority) ? (
              <View style={styles.checkMetaRow}>
                {item.due_day > 0 ? (
                  <Text style={[styles.checkMeta, { color: subtextColor }]}>Day {item.due_day}</Text>
                ) : null}
                {item.priority && !isLibrary ? (
                  <View style={[styles.priorityPill, { backgroundColor: pri.pillBg }]}>
                    <Text style={[styles.priorityPillText, { color: pri.label }]}>
                      {String(item.priority).toLowerCase()}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : isHome && item.due_day > 0 ? (
              <Text style={[styles.checkMeta, { color: subtextColor }]}>Day {item.due_day}</Text>
            ) : null}
            {(isHome || isLibrary || isChatEmbed) && item.completed ? (
              <Text style={[styles.undoHint, { color: subtextColor }]}>Tap to undo</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    });

  return (
    <View style={isChatEmbed ? styles.chatEmbedOuter : undefined}>
      {isChatEmbed ? (
        <Text style={styles.chatEmbedCaption} numberOfLines={1}>
          Your plan
        </Text>
      ) : null}
      <View style={cardStyles}>
        <View style={[styles.cardHeader, isChatEmbed && styles.cardHeaderEmbed]}>
          <View
            style={[
              styles.iconWrap,
              isChatEmbed && styles.iconWrapEmbed,
              isHome && { backgroundColor: `${accentColor}22` },
            ]}
          >
            <Ionicons name="map" size={isChatEmbed ? 18 : isHome ? 20 : 22} color={accentColor} />
          </View>
          <View style={styles.headerText}>
            <Text
              style={[
                styles.title,
                isChatEmbed && styles.titleEmbed,
                isHome && styles.titleHome,
                { color: textColor },
              ]}
              numberOfLines={isHome ? 2 : 2}
            >
              {title}
            </Text>
            {!isHome && goal ? (
              <Text
                style={[styles.subtitle, isChatEmbed && styles.subtitleEmbed, { color: subtextColor }]}
                numberOfLines={2}
              >
                {goal}
                {tf != null && !Number.isNaN(tf) ? ` · ${tf} days` : ''}
              </Text>
            ) : isHome && tf != null && !Number.isNaN(tf) ? (
              <Text style={[styles.subtitle, { color: subtextColor }]}>{tf}-day plan</Text>
            ) : null}
          </View>
          {!hideOpenButton && !isHome && !isLibrary ? (
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
          <View style={[styles.progressRow, isChatEmbed && styles.progressRowEmbed]}>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progressPct}%`, backgroundColor: accentColor }]}
              />
            </View>
            <Text style={[styles.progressLabel, { color: subtextColor }]}>
              {isHome ? `${progressPct}%` : `${done}/${total}`}
            </Text>
          </View>
        )}

        {showMilestones && milestones.length > 0 && !isLibrary ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.milestoneScroll, isChatEmbed && styles.milestoneScrollEmbed]}
            nestedScrollEnabled
          >
            {milestones.slice(0, 8).map((m, i) => (
              <View
                key={m.id || `m-${i}`}
                style={[styles.milestoneChip, isChatEmbed && styles.milestoneChipEmbed]}
              >
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
        ) : null}

        {isLibrary && milestones.length > 0 ? (
          <Text style={[styles.libraryMeta, { color: subtextColor }]}>
            {milestones.length} milestone{milestones.length === 1 ? '' : 's'} · {total} step
            {total === 1 ? '' : 's'}
          </Text>
        ) : null}

        {showImplementation && hasImplementationBlock ? (
          <View style={[styles.iiBlock, isChatEmbed && styles.iiBlockEmbed]}>
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

        {visibleChecklist.length > 0 ? (
          checklistScroll ? (
            <ScrollView
              style={styles.checklistScroll}
              contentContainerStyle={styles.checklistScrollContent}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {renderChecklistRows(visibleChecklist)}
            </ScrollView>
          ) : (
            <View style={[styles.checklist, isHome && styles.checklistHome, isChatEmbed && styles.checklistChatEmbed]}>
              {renderChecklistRows(visibleChecklist)}
            </View>
          )
        ) : null}

        {isHome && total > visibleChecklist.length ? (
          <Text style={[styles.moreStepsHint, { color: subtextColor }]}>
            +{total - visibleChecklist.length} more in Future U
          </Text>
        ) : null}

        {!isChatEmbed && !isHome && !isLibrary && showPlansLibrary ? (
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
  cardHome: {
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(139, 92, 246, 0.22)',
  },
  cardLibrary: {
    marginHorizontal: 16,
    marginBottom: 0,
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
  chatEmbedOuter: {
    marginBottom: 0,
    width: '100%',
  },
  chatEmbedCaption: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardChatEmbed: {
    marginHorizontal: 0,
    marginBottom: 0,
    padding: 16,
    borderRadius: 18,
    borderTopLeftRadius: 18,
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(18, 18, 28, 0.98)',
    borderColor: 'rgba(34, 211, 238, 0.28)',
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
  titleHome: { fontSize: 17, lineHeight: 22 },
  subtitle: { fontSize: 12, marginTop: 2 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  openBtnPlaceholder: { width: 8 },
  openBtnText: { color: '#c4b5fd', fontSize: 12, fontWeight: '700' },
  cardHeaderEmbed: { alignItems: 'flex-start' },
  iconWrapEmbed: {
    width: 38,
    height: 38,
    borderRadius: 11,
  },
  titleEmbed: { fontSize: 17, lineHeight: 23 },
  subtitleEmbed: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  progressRowEmbed: { marginTop: 12, marginBottom: 4 },
  milestoneScrollEmbed: { marginTop: 8, maxHeight: 64 },
  milestoneChipEmbed: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    maxWidth: 140,
  },
  checklistScroll: {
    marginTop: 8,
    maxHeight: 320,
  },
  checklistScrollContent: {
    paddingBottom: 4,
    gap: 4,
  },
  checkRowEmbed: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    gap: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginBottom: 6,
  },
  checkTextEmbed: {
    fontSize: 15,
    lineHeight: 22,
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
  checklistHome: { marginTop: 14, gap: 6 },
  checklistChatEmbed: { marginTop: 14, gap: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4 },
  checkRowLarge: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  priorityStripe: {
    width: 4,
    borderRadius: 2,
    marginTop: 3,
    minHeight: 22,
    alignSelf: 'flex-start',
  },
  checkTextWrap: { flex: 1 },
  checkText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  checkTextLarge: { fontSize: 15, lineHeight: 22 },
  checkTextDone: { opacity: 0.55, textDecorationLine: 'line-through' },
  moreStepsHint: { fontSize: 12, marginTop: 8, fontWeight: '600' },
  libraryMeta: { fontSize: 12, marginTop: 10, fontWeight: '600' },
  checkMeta: { fontSize: 11, marginTop: 2 },
  undoHint: { fontSize: 11, marginTop: 4, fontStyle: 'italic' },
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
