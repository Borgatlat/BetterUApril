import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const EditMental = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [session, setSession] = useState({
    name: '',
    duration: '',
    type: '',
    notes: '',
    mood_before: '',
    mood_after: ''
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchSession();
    }
  }, [id]);

  const fetchSession = async () => {
    try {
      const { data, error } = await supabase
        .from('mental_sessions')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      if (data) {
        setSession({
          name: data.name || '',
          duration: data.duration?.toString() || '',
          type: data.type || '',
          notes: data.notes || '',
          mood_before: data.mood_before || '',
          mood_after: data.mood_after || ''
        });
      }
    } catch (error) {
      console.error('Error fetching session:', error);
      Alert.alert('Error', 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!user?.id) {
        Alert.alert('Error', 'You must be logged in to save sessions');
        return;
      }

      const { error } = await supabase
        .from('mental_sessions')
        .update({
          name: session.name,
          duration: parseInt(session.duration),
          type: session.type,
          notes: session.notes,
          mood_before: session.mood_before,
          mood_after: session.mood_after,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      Alert.alert(
        'Success',
        'Session updated successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error updating session:', error);
      Alert.alert('Error', 'Failed to update session. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="close" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Session</Text>
        <TouchableOpacity 
          style={styles.saveButton}
          onPress={handleSave}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Session Name</Text>
          <TextInput
            style={styles.input}
            value={session.name}
            onChangeText={(text) => setSession(prev => ({ ...prev, name: text }))}
            placeholder="Enter session name"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Duration (minutes)</Text>
          <TextInput
            style={styles.input}
            value={session.duration}
            onChangeText={(text) => setSession(prev => ({ ...prev, duration: text }))}
            placeholder="Enter duration in minutes"
            placeholderTextColor="#666"
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Type</Text>
          <TextInput
            style={styles.input}
            value={session.type}
            onChangeText={(text) => setSession(prev => ({ ...prev, type: text }))}
            placeholder="e.g., Meditation, Breathing, Journaling"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mood Before</Text>
          <TextInput
            style={styles.input}
            value={session.mood_before}
            onChangeText={(text) => setSession(prev => ({ ...prev, mood_before: text }))}
            placeholder="How are you feeling before the session?"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mood After</Text>
          <TextInput
            style={styles.input}
            value={session.mood_after}
            onChangeText={(text) => setSession(prev => ({ ...prev, mood_after: text }))}
            placeholder="How are you feeling after the session?"
            placeholderTextColor="#666"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={session.notes}
            onChangeText={(text) => setSession(prev => ({ ...prev, notes: text }))}
            placeholder="Add any additional notes..."
            placeholderTextColor="#666"
            multiline={true}
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#111',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  notesInput: {
    height: 100,
  },
  loadingText: {
    color: '#00ffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default EditMental; 