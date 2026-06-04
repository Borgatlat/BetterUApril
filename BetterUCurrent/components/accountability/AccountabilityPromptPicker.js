import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ACCOUNTABILITY_PROMPT_CATEGORIES,
  getPromptsByCategory,
} from '../../lib/accountabilityPrompts';

/**
 * Tap a guided prompt → parent fills the matching check-in field.
 * @param {{ selectedIds: string[], onSelectPrompt: (prompt: object) => void }} props
 */
export default function AccountabilityPromptPicker({ selectedIds = [], onSelectPrompt }) {
  const [category, setCategory] = useState(ACCOUNTABILITY_PROMPT_CATEGORIES[0]?.id || 'reflection');
  const prompts = getPromptsByCategory(category);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Guided prompts</Text>
      <Text style={styles.hint}>Tap a card to drop the question into your check-in.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow}>
        {ACCOUNTABILITY_PROMPT_CATEGORIES.map((cat) => {
          const active = category === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => setCategory(cat.id)}
            >
              <Ionicons name={cat.icon} size={14} color={active ? '#000' : '#00ffff'} />
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{cat.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.promptGrid}>
        {prompts.map((p) => {
          const used = selectedIds.includes(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.promptCard, used && styles.promptCardUsed]}
              onPress={() => onSelectPrompt(p)}
              activeOpacity={0.85}
            >
              <Text style={styles.promptLabel}>{p.label}</Text>
              <Text style={styles.promptQ} numberOfLines={3}>
                {p.question}
              </Text>
              {used ? (
                <Text style={styles.usedBadge}>Added</Text>
              ) : (
                <Ionicons name="add-circle-outline" size={18} color="#00ffff" style={styles.addIcon} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8 },
  title: { fontSize: 14, fontWeight: '600', color: '#ccc' },
  hint: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 10 },
  catRow: { marginBottom: 12, maxHeight: 40 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: '#00ffff', borderColor: '#00ffff' },
  catLabel: { marginLeft: 6, color: '#00ffff', fontSize: 12, fontWeight: '600' },
  catLabelActive: { color: '#000' },
  promptGrid: { gap: 10 },
  promptCard: {
    backgroundColor: '#141414',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#252525',
  },
  promptCardUsed: { borderColor: '#00ffff44' },
  promptLabel: { color: '#fff', fontWeight: '600', fontSize: 14 },
  promptQ: { color: '#888', fontSize: 12, marginTop: 6, lineHeight: 17 },
  usedBadge: { color: '#00ffff', fontSize: 11, marginTop: 8, fontWeight: '600' },
  addIcon: { position: 'absolute', top: 12, right: 12 },
});
