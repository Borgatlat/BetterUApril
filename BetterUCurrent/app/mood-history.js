"use client";

import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const moodOptions = [
  { value: 'great', icon: 'sunny', color: '#FFD700' },
  { value: 'good', icon: 'partly-sunny', color: '#98FB98' },
  { value: 'okay', icon: 'cloud', color: '#87CEEB' },
  { value: 'bad', icon: 'rainy', color: '#A9A9A9' },
  { value: 'awful', icon: 'thunderstorm', color: '#FF6B6B' }
];

const MoodHistoryScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [moodHistory, setMoodHistory] = useState([]);

  useEffect(() => {
    fetchMoodHistory();
  }, []);

  const fetchMoodHistory = async () => {
    try {
      if (!user) return;

      const { data, error } = await supabase
        .from('mood_tracking')
        .select('*')
        .eq('profile_id', user.id)
        .order('date', { ascending: false })
        .limit(30); // Show last 30 days

      if (error) throw error;
      setMoodHistory(data || []);
    } catch (error) {
      console.error('Error fetching mood history:', error);
    }
  };

  const groupMoodsByDate = () => {
    const groups = {};
    moodHistory.forEach(entry => {
      const date = new Date(entry.date);
      const monthYear = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) {
        groups[monthYear] = [];
      }
      groups[monthYear].push(entry);
    });
    return groups;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Ionicons 
          name="arrow-back" 
          size={24} 
          color="#fff" 
          onPress={() => router.back()}
          style={styles.backButton}
        />
        <Text style={styles.title}>Mood History</Text>
      </View>

      {Object.entries(groupMoodsByDate()).map(([monthYear, entries]) => (
        <View key={monthYear} style={styles.monthSection}>
          <Text style={styles.monthTitle}>{monthYear}</Text>
          {entries.map((entry, index) => (
            <View key={index} style={styles.moodEntry}>
              <View style={styles.moodIconContainer}>
                <Ionicons 
                  name={moodOptions.find(m => m.value === entry.mood)?.icon || 'help-circle'} 
                  size={32} 
                  color={moodOptions.find(m => m.value === entry.mood)?.color || '#fff'} 
                />
              </View>
              <View style={styles.moodInfo}>
                <Text style={styles.moodText}>
                  {entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1)}
                </Text>
                <Text style={styles.dateText}>
                  {new Date(entry.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
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
    paddingTop: 60,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  monthSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  moodEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  moodIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  moodInfo: {
    flex: 1,
  },
  moodText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
});

export default MoodHistoryScreen; 