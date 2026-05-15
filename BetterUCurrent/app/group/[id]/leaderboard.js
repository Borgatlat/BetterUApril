import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const EXERCISES = ['Bench Press', 'Deadlift', 'Squat'];

export default function LeaderboardScreen() {
  const { id, name } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [selectedExercise, setSelectedExercise] = useState('Bench Press');
  const [leaderboard, setLeaderboard] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchLeaderboard();
  }, [id, selectedExercise]);

  const fetchLeaderboard = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all members of the group
      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', id);

      if (membersError) throw membersError;

      const memberIds = members.map(m => m.user_id);

      // Get PRs for the selected exercise
      const { data: prs, error: prsError } = await supabase
        .from('personal_records')
        .select('*')
        .in('user_id', memberIds)
        .eq('exercise_name', selectedExercise)
        .order('current_weight_kg', { ascending: false });

      if (prsError) throw prsError;

      // Get all unique user IDs from the PRs
      const userIds = [...new Set(prs.map(pr => pr.user_id))];

      // Fetch profiles for all users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user profiles for quick lookup
      const profileMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});

      // Get the highest PR for each user
      const userHighestPRs = prs.reduce((acc, pr) => {
        if (!acc[pr.user_id] || acc[pr.user_id].current_weight_kg < pr.current_weight_kg) {
          acc[pr.user_id] = {
            ...pr,
            profiles: profileMap[pr.user_id]
          };
        }
        return acc;
      }, {});

      // Convert to array and sort by weight
      const sortedLeaderboard = Object.values(userHighestPRs)
        .sort((a, b) => b.current_weight_kg - a.current_weight_kg)
        .map((pr, index) => ({
          ...pr,
          rank: index + 1
        }));

      // Find user's position
      const userPR = sortedLeaderboard.find(pr => pr.user_id === user.id);
      setUserPosition(userPR ? userPR.rank : null);

      setLeaderboard(sortedLeaderboard);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderLeaderboardItem = ({ item, index }) => (
    <View style={styles.leaderboardItem}>
      <View style={styles.rankContainer}>
        {index < 3 ? (
          <View style={[styles.medal, styles[`medal${index + 1}`]]}>
            {index === 0 ? (
              <Ionicons name="trophy" size={24} color="#FFD700" />
            ) : index === 1 ? (
              <Ionicons name="medal" size={24} color="#C0C0C0" />
            ) : (
              <Ionicons name="ribbon" size={24} color="#CD7F32" />
            )}
          </View>
        ) : (
          <Text style={styles.rank}>{item.rank}</Text>
        )}
      </View>
      
      <View style={styles.userInfo}>
        {item.profiles?.avatar_url ? (
          <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={24} color="#00ffff" />
          </View>
        )}
        <TouchableOpacity 
          onPress={() => router.push(`/profile/${item.user_id}`)}
          style={styles.nameContainer}
        >
          <Text style={styles.name}>{item.profiles?.full_name}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.prInfo}>
        <Text style={styles.weight}>{item.current_weight_kg} kg</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#00ffff" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{name} Leaderboard</Text>
          <Text style={styles.subtitle}>Compare achievements</Text>
        </View>
      </View>

      {userPosition && (
        <View style={styles.positionCard}>
          <Ionicons name="trophy" size={20} color="#00ffff" />
          <Text style={styles.positionText}>Your Position: #{userPosition}</Text>
        </View>
      )}

      <View style={styles.exerciseSelector}>
        {EXERCISES.map((exercise) => (
          <TouchableOpacity
            key={exercise}
            style={[
              styles.exerciseButton,
              selectedExercise === exercise && styles.selectedExercise
            ]}
            onPress={() => setSelectedExercise(exercise)}
          >
            <Text style={[
              styles.exerciseButtonText,
              selectedExercise === exercise && styles.selectedExerciseText
            ]}>
              {exercise}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={leaderboard}
        keyExtractor={(item) => `${item.user_id}-${item.id}`}
        renderItem={renderLeaderboardItem}
        contentContainerStyle={styles.leaderboardList}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    marginLeft: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  exerciseSelector: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 24,
    gap: 12,
  },
  exerciseButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  selectedExercise: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  exerciseButtonText: {
    color: '#00ffff',
    fontWeight: '600',
    fontSize: 14,
  },
  selectedExerciseText: {
    color: '#111',
    fontWeight: 'bold',
  },
  leaderboardList: {
    padding: 20,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  rankContainer: {
    width: 40,
    alignItems: 'center',
  },
  rank: {
    color: '#888',
    fontSize: 18,
    fontWeight: 'bold',
    width: 40,
    textAlign: 'center',
  },
  medal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  medal1: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  medal2: {
    borderColor: '#C0C0C0',
    backgroundColor: 'rgba(192, 192, 192, 0.1)',
  },
  medal3: {
    borderColor: '#CD7F32',
    backgroundColor: 'rgba(205, 127, 50, 0.1)',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  nameContainer: {
    flex: 1,
  },
  name: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  prInfo: {
    alignItems: 'flex-end',
  },
  weight: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  positionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  positionText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
}); 