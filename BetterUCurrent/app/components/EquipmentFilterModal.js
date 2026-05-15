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
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#00ffff';

/**
 * Modal: choose which equipment the user has, and whether to hide recommended workouts
 * that need gear they do not have.
 *
 * Props:
 * - visible, onClose
 * - options: { id, label, description }[]
 * - initialSelectedIds: string[]
 * - initialFilterEnabled: boolean
 * - onSave: ({ selectedIds, filterEnabled }) => void
 */
export default function EquipmentFilterModal({
  visible,
  onClose,
  options = [],
  initialSelectedIds = [],
  initialFilterEnabled = false,
  onSave,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterEnabled, setFilterEnabled] = useState(false);

  // When the modal opens, copy props into local state so edits are cancelable by closing without save.
  useEffect(() => {
    if (visible) {
      setSelectedIds(Array.isArray(initialSelectedIds) ? [...initialSelectedIds] : []);
      setFilterEnabled(!!initialFilterEnabled);
    }
  }, [visible, initialSelectedIds, initialFilterEnabled]);

  const toggleOption = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    onSave?.({ selectedIds, filterEnabled });
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
              <Text style={styles.title}>My equipment</Text>
              <Text style={styles.subtitle}>
                Check what you usually have access to. Bodyweight moves always count — no need to list a mat.
              </Text>
              <TouchableOpacity
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                onPress={onClose}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchLabels}>
                <Text style={styles.switchTitle}>Filter recommended workouts</Text>
                <Text style={styles.switchHint}>
                  When on, we only show today&apos;s picks you can do with your checked equipment.
                </Text>
              </View>
              <Switch
                value={filterEnabled}
                onValueChange={setFilterEnabled}
                trackColor={{ false: '#333', true: '#00ffff' }}
                thumbColor={filterEnabled ? '#000' : '#888'}
              />
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
                            <Ionicons name="checkmark" size={16} color="#000" />
                          )}
                        </View>
                        <View style={styles.rowTextWrap}>
                          <Text
                            style={[
                              styles.rowLabel,
                              isSelected && styles.rowLabelSelected,
                            ]}
                            numberOfLines={2}
                          >
                            {option.label}
                          </Text>
                          {option.description ? (
                            <Text style={styles.rowDesc} numberOfLines={3}>
                              {option.description}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity activeOpacity={0.8} onPress={handleSave} style={styles.saveButton}>
                <Text style={styles.saveButtonText}>Save</Text>
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
    maxHeight: '88%',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  safe: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 12,
  },
  switchLabels: { flex: 1, marginRight: 8 },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  switchHint: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.55)',
    lineHeight: 18,
  },
  scroll: { flex: 1 },
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
    paddingVertical: 12,
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
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginRight: 14,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  rowTextWrap: { flex: 1 },
  rowLabel: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  rowLabelSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  rowDesc: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    lineHeight: 18,
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
