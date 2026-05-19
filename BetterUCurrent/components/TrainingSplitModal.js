import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const SPLIT_SECTION_TITLES = {
  ppl: 'Push / Pull / Legs (PPL)',
  upper_lower_ppl: 'Upper / Lower + PPL',
  upper_lower: 'Upper / Lower',
  full_body: 'Full Body',
  bro_split: 'Bro split',
};

const getSplitBaseId = (splitId) => {
  if (!splitId || splitId === 'custom') return 'custom';
  return String(splitId).replace(/_\d+$/, '');
};

/**
 * Full-screen bottom sheet for choosing training split style, frequency, and browsing all variants.
 */
export default function TrainingSplitModal({
  visible,
  onClose,
  effectiveSplit,
  visibleSplitOptions = [],
  frequencyVariantsForSplit = [],
  allSplitOptions = [],
  selectedSplit,
  onSelectSplit,
  onEditCustomWeek,
  todaySplitLabel = '—',
}) {
  const insets = useSafeAreaInsets();

  const isSelected = (opt) =>
    selectedSplit &&
    (typeof selectedSplit === 'object' ? selectedSplit.id === opt.id : selectedSplit === opt.id);

  const customOption = useMemo(
    () => allSplitOptions.find((o) => o.id === 'custom'),
    [allSplitOptions]
  );

  const groupedSections = useMemo(() => {
    const order = ['ppl', 'upper_lower_ppl', 'upper_lower', 'full_body', 'bro_split'];
    const byBase = {};
    for (const opt of allSplitOptions) {
      if (opt.id === 'custom') continue;
      const base = opt.baseId || getSplitBaseId(opt.id);
      if (!byBase[base]) byBase[base] = [];
      byBase[base].push(opt);
    }
    for (const base of Object.keys(byBase)) {
      byBase[base].sort((a, b) => (a.frequency || 0) - (b.frequency || 0));
    }
    return order
      .filter((base) => byBase[base]?.length)
      .map((base) => ({
        base,
        title: SPLIT_SECTION_TITLES[base] || base,
        options: byBase[base],
      }));
  }, [allSplitOptions]);

  const isCustom = getSplitBaseId(effectiveSplit?.id) === 'custom';
  const summaryLabel =
    effectiveSplit?.shortLabel || effectiveSplit?.chipLabel || effectiveSplit?.label || 'Not set';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Training split</Text>
              <Text style={styles.subtitle}>
                Today: {todaySplitLabel} · {summaryLabel}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Split style</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {visibleSplitOptions.map((opt) => {
                const active = getSplitBaseId(effectiveSplit?.id) === getSplitBaseId(opt.id);
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => onSelectSplit?.(opt)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.chipLabel || opt.shortLabel || opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {frequencyVariantsForSplit.length > 1 && (
              <>
                <Text style={styles.label}>Days per week</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipRow}
                >
                  {frequencyVariantsForSplit.map((opt) => {
                    const active = effectiveSplit?.id === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.chip, styles.freqChip, active && styles.chipActive]}
                        onPress={() => onSelectSplit?.(opt)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {opt.frequency}×
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {isCustom && (
              <TouchableOpacity style={styles.editWeekButton} onPress={onEditCustomWeek}>
                <Ionicons name="create-outline" size={20} color="#00ffff" />
                <Text style={styles.editWeekButtonText}>Edit custom week (Sun–Sat)</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.label, styles.labelSpaced]}>All splits</Text>
            {groupedSections.map((section) => (
              <View key={section.base} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.options.map((opt) => {
                  const active = isSelected(opt);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.listOption, active && styles.listOptionActive]}
                      onPress={() => onSelectSplit?.(opt)}
                    >
                      <Text style={[styles.listOptionText, active && styles.listOptionTextActive]}>
                        {opt.shortLabel || opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {customOption ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Custom</Text>
                <TouchableOpacity
                  style={[styles.customCta, isSelected(customOption) && styles.customCtaActive]}
                  onPress={() => onSelectSplit?.(customOption)}
                >
                  <Ionicons name="create-outline" size={24} color="#00ffff" />
                  <View style={styles.customCtaText}>
                    <Text style={styles.customCtaTitle}>Custom week</Text>
                    <Text style={styles.customCtaSubtitle}>
                      Set each day yourself, then pick workouts on the calendar
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>

          <TouchableOpacity style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  sheet: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.55)',
    marginTop: 4,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  label: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  labelSpaced: {
    marginTop: 20,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  freqChip: {
    minWidth: 48,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.25)',
    borderColor: '#00ffff',
  },
  chipText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#00ffff',
  },
  editWeekButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.4)',
    marginBottom: 8,
  },
  editWeekButtonText: {
    color: '#00ffff',
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  listOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 8,
  },
  listOptionActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: '#00ffff',
  },
  listOptionText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: '500',
  },
  listOptionTextActive: {
    color: '#00ffff',
    fontWeight: '600',
  },
  customCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
  },
  customCtaActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.16)',
    borderColor: '#00ffff',
  },
  customCtaText: {
    flex: 1,
  },
  customCtaTitle: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '700',
  },
  customCtaSubtitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  doneButton: {
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#00ffff',
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
