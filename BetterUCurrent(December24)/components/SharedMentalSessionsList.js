import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';

const { width } = Dimensions.get('window');

/**
 * SharedMentalSessionsList Component
 * 
 * This component displays mental sessions that have been shared with the user.
 * It shows both pending shares (awaiting acceptance) and accepted shared sessions.
 * 
 * Key Features:
 * - Displays pending mental session shares
 * - Shows accepted shared mental sessions
 * - Accept/decline functionality for pending shares
 * - Start shared mental sessions
 * - Delete shared mental sessions
 */
export const SharedMentalSessionsList = ({ onMentalSessionSelect }) => {
  const [pendingShares, setPendingShares] = useState([]);
  const [sharedMentalSessions, setSharedMentalSessions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { userProfile } = useUser();

  // Fetch data when component mounts
  useEffect(() => {
    fetchSharedMentalSessionsData();
  }, []);

  /**
   * Fetches both pending mental session shares and accepted shared mental sessions
   * This function combines data from two tables to show the complete picture
   */
  const fetchSharedMentalSessionsData = async () => {
    if (!userProfile?.id) {
      console.log('No userProfile.id, skipping fetch');
      return;
    }

    console.log('Fetching shared mental sessions for user:', userProfile.id);
    setIsLoading(true);
    try {
      // Fetch pending mental session shares
      const { data: shares, error: sharesError } = await supabase
        .from('mental_session_shares')
        .select('*')
        .eq('recipient_id', userProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      // Fetch sender profiles separately
      let sharesWithProfiles = [];
      if (shares && shares.length > 0) {
        const senderIds = [...new Set(shares.map(share => share.sender_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, is_premium')
          .in('id', senderIds);

        if (profilesError) {
          console.error('Error fetching sender profiles:', profilesError);
        } else {
          // Combine shares with profile data
          sharesWithProfiles = shares.map(share => ({
            ...share,
            profiles: profiles?.find(p => p.id === share.sender_id) || null
          }));
        }
      }

      if (sharesError) {
        console.error('Error fetching pending shares:', sharesError);
        throw sharesError;
      }

      // Transform shares to include mental session data from stored columns
      const sharesWithSessions = (sharesWithProfiles || []).map((share, index) => ({
        ...share,
        uniqueKey: `pending-${share.id}-${index}`,
        mentalSessions: {
          id: share.mental_session_id,
          session_name: share.session_name,
          session_type: share.session_type,
          session_description: share.session_description,
          duration: share.duration,
          steps: share.steps, // Include the actual steps
          calmness_level: share.calmness_level,
          notes: share.notes,
          photo_url: share.photo_url,
          created_at: share.created_at
        }
      }));

      // Fetch accepted shared mental sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('shared_mental_sessions')
        .select('*')
        .eq('recipient_id', userProfile.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Fetch sender profiles separately
      let sessionsWithSenders = [];
      if (sessions && sessions.length > 0) {
        const senderIds = [...new Set(sessions.map(session => session.original_sender_id))];
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, is_premium')
          .in('id', senderIds);

        if (profilesError) {
          console.error('Error fetching sender profiles:', profilesError);
        } else {
          // Combine sessions with profile data
          sessionsWithSenders = sessions.map((session, index) => ({
            ...session,
            uniqueKey: `shared-${session.id}-${index}`,
            original_sender: profiles?.find(p => p.id === session.original_sender_id) || null
          }));
        }
      }

      if (sessionsError) {
        console.error('Error fetching shared sessions:', sessionsError);
        throw sessionsError;
      }

      setPendingShares(sharesWithSessions);
      setSharedMentalSessions(sessionsWithSenders);
      
      console.log('Fetched pending shares:', sharesWithSessions.length);
      console.log('Fetched shared sessions:', sessionsWithSenders.length);
    } catch (error) {
      console.error('Error in fetchSharedMentalSessionsData:', error);
      Alert.alert('Error', 'Failed to load shared mental sessions');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles pull-to-refresh functionality
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSharedMentalSessionsData();
    setRefreshing(false);
  };

  /**
   * Handles accepting or declining a mental session share
   * @param {string} shareId - The ID of the mental session share
   * @param {string} action - 'accept' or 'decline'
   */
  const handleShareResponse = async (shareId, action) => {
    try {
      if (action === 'accept') {
        // Get the share details first
        const share = pendingShares.find(s => s.id === shareId);
        if (!share) return;

        // Create a copy in shared_mental_sessions table
        const { error: insertError } = await supabase
          .from('shared_mental_sessions')
          .insert({
            original_session_id: share.mental_session_id, // Can be from either table
            original_sender_id: share.sender_id,
            recipient_id: userProfile.id,
            session_name: share.mentalSessions?.session_name || 'Unknown Session',
            session_type: share.mentalSessions?.session_type || 'meditation',
            session_description: share.mentalSessions?.session_description || '',
            duration: share.mentalSessions?.duration || 0,
            steps: share.mentalSessions?.steps || null, // Include the actual steps
            calmness_level: share.mentalSessions?.calmness_level || null,
            notes: share.mentalSessions?.notes || null,
            photo_url: share.mentalSessions?.photo_url || null
          });

        if (insertError) throw insertError;
      }

      // Update the share status
      const { error: updateError } = await supabase
        .from('mental_session_shares')
        .update({ status: action === 'accept' ? 'accepted' : 'declined' })
        .eq('id', shareId);

      if (updateError) throw updateError;

      // Refresh the data
      await fetchSharedMentalSessionsData();

      Alert.alert(
        'Success',
        `Mental session ${action === 'accept' ? 'accepted' : 'declined'} successfully!`
      );
    } catch (error) {
      console.error('Error handling share response:', error);
      Alert.alert('Error', 'Failed to process request. Please try again.');
    }
  };

  /**
   * Handles deleting a shared mental session from the user's feed
   * This is a soft delete - sets is_active to false
   * @param {string} sessionId - The ID of the shared mental session to delete
   */
  const handleDeleteSharedSession = async (sessionId) => {
    Alert.alert(
      'Delete Mental Session',
      'Are you sure you want to remove this shared mental session from your feed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('shared_mental_sessions')
                .update({ is_active: false })
                .eq('id', sessionId);

              if (error) throw error;

              // Refresh the data
              await fetchSharedMentalSessionsData();

              Alert.alert('Success', 'Mental session removed from your feed');
            } catch (error) {
              console.error('Error deleting shared session:', error);
              Alert.alert('Error', 'Failed to delete mental session');
            }
          }
        }
      ]
    );
  };

  /**
   * Handles starting a shared mental session
   * @param {Object} sharedSession - The shared mental session to start
   */
  const handleStartSharedSession = (sharedSession) => {
    // Transform the shared session data to include steps
    const sessionWithSteps = {
      ...sharedSession,
      steps: sharedSession.steps || null // Include the actual steps from the shared session
    };
    
    if (onMentalSessionSelect) {
      onMentalSessionSelect(sessionWithSteps);
    }
  };

  /**
   * Renders a pending mental session share item
   * @param {Object} share - The pending share to render
   */
  const renderPendingShare = ({ item: share }) => {
    const sender = share.profiles;
    
    return (
      <View style={styles.shareCard}>
        <View style={styles.shareHeader}>
          <View style={styles.senderInfo}>
            <Image
              source={{ 
                uri: sender?.avatar_url || 'https://via.placeholder.com/32x32/8b5cf6/ffffff?text=' + (sender?.username?.[0] || 'U')
              }}
              style={styles.senderAvatar}
            />
            <View style={styles.senderDetails}>
              <Text style={styles.senderName}>
                {sender?.full_name || sender?.username || 'Unknown User'}
              </Text>
              <Text style={styles.shareTime}>
                {new Date(share.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
          <View style={styles.shareBadge}>
            <Text style={styles.shareBadgeText}>New</Text>
          </View>
        </View>

        <View style={styles.sessionPreview}>
          <View style={styles.sessionPreviewHeader}>
            <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6', width: 32, height: 32, marginRight: 8 }]}>
              <Ionicons name={share.mentalSessions?.session_type === 'meditation' ? 'moon' : 'leaf'} size={16} color="#fff" />
            </View>
            <View style={styles.sessionPreviewInfo}>
              <Text style={styles.sessionName}>{share.mentalSessions?.session_name || 'Mental Session'}</Text>
              <Text style={styles.sessionDetails}>
                {share.mentalSessions?.session_type || 'meditation'} • {share.mentalSessions?.duration || 0} minutes
              </Text>
            </View>
          </View>
          {share.mentalSessions?.session_description && (
            <Text style={styles.sessionDescription} numberOfLines={2}>
              {share.mentalSessions.session_description}
            </Text>
          )}
          {share.message && (
            <Text style={styles.personalMessage}>
              "{share.message}"
            </Text>
          )}
        </View>

        <View style={styles.shareActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.declineButton]}
            onPress={() => handleShareResponse(share.id, 'decline')}
          >
            <Ionicons name="close" size={16} color="#ff4444" />
            <Text style={styles.declineButtonText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleShareResponse(share.id, 'accept')}
          >
            <Ionicons name="checkmark" size={16} color="#fff" />
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /**
   * Renders an accepted shared mental session item
   * @param {Object} session - The shared session to render
   */
  const renderSharedSession = ({ item: session }) => {
    const sender = session.original_sender;
    
    return (
      <View style={styles.enhancedCustomSessionCard}>
        <TouchableOpacity
          style={styles.enhancedSessionMainContent}
          onPress={() => handleStartSharedSession(session)}
          activeOpacity={0.8}
        >
          <View style={styles.enhancedSessionIconContainer}>
            <Ionicons 
              name={session.session_type === 'meditation' ? 'moon' : session.session_type === 'breathing' ? 'leaf' : 'water'} 
              size={20} 
              color="#fff" 
            />
          </View>
          <View style={styles.enhancedSessionContent}>
            <Text style={styles.enhancedSessionTitle}>{session.session_name}</Text>
            {session.session_description && (
              <Text style={styles.enhancedSessionDescription} numberOfLines={2} ellipsizeMode="tail">
                {session.session_description}
              </Text>
            )}
            <View style={styles.enhancedSessionMeta}>
              <View style={styles.sessionMetaItem}>
                <Ionicons name="time-outline" size={10} color="#8b5cf6" />
                <Text style={styles.sessionMetaText}>{session.duration} min</Text>
              </View>
              <View style={styles.sessionMetaDivider} />
              <Text style={styles.sessionMetaText}>
                Shared by {sender?.full_name || sender?.username || 'Unknown User'}
            </Text>
            </View>
          </View>
          <View style={styles.enhancedPlayButton}>
            <Ionicons name="play" size={18} color="#fff" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.enhancedSessionActions}>
          <TouchableOpacity
            style={styles.enhancedActionButtonSmall}
            onPress={() => handleDeleteSharedSession(session.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /**
   * Renders the combined list of pending shares and shared sessions
   */
  const renderCombinedList = () => {
    const allItems = [
      ...pendingShares.map(share => ({ ...share, type: 'pending' })),
      ...sharedMentalSessions.map(session => ({ ...session, type: 'shared' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (allItems.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={40} color="#666" />
          <Text style={styles.emptyTitle}>No Shared Sessions</Text>
          <Text style={styles.emptyText}>
            When friends share mental sessions with you, they'll appear here
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.sessionsContainer}>
        {allItems.map((item) => (
          <View key={item.uniqueKey}>
            {item.type === 'pending' 
              ? renderPendingShare({ item })
              : renderSharedSession({ item })
            }
          </View>
        ))}
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading shared mental sessions...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor="#8b5cf6"
        />
      }
      showsVerticalScrollIndicator={false}
    >
      {renderCombinedList()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#fff',
    marginTop: 16,
    fontSize: 16,
  },
  sessionsContainer: {
    gap: 12,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  shareCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  senderDetails: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  shareTime: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  shareBadge: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  shareBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  sessionPreview: {
    marginBottom: 16,
  },
  sessionPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionPreviewInfo: {
    flex: 1,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  sessionDetails: {
    fontSize: 12,
    color: '#8b5cf6',
  },
  sessionDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
    marginBottom: 8,
  },
  personalMessage: {
    fontSize: 14,
    color: '#fff',
    fontStyle: 'italic',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 8,
  },
  shareActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  declineButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  declineButtonText: {
    color: '#ff4444',
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#8b5cf6',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Enhanced Custom Session Card Styles (matching custom session cards)
  enhancedCustomSessionCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.08)',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  enhancedSessionMainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  enhancedSessionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  enhancedSessionContent: {
    flex: 1,
  },
  enhancedSessionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  enhancedSessionDescription: {
    color: '#bbb',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  enhancedSessionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sessionMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  sessionMetaText: {
    color: '#8b5cf6',
    fontSize: 10,
    fontWeight: '600',
  },
  sessionMetaDivider: {
    width: 1,
    height: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
  },
  enhancedPlayButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  enhancedSessionActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  enhancedActionButtonSmall: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
});

export default SharedMentalSessionsList;
