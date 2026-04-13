import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupAvatar } from './GroupAvatar';

const GroupList = ({ 
  groups = [], 
  loading = false, 
  onGroupPress, 
  onJoinGroup, 
  onLeaveGroup,
  userGroups = [],
  showActions = true,
  emptyStateText = "No groups found",
  emptyStateIcon = "people-outline"
}) => {
  
  const renderGroupItem = ({ item }) => {
    const isMember = userGroups.some(g => g.id === item.id);
    
    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => onGroupPress?.(item)}
        activeOpacity={0.7}
      >
        <View style={styles.groupContent}>
          {/* Group Avatar on the left */}
          <View style={styles.avatarContainer}>
            <GroupAvatar
              groupName={item.name}
              size={60}
              source={item.avatar_url ? { uri: item.avatar_url } : null}
              style={styles.groupAvatar}
            />
          </View>
          
          {/* Group Info — flex:1 + minWidth:0 lets long text wrap instead of pushing past the screen edge */}
          <View style={styles.groupInfo}>
            <Text style={styles.groupName} numberOfLines={1} ellipsizeMode="tail">
              {item.name}
            </Text>

            <Text style={styles.memberCount} numberOfLines={1}>
              {item.member_count || 0} members
            </Text>

            {item.description ? (
              <Text
                style={styles.groupDescription}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {item.description}
              </Text>
            ) : null}

            {/* Privacy sits on its own row so it never gets clipped by a short fixed-height column */}
            <View style={styles.privacyRow}>
              <View style={styles.privacyChip}>
                <Ionicons
                  name={item.is_public ? 'globe' : 'lock-closed'}
                  size={14}
                  color="#888"
                />
                <Text style={styles.privacyText} numberOfLines={1}>
                  {item.is_public ? 'Public' : 'Private'}
                </Text>
              </View>
            </View>
          </View>
          
          {/* Action Button (if enabled) - Only show Join button for non-members */}
          {showActions && !isMember && (
            <View style={styles.actionContainer}>
              <TouchableOpacity
                style={styles.joinButton}
                onPress={() => onJoinGroup?.(item)}
              >
                <Text style={styles.joinButtonText}>Join</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name={emptyStateIcon} size={64} color="#666" />
      <Text style={styles.emptyStateText}>{emptyStateText}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ffff" />
        <Text style={styles.loadingText}>Loading groups...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        renderItem={renderGroupItem}
        keyExtractor={(item) => item.id.toString()}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyState}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%', // 100% width as requested
    flex: 1,
  },
  listContainer: {
    paddingVertical: 8,
    paddingBottom: 20,
  },
  groupCard: {
    width: '100%',
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
    marginHorizontal: 0,
    marginBottom: 4,
  },
  groupContent: {
    flexDirection: 'row',
    // flex-start: tall text column stays top-aligned with the Join button instead of vertically centered in a short box
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 18,
    minHeight: 88,
  },
  avatarContainer: {
    marginRight: 16,
    // No additional styling needed - avatar will be positioned on the left
  },
  groupAvatar: {
    // Avatar styling handled by GroupAvatar component
  },
  groupInfo: {
    flex: 1,
    // minWidth: 0 is important in row flex layouts: without it, Text children may refuse to shrink and can render past the screen edge
    minWidth: 0,
    paddingTop: 2,
    paddingRight: 4,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  memberCount: {
    fontSize: 14,
    color: '#00ffff',
    fontWeight: '600',
    marginBottom: 6,
  },
  groupDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 12,
  },
  // Full-width row so the privacy chip stays inside the card (no flex-end clipping on narrow screens)
  privacyRow: {
    width: '100%',
    marginTop: 2,
    marginBottom: 2,
  },
  privacyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.08)',
  },
  privacyText: {
    color: '#aaa',
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  actionContainer: {
    marginLeft: 12,
    paddingTop: 4,
    alignSelf: 'center',
  },
  joinButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  joinButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
  },
  separator: {
    height: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default GroupList;

