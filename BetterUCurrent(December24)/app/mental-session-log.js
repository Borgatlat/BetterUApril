"use client";

import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const MentalSessionLog = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('mental_session_logs')
        .select('*')
        .eq('profile_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      Alert.alert('Error', 'Failed to load session history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (sessionId) => {
    Alert.alert(
      'Delete Session',
      'Are you sure you want to delete this session?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('mental_session_logs')
                .delete()
                .eq('id', sessionId);

              if (error) throw error;
              setSessions(sessions.filter(session => session.id !== sessionId));
            } catch (error) {
              console.error('Error deleting session:', error);
              Alert.alert('Error', 'Failed to delete session');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading sessions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Session History</Text>
          <Text style={styles.sessionCounter}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} completed</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
      >
        {sessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={40} color="#666" />
            <Text style={styles.emptyStateText}>No sessions recorded yet</Text>
            <Text style={styles.emptyStateSubtext}>Complete a mental session to see it here</Text>
          </View>
        ) : (
          sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                <Text style={styles.session_type}>
                  {session.session_type === 'meditation' ? 'Meditation' : 'Breathing Exercise'}
                </Text>
                <TouchableOpacity
                  onPress={() => handleDelete(session.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons name="trash-outline" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
              <Text style={styles.sessionDate}>{formatDate(session.completed_at)}</Text>
              <Text style={styles.sessionDuration}>Duration: {session.duration} minutes</Text>
              {session.calmness_level && (
                <Text style={styles.calmnessLevel}>
                  Calmness Level: {session.calmness_level}/5
                </Text>
              )}
              {session.notes && (
                <Text style={styles.notes}>Notes: {session.notes}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  backButton: {
    marginRight: 15,
    padding: 5,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  sessionCounter: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    padding: 20,
  },
  sessionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  session_type: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  deleteButton: {
    padding: 5,
  },
  sessionDate: {
    color: '#666',
    fontSize: 14,
    marginBottom: 5,
  },
  sessionDuration: {
    color: '#00ffff',
    fontSize: 14,
    marginBottom: 5,
  },
  calmnessLevel: {
    color: '#98FB98',
    fontSize: 14,
    marginBottom: 5,
  },
  notes: {
    color: '#fff',
    fontSize: 14,
    marginTop: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  emptyStateSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default MentalSessionLog; 