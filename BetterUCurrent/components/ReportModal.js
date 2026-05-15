import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

const ReportModal = ({ visible, onClose, reportedUserId, reportedContent, contentType }) => {
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportReasons = [
    'Inappropriate content',
    'Harassment',
    'Spam',
    'Fake profile',
    'Violence',
    'Other'
  ];

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert('Error', 'Please select a reason for the report');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: reportedUserId,
          reason: reason,
          evidence: evidence.trim() || null,
          status: 'pending'
        });

      if (error) throw error;

      Alert.alert('Success', 'Report submitted successfully');
      onClose();
      setReason('');
      setEvidence('');
    } catch (error) {
      Alert.alert('Error', 'Failed to submit report');
      console.error('Report error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Report {contentType}</Text>
          
          <Text style={styles.label}>Reason for report:</Text>
          <View style={styles.reasonContainer}>
            {reportReasons.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.reasonButton,
                  reason === r && styles.reasonButtonSelected
                ]}
                onPress={() => setReason(r)}
              >
                <Text style={[
                  styles.reasonButtonText,
                  reason === r && styles.reasonButtonTextSelected
                ]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Additional details (optional):</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Provide more context..."
            value={evidence}
            onChangeText={setEvidence}
            multiline
            numberOfLines={3}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Dark theme styles matching your app
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalView: {
    backgroundColor: '#18191b',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#fff',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    alignSelf: 'flex-start',
    color: '#00ffff',
  },
  reasonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 20,
  },
  reasonButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    margin: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  reasonButtonSelected: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  reasonButtonText: {
    color: '#fff',
    fontSize: 14,
  },
  reasonButtonTextSelected: {
    color: '#000',
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    marginBottom: 20,
    textAlignVertical: 'top',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    color: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    padding: 15,
    marginRight: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  submitButton: {
    flex: 1,
    padding: 15,
    marginLeft: 10,
    borderRadius: 10,
    backgroundColor: '#00ffff',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(0, 255, 255, 0.3)',
  },
  cancelButtonText: {
    color: '#00ffff',
    textAlign: 'center',
    fontWeight: '600',
  },
  submitButtonText: {
    color: '#000',
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default ReportModal;
