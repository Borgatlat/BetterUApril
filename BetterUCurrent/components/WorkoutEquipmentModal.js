import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ALL_USER_EQUIPMENT_IDS,
  USER_EQUIPMENT_OPTIONS,
  EQUIPMENT_PRESETS,
} from '../utils/workoutEquipment';

/**
 * Pick what gear you have and whether to filter "Recommended for today".
 */
export default function WorkoutEquipmentModal({
  visible,
  onClose,
  initialEquipmentIds = ALL_USER_EQUIPMENT_IDS,
  initialFilterEnabled = false,
  onSave,
}) {
  const [draftIds, setDraftIds] = useState([]);
  const [filterEnabled, setFilterEnabled] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraftIds(
      Array.isArray(initialEquipmentIds) && initialEquipmentIds.length > 0
        ? [...initialEquipmentIds]
        : [...ALL_USER_EQUIPMENT_IDS]
    );
    setFilterEnabled(!!initialFilterEnabled);
  }, [visible, initialEquipmentIds, initialFilterEnabled]);

  const toggleId = (id) => {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const applyPreset = (presetKey) => {
    const preset = EQUIPMENT_PRESETS[presetKey];
    if (preset) setDraftIds([...preset.ids]);
  };

  const handleSave = () => {
    if (filterEnabled && draftIds.length === 0) {
      Alert.alert(
        'Select equipment',
        'Turn off filtering, or select at least one type of equipment you have access to.'
      );
      return;
    }
    onSave?.({ equipmentIds: draftIds, filterEnabled });
    onClose?.();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Your equipment</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Only affects “Recommended for today” on this tab — not your full workout list. Turn the
            filter off to see every suggestion regardless of gear.
          </Text>

          <View style={styles.filterRow}>
            <View style={styles.filterTextWrap}>
              <Text style={styles.filterLabel}>Filter recommendations</Text>
              <Text style={styles.filterHint}>
                {filterEnabled
                  ? 'Hiding workouts that need gear you didn’t select'
                  : 'Showing all workouts for today’s split'}
              </Text>
            </View>
            <Switch
              value={filterEnabled}
              onValueChange={setFilterEnabled}
              trackColor={{ false: '#444', true: '#00ffff' }}
              thumbColor={filterEnabled ? '#00ffff' : '#ccc'}
            />
          </View>

          <View style={styles.presetRow}>
            {Object.entries(EQUIPMENT_PRESETS).map(([key, preset]) => (
              <TouchableOpacity
                key={key}
                style={styles.presetChip}
                onPress={() => applyPreset(key)}
              >
                <Text style={styles.presetChipText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.presetChip} onPress={() => setDraftIds([])}>
              <Text style={styles.presetChipText}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {USER_EQUIPMENT_OPTIONS.map((opt) => {
              const selected = draftIds.includes(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionRow, selected && styles.optionRowSelected]}
                  onPress={() => toggleId(opt.id)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={selected ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={selected ? '#00ffff' : '#888'}
                  />
                  <View style={styles.optionText}>
                    <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryBtn} onPress={handleSave}>
              <Text style={styles.primaryBtnText}>Save</Text>
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
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  closeBtn: { padding: 4 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', flex: 1 },
  subtitle: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  filterTextWrap: { flex: 1, marginRight: 12 },
  filterLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  filterHint: { color: '#888', fontSize: 12, marginTop: 2 },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.35)',
    backgroundColor: 'rgba(0,255,255,0.08)',
  },
  presetChipText: { color: '#00ffff', fontSize: 13, fontWeight: '600' },
  scroll: { maxHeight: 280, paddingHorizontal: 20 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  optionRowSelected: {
    borderColor: 'rgba(0,255,255,0.4)',
    backgroundColor: 'rgba(0,255,255,0.06)',
  },
  optionText: { flex: 1 },
  optionLabel: { color: '#ddd', fontSize: 16, fontWeight: '600' },
  optionLabelSelected: { color: '#fff' },
  optionDesc: { color: '#888', fontSize: 12, marginTop: 4, lineHeight: 17 },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  secondaryBtnText: { color: '#aaa', fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(0,255,255,0.15)',
    borderWidth: 1.5,
    borderColor: '#00ffff',
  },
  primaryBtnText: { color: '#00ffff', fontSize: 16, fontWeight: '700' },
});
