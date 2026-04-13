"use client";

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function MyRequestsScreen() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    loadRequests();
  }, [userProfile?.id]);

  const loadRequests = async () => {
    if (!userProfile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: requestsData, error } = await supabase
        .from('team_join_requests')
        .select(`
          id,
          team_id,
          status,
          message,
          created_at,
          teams:team_id (
            id,
            name,
            avatar_url,
            current_league,
            total_trophies
          )
        `)
        .eq('user_id', userProfile.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error);
        setRequests([]);
      } else {
        const formattedRequests = requestsData.map(req => ({
          id: req.id,
          team_id: req.team_id,
          team_name: req.teams.name,
          team_avatar: req.teams.avatar_url,
          team_league: req.teams.current_league,
          team_trophies: req.teams.total_trophies,
          status: req.status,
          message: req.message,
          created_at: req.created_at
        }));
        setRequests(formattedRequests);
      }
    } catch (error) {
      console.error('Error loading requests:', error);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async (requestId, teamName) => {
    Alert.alert(
      'Cancel Request',
      `Are you sure you want to cancel your request to join "${teamName}"?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the request instead of updating to rejected
              // This is cleaner and avoids RLS issues
              const { error } = await supabase
                .from('team_join_requests')
                .delete()
                .eq('id', requestId)
                .eq('user_id', userProfile.id);

              if (error) {
                console.error('Error cancelling request:', error);
                throw error;
              }

              Alert.alert('Success', 'Request cancelled.');
              await loadRequests();
            } catch (error) {
              console.error('Error cancelling request:', error);
              Alert.alert('Error', error.message || 'Failed to cancel request. Please try again.');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FFD700';
      case 'accepted':
        return '#00ff00';
      case 'rejected':
        return '#ff4444';
      default:
        return '#9ca3af';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      default:
        return status;
    }
  };

  const getLeagueColor = (league) => {
    const colors = {
      'Bronze': '#CD7F32',
      'Silver': '#C0C0C0',
      'Gold': '#FFD700',
      'Platinum': '#E5E4E2',
      'Diamond': '#B9F2FF',
      'Master': '#9B59B6',
    };
    return colors[league] || '#ffffff';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
        </View>
      </SafeAreaView>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'pending');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Join Requests</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {requests.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-outline" size={80} color="#6b7280" />
            <Text style={styles.emptyStateTitle}>No Requests</Text>
            <Text style={styles.emptyStateDescription}>
              You haven't sent any join requests yet.
            </Text>
          </View>
        ) : (
          <>
            {/* Pending Requests */}
            {pendingRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Requests</Text>
                {pendingRequests.map((request) => (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      {request.team_avatar ? (
                        <Image source={{ uri: request.team_avatar }} style={styles.teamAvatar} />
                      ) : (
                        <View style={styles.teamAvatarPlaceholder}>
                          <Ionicons name="people" size={24} color="#00ffff" />
                        </View>
                      )}
                      <View style={styles.requestInfo}>
                        <Text style={styles.teamName}>{request.team_name}</Text>
                        <View style={styles.teamBadge}>
                          <View 
                            style={[
                              styles.leagueDot, 
                              { backgroundColor: getLeagueColor(request.team_league) }
                            ]} 
                          />
                          <Text style={styles.teamLeague}>{request.team_league}</Text>
                          <Text style={styles.teamTrophies}>🏆 {request.team_trophies}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(request.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                          {getStatusText(request.status)}
                        </Text>
                      </View>
                    </View>
                    
                    {request.message && (
                      <Text style={styles.requestMessage}>{request.message}</Text>
                    )}

                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => handleCancelRequest(request.id, request.team_name)}
                      >
                        <Ionicons name="close-circle" size={20} color="#ff4444" />
                        <Text style={styles.cancelButtonText}>Cancel Request</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Other Requests (Accepted/Rejected) */}
            {otherRequests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Request History</Text>
                {otherRequests.map((request) => (
                  <View key={request.id} style={styles.requestCard}>
                    <View style={styles.requestHeader}>
                      {request.team_avatar ? (
                        <Image source={{ uri: request.team_avatar }} style={styles.teamAvatar} />
                      ) : (
                        <View style={styles.teamAvatarPlaceholder}>
                          <Ionicons name="people" size={24} color="#00ffff" />
                        </View>
                      )}
                      <View style={styles.requestInfo}>
                        <Text style={styles.teamName}>{request.team_name}</Text>
                        <View style={styles.teamBadge}>
                          <View 
                            style={[
                              styles.leagueDot, 
                              { backgroundColor: getLeagueColor(request.team_league) }
                            ]} 
                          />
                          <Text style={styles.teamLeague}>{request.team_league}</Text>
                        </View>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '20' }]}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor(request.status) }]} />
                        <Text style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                          {getStatusText(request.status)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  requestCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  requestHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  teamAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  teamAvatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#00ffff',
  },
  requestInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
  },
  teamBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leagueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  teamLeague: {
    fontSize: 14,
    color: '#9ca3af',
    marginRight: 12,
  },
  teamTrophies: {
    fontSize: 14,
    color: '#FFD700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestMessage: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginBottom: 16,
    paddingLeft: 76,
  },
  requestActions: {
    flexDirection: 'row',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    gap: 8,
  },
  cancelButtonText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
});

