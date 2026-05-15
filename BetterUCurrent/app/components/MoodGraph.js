"use client";

import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const moodOptions = [
  { value: 'great', icon: 'sunny', color: '#FFD700' },
  { value: 'good', icon: 'partly-sunny', color: '#98FB98' },
  { value: 'okay', icon: 'cloud', color: '#87CEEB' },
  { value: 'bad', icon: 'rainy', color: '#A9A9A9' },
  { value: 'awful', icon: 'thunderstorm', color: '#FF6B6B' }
];

function getLocalDateString(date) {
  // Returns YYYY-MM-DD in local time
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MoodStreakBar = ({ moodHistory = [] }) => {
  // Get last 7 days, oldest to newest, using local date
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - i));
    return getLocalDateString(date);
  });

  // Map each day to the mood entry (if any), using local date
  const streak = last7Days.map(dateStr => {
    const entry = moodHistory.find(mood => {
      const moodDate = new Date(mood.date);
      const moodLocalDate = getLocalDateString(moodDate);
      return moodLocalDate === dateStr;
    });
    return entry ? entry.mood : null;
  });

  console.log('Mood streak data:', {
    last7Days,
    moodHistory,
    streak
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>7-Day Mood Streak</Text>
      <View style={styles.streakBar}>
        {streak.map((mood, idx) => {
          const option = moodOptions.find(opt => opt.value === mood);
          return (
            <View key={idx} style={styles.streakItem}>
              <View style={[styles.iconCircle, { backgroundColor: option ? option.color : '#222' }]}> 
                <Ionicons
                  name={option ? option.icon : 'ellipse-outline'}
                  size={28}
                  color={option ? '#000' : '#666'}
                />
              </View>
              <Text style={styles.dayLabel}>
                {(() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  d.setDate(d.getDate() - (6 - idx));
                  return d.toLocaleDateString('en-US', { weekday: 'short' });
                })()}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  streakBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginHorizontal: 10,
  },
  streakItem: {
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  dayLabel: {
    color: '#aaa',
    fontSize: 12,
    marginTop: 2,
  },
});

export default MoodStreakBar; 