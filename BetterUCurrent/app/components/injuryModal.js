import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#00ffff';

/**
 * Modal for selecting which body areas are injured. Selections are used to filter
 * out exercises that target those areas (e.g. ACL → no leg exercises).
 */
export default function InjuryModal({
  visible,
  onClose,
  options = [],
  initialSelectedIds = [],
  title = 'Injuries & limitations',
  subtitle = "Select areas to avoid. We'll hide exercises that target them.",
  saveLabel = 'Save',
  onSave,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      setSelectedIds(Array.isArray(initialSelectedIds) ? [...initialSelectedIds] : []);
    }
  }, [visible, initialSelectedIds]);

  const toggleOption = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    onSave?.(selectedIds);
    onClose?.();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" />
        <View style={styles.modalBox}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            <TouchableOpacity
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.table}>
              {options.map((option, index) => {
                const isSelected = selectedIds.includes(option.id);
                return (
                  <TouchableOpacity
                    key={option.id}
                    activeOpacity={0.7}
                    onPress={() => toggleOption(option.id)}
                    style={[styles.row, isSelected && styles.rowSelected]}
                  >
                    <View style={styles.rowLeft}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected && <Ionicons name="checkmark" size={16} color="#000" />}
                      </View>
                      <Text
                        style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setSelectedIds([])}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>Clear all</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8} onPress={handleSave} style={styles.saveButton}>
              <Text style={styles.saveButtonText}>
                {selectedIds.length === 0 ? saveLabel : `${saveLabel} (${selectedIds.length})`}
              </Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalBox: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    paddingRight: 40,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  table: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  rowSelected: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  rowLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    flex: 1,
  },
  rowLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  clearButton: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  clearButtonText: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: '600',
  },
});
