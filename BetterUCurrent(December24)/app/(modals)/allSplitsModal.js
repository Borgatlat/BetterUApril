import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AllSplitsModal = ({ visible, onClose, options = [], selectedSplit, onSelect }) => {
  const isSelected = (opt) =>
    selectedSplit && (typeof selectedSplit === 'object' ? selectedSplit.id === opt.id : selectedSplit === opt.id);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>All Splits</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {options.map((opt) => {
              const selected = isSelected(opt);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.splitOption, selected && styles.splitOptionSelected]}
                  onPress={() => onSelect && onSelect(opt)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.splitOptionText, selected && styles.splitOptionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
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
    gap: 12,
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
});

export default AllSplitsModal;
