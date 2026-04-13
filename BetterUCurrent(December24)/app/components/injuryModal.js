import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#00ffff';

/**
 * Modal for selecting which body areas are injured. Selections are used to filter
 * out exercises that target those areas (e.g. ACL → no leg exercises).
 *
 * PROPS:
 * - visible: boolean
 * - onClose: () => void
 * - options: Array<{ id, label }>  (e.g. injuredMusclesOptions from utils/injuryOptions)
 * - initialSelectedIds: string[]   (e.g. injuredMuscleIds from workout screen)
 * - onSave: (selectedIds: string[]) => void  (parent saves to AsyncStorage and updates state)
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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalBox}>
          <SafeAreaView style={styles.safe}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {subtitle}
              </Text>
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
            >
              <View style={styles.table}>
                {options.map((option, index) => {
                  const isSelected = selectedIds.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      activeOpacity={0.7}
                      onPress={() => toggleOption(option.id)}
                      style={[
                        styles.row,
                        index === 0 && styles.rowFirst,
                        isSelected && styles.rowSelected,
                      ]}
                    >
                      <View style={styles.rowLeft}>
                        <View
                          style={[
                            styles.checkbox,
                            isSelected && styles.checkboxSelected,
                          ]}
                        >
                          {isSelected && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#000"
                            />
                          )}
                        </View>
                        <Text
                          style={[
                            styles.rowLabel,
                            isSelected && styles.rowLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {option.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleSave}
                style={styles.saveButton}
              >
                <Text style={styles.saveButtonText}>{saveLabel}</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#000',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  safe: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
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
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
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
  rowFirst: {},
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
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
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
