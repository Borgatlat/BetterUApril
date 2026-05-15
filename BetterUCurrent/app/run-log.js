import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, SafeAreaView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { LinearGradient } from 'expo-linear-gradient';

const RunLogScreen = () => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalRuns: 0,
    totalDistance: 0,
    totalTime: 0,
    averagePace: 0,
    longestRun: 0,
    fastestPace: 0
  });
  const [filter, setFilter] = useState('all'); // 'all', 'week', 'month', 'year'
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchRuns();
  }, [user]);

  const fetchRuns = async () => {
    if (!user?.id) {
      console.log('No user ID available');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('runs')
        .select('*')
        .eq('user_id', user.id)
        .order('start_time', { ascending: false });

      if (error) throw error;

      setRuns(data || []);
      calculateStats(data || []);
    } catch (error) {
      console.error('Error fetching runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRuns();
    setRefreshing(false);
  };

  const handleDeleteRun = async (runId, runName) => {
    Alert.alert(
      'Delete Run',
      `Are you sure you want to delete "${runName}"? This action cannot be undone.`,
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
                .from('runs')
                .delete()
                .eq('id', runId)
                .eq('user_id', user.id);

              if (error) throw error;

              // Refresh the runs list
              await fetchRuns();
              
              Alert.alert('Success', 'Run deleted successfully');
            } catch (error) {
              console.error('Error deleting run:', error);
              Alert.alert('Error', 'Failed to delete run. Please try again.');
            }
          },
        },
      ]
    );
  };

  const calculateStats = (runsData) => {
    if (!runsData.length) {
      setStats({
        totalRuns: 0,
        totalDistance: 0,
        totalTime: 0,
        averagePace: 0,
        longestRun: 0,
        fastestPace: 0
      });
      return;
    }

    const totalRuns = runsData.length;
    const totalDistance = runsData.reduce((sum, run) => sum + run.distance_meters, 0);
    const totalTime = runsData.reduce((sum, run) => sum + run.duration_seconds, 0);
    const averagePace = runsData.reduce((sum, run) => sum + run.average_pace_minutes_per_km, 0) / totalRuns;
    const longestRun = Math.max(...runsData.map(run => run.distance_meters));
    const fastestPace = Math.min(...runsData.map(run => run.average_pace_minutes_per_km));

    setStats({
      totalRuns,
      totalDistance,
      totalTime,
      averagePace,
      longestRun,
      fastestPace
    });
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPace = (pace) => {
    if (!pace || pace === 0) return '--:--';
    const minutes = Math.floor(pace);
    const seconds = Math.floor((pace - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    return (meters / 1000).toFixed(2);
  };

  const getFilteredRuns = () => {
    if (filter === 'all') return runs;
    
    const now = new Date();
    const filterDate = new Date();
    
    switch (filter) {
      case 'week':
        filterDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        filterDate.setMonth(now.getMonth() - 1);
        break;
      case 'year':
        filterDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return runs;
    }
    
    return runs.filter(run => new Date(run.start_time) >= filterDate);
  };

    const renderRunItem = ({ item }) => {
    const distanceKm = item.distance_meters / 1000;
    const paceFormatted = formatPace(item.average_pace_minutes_per_km);
    const durationFormatted = formatTime(item.duration_seconds);
    const dateFormatted = new Date(item.start_time).toLocaleDateString();
    const runName = item.name || "Run";

    return (
      <View style={styles.runItem}>
        <TouchableOpacity 
          style={styles.runContent}
          onPress={() => router.push(`/edit-run/${item.id}`)}
        >
          <View style={styles.runHeader}>
            <Text style={styles.runDate}>{dateFormatted}</Text>
            <Text style={styles.runName}>{runName}</Text>
          </View>
          
          <View style={styles.runStats}>
            <View style={styles.statItem}>
              <Ionicons name="location-outline" size={16} color="#00ffff" />
              <Text style={styles.statValue}>{distanceKm.toFixed(2)} km</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color="#00ffff" />
              <Text style={styles.statValue}>{durationFormatted}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="speedometer-outline" size={16} color="#00ffff" />
              <Text style={styles.statValue}>{paceFormatted} /km</Text>
            </View>
          </View>

          {item.notes && (
            <Text style={styles.runNotes} numberOfLines={2}>
              {item.notes}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteRun(item.id, runName)}
        >
          <Ionicons name="trash-outline" size={20} color="#ff4444" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderStats = () => {
    const filteredRuns = getFilteredRuns();
    const filteredStats = {
      totalRuns: filteredRuns.length,
      totalDistance: filteredRuns.reduce((sum, run) => sum + run.distance_meters, 0),
      totalTime: filteredRuns.reduce((sum, run) => sum + run.duration_seconds, 0),
      averagePace: filteredRuns.length > 0 
        ? filteredRuns.reduce((sum, run) => sum + run.average_pace_minutes_per_km, 0) / filteredRuns.length 
        : 0
    };

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="fitness-outline" size={24} color="#00ffff" />
          <Text style={styles.statNumber}>{filteredStats.totalRuns}</Text>
          <Text style={styles.statLabel}>Runs</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="location-outline" size={24} color="#00ffff" />
          <Text style={styles.statNumber}>{formatDistance(filteredStats.totalDistance)}</Text>
          <Text style={styles.statLabel}>Total km</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={24} color="#00ffff" />
          <Text style={styles.statNumber}>{formatTime(filteredStats.totalTime)}</Text>
          <Text style={styles.statLabel}>Total time</Text>
        </View>
                 <View style={styles.statCard}>
           <Ionicons name="speedometer-outline" size={24} color="#00ffff" />
           <Text style={styles.statNumber}>{formatPace(filteredStats.averagePace)}</Text>
           <Text style={styles.statLabel}>Avg pace /km</Text>
         </View>
      </View>
    );
  };

  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <TouchableOpacity 
        style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
        onPress={() => setFilter('all')}
      >
        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.filterButton, filter === 'week' && styles.filterButtonActive]}
        onPress={() => setFilter('week')}
      >
        <Text style={[styles.filterText, filter === 'week' && styles.filterTextActive]}>Week</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.filterButton, filter === 'month' && styles.filterButtonActive]}
        onPress={() => setFilter('month')}
      >
        <Text style={[styles.filterText, filter === 'month' && styles.filterTextActive]}>Month</Text>
      </TouchableOpacity>
      <TouchableOpacity 
        style={[styles.filterButton, filter === 'year' && styles.filterButtonActive]}
        onPress={() => setFilter('year')}
      >
        <Text style={[styles.filterText, filter === 'year' && styles.filterTextActive]}>Year</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text style={styles.loadingText}>Loading run history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Run History</Text>
        <View style={styles.placeholder} />
      </View>

      <FlatList
        data={getFilteredRuns()}
        renderItem={renderRunItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00ffff"
            colors={["#00ffff"]}
          />
        }
        ListHeaderComponent={
          <View>
            {renderStats()}
            {renderFilterButtons()}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="fitness-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>No runs found</Text>
            <Text style={styles.emptySubtext}>Start your first run to see it here!</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
  },
  listContainer: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 16,
    borderRadius: 12,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 8,
    borderRadius: 12,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#00ffff',
  },
  filterText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#000',
    fontWeight: 'bold',
  },
  runItem: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  runContent: {
    flex: 1,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  runHeader: {
    marginBottom: 8,
  },
  runDate: {
    color: '#888',
    fontSize: 12,
  },
  runName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  runStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 4,
  },
  runNotes: {
    color: '#888',
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#666',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default RunLogScreen; 