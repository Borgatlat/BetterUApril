import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Weekly Reflection modal/screen: user fills what went well, what went bad,
 * what to improve, and changes. onComplete(reflection) is called with the data.
 * Optional: pass visible + onClose to render as a modal with close button.
 */
export default function WeeklyReflection({ visible, onClose, onComplete }) {
  const [whatWentWell, setWhatWentWell] = useState('');
  const [whatWentBad, setWhatWentBad] = useState('');
  const [whatCanImprove, setWhatCanImprove] = useState('');
  const [changes, setChanges] = useState('');
  const [howCanIBetterSupportAndServeOthers, setHowCanIBetterSupportAndServeOthers] = useState('');

  const handleSubmit = () => {
    const reflection = {
      whatWentWell: whatWentWell.trim(),
      whatWentBad: whatWentBad.trim(),
      whatCanImprove: whatCanImprove.trim(),
      changes: changes.trim(),
      howCanIBetterSupportAndServeOthers: howCanIBetterSupportAndServeOthers.trim(),
    };
    if (onComplete) {
      onComplete(reflection);
    }
    if (onClose) {
      onClose();
    }
  };

  const formContent = (
    <>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly Reflection</Text>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#00ffff" />
          </TouchableOpacity>
        )}
      </View>
      <ScrollView
        style={styles.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formGroup}>
          <Text style={styles.label}>What went well</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={whatWentWell}
              onChangeText={setWhatWentWell}
              placeholder="e.g. Stuck to my routine, slept better..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>What went badly and why did that happen?</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={whatWentBad}
              onChangeText={setWhatWentBad}
              placeholder="e.g. Skipped workouts, poor sleep..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>What I can improve</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={whatCanImprove}
              onChangeText={setWhatCanImprove}
              placeholder="e.g. Meal prep, earlier bedtime..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Changes I'll make next week</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={changes}
              onChangeText={setChanges}
              placeholder="e.g. Block morning time for exercise..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
        <View style={styles.formGroup}>
          <Text style={styles.label}>How can I better support and serve others?</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={howCanIBetterSupportAndServeOthers}
              onChangeText={setHowCanIBetterSupportAndServeOthers}
              placeholder="e.g. Volunteer at a local food bank, mentor a student..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Ionicons name="checkmark-circle" size={22} color="#000" style={{ marginRight: 8 }} />
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );

  // If used as modal (visible + onClose provided), wrap in Modal with overlay
  if (visible != null && onClose) {
    return (
      <Modal
        visible={visible === true}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
          >
            <View style={styles.content}>{formContent}</View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    );
  }

  // Standalone form (e.g. used as a screen or embedded content)
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.standalone}
    >
      <View style={styles.content}>{formContent}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  standalone: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a5a5a',
    maxHeight: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    maxHeight: 420,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a5a5a',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapperMultiline: {
    minHeight: 88,
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
