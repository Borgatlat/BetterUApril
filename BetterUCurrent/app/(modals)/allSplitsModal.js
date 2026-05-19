import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const SPLIT_SECTION_TITLES = {
  ppl: 'Push / Pull / Legs (PPL)',
  upper_lower_ppl: 'Upper / Lower + PPL',
  upper_lower: 'Upper / Lower',
  full_body: 'Full Body',
  bro_split: 'Bro split (one muscle per day)',
};

const getSplitBaseId = (splitId) => {
  if (!splitId || splitId === 'custom') return 'custom';
  return String(splitId).replace(/_\d+$/, '');
};

const AllSplitsModal = ({ visible, onClose, options = [], selectedSplit, onSelect }) => {
  const isSelected = (opt) =>
    selectedSplit &&
    (typeof selectedSplit === 'object' ? selectedSplit.id === opt.id : selectedSplit === opt.id);

  const customOption = useMemo(() => options.find((o) => o.id === 'custom'), [options]);

  const groupedSections = useMemo(() => {
    const order = ['ppl', 'upper_lower_ppl', 'upper_lower', 'full_body', 'bro_split'];
    const byBase = {};
    for (const opt of options) {
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
  }, [options]);

  const customActive = customOption && isSelected(customOption);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All training splits</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {groupedSections.map((section) => (
              <View key={section.base} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {section.options.map((opt) => {
                  const selected = isSelected(opt);
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.splitOption, selected && styles.splitOptionSelected]}
                      onPress={() => onSelect && onSelect(opt)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.splitOptionText,
                          selected && styles.splitOptionTextSelected,
                        ]}
                      >
                        {opt.shortLabel || opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {customOption ? (
              <View style={styles.customSection}>
                <Text style={styles.sectionTitle}>Custom</Text>
                <TouchableOpacity
                  style={[styles.customCta, customActive && styles.customCtaSelected]}
                  onPress={() => onSelect && onSelect(customOption)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="create-outline" size={26} color="#00ffff" />
                  <View style={styles.customCtaTextWrap}>
                    <Text style={styles.customCtaTitle}>Custom week</Text>
                    <Text style={styles.customCtaSubtitle}>
                      Set each day (Sun–Sat) to Push, Pull, Legs, Rest, and more
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00ffff',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 8,
    position: 'absolute',
    right: 0,
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: 400,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  splitOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginBottom: 10,
  },
  splitOptionSelected: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderColor: '#00ffff',
    borderWidth: 2,
  },
  splitOptionText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  splitOptionTextSelected: {
    color: '#00ffff',
    fontWeight: '600',
  },
  customSection: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  customCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.35)',
  },
  customCtaSelected: {
    backgroundColor: 'rgba(0, 255, 255, 0.18)',
    borderColor: '#00ffff',
    borderWidth: 2,
  },
  customCtaTextWrap: {
    flex: 1,
  },
  customCtaTitle: {
    color: '#00ffff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  customCtaSubtitle: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 13,
    lineHeight: 18,
  },
});

export default AllSplitsModal;
