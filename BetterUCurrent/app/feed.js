import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const FeedScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('user_activities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  const renderActivity = ({ item }) => {
    const getIcon = (type) => {
      switch (type?.toLowerCase()) {
        case 'workout':
          return 'barbell-outline';
        case 'mental':
          return 'brain-outline';
        case 'cardio':
          return 'fitness-outline';
        default:
          return 'fitness-outline';
      }
    };

    return (
      <TouchableOpacity 
        style={styles.activityCard}
        onPress={() => {
          try {
            if (item.type === 'workout') {
              router.push(`/activity/${item.id}`);
            } else if (item.type === 'mental') {
              router.push(`/mental/${item.id}`);
            } else if (item.type === 'run' || item.type === 'cardio') {
              router.push(`/activity/${item.id}`);
            }
          } catch (error) {
            console.error('Error navigating to activity:', error);
            Alert.alert('Error', 'Failed to open activity details');
          }
        }}
      >
        <View style={styles.activityHeader}>
          <View style={styles.activityType}>
            <Ionicons name={getIcon(item.type)} size={20} color="#00ffff" />
            <Text style={styles.activityTypeText}>{item.type}</Text>
          </View>
          <Text style={styles.timestamp}>
            {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
          </Text>
        </View>

        <Text style={styles.activityName}>{item.name}</Text>

        <View style={styles.activityDetails}>
          {item.duration && (
            <View style={styles.detail}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.duration} min</Text>
            </View>
          )}
          {item.calories && (
            <View style={styles.detail}>
              <Ionicons name="flame-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.calories} cal</Text>
            </View>
          )}
        </View>

        {item.notes && (
          <Text style={styles.notes} numberOfLines={2}>
            {item.notes}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading activities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity Feed</Text>
      </View>

      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00ffff"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No activities yet</Text>
            <Text style={styles.emptySubtext}>
              Your completed workouts and mental sessions will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  list: {
    padding: 16,
  },
  activityCard: {
    backgroundColor: '#111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityTypeText: {
    color: '#00ffff',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  timestamp: {
    color: '#666',
    fontSize: 12,
  },
  activityName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  activityDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#666',
    fontSize: 14,
  },
  notes: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingText: {
    color: '#00ffff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
});

export default FeedScreen; 