"use client";

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function TeamSettingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { userProfile } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState(null);
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamAvatar, setTeamAvatar] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    loadTeamData();
  }, [id]);

  const loadTeamData = async () => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single();

      if (teamError) {
        console.error('Error fetching team:', teamError);
        setTeam(null);
        setLoading(false);
        return;
      }

      setTeam(teamData);
      setTeamName(teamData.name || '');
      setTeamDescription(teamData.description || '');
      setTeamAvatar(teamData.avatar_url);
      setIsOwner(teamData.created_by === userProfile?.id);

      // Check if user is admin and load members
      const { data: userMember } = await supabase
        .from('team_members')
        .select('role')
        .eq('team_id', id)
        .eq('user_id', userProfile?.id)
        .single();

      setIsAdmin(userMember?.role === 'admin');

      // Load members for transfer ownership modal
      if (teamData.created_by === userProfile?.id) {
        const { data: membersData } = await supabase
          .from('team_members')
          .select(`
            user_id,
            role,
            profiles:user_id (
              id,
              username,
              full_name,
              avatar_url
            )
          `)
          .eq('team_id', id)
          .neq('user_id', userProfile.id)
          .order('joined_at', { ascending: true });

        if (membersData) {
          const formattedMembers = membersData.map(m => ({
            id: m.profiles.id,
            user_id: m.user_id,
            username: m.profiles.username,
            full_name: m.profiles.full_name,
            avatar_url: m.profiles.avatar_url,
            role: m.role
          }));
          setMembers(formattedMembers);
        }
      }
    } catch (error) {
      console.error('Error loading team data:', error);
      setTeam(null);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos to change the team avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setTeamAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }

    if (teamName.length > 50) {
      Alert.alert('Error', 'Team name must be 50 characters or less');
      return;
    }

    if (!isOwner && !isAdmin) {
      Alert.alert('Error', 'Only team owners and admins can edit team settings');
      return;
    }

    setSaving(true);
    try {
      // Upload avatar if changed
      let avatarUrl = team?.avatar_url;
      if (teamAvatar && teamAvatar !== team?.avatar_url && !teamAvatar.startsWith('http')) {
        try {
          const formData = new FormData();
          formData.append('file', {
            uri: teamAvatar,
            type: 'image/jpeg',
            name: 'team-avatar.jpg',
          });
          formData.append('upload_preset', 'profilepics');
          const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/derqwaq9h/image/upload';
          
          const response = await fetch(cloudinaryUrl, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
            },
          });

          const data = await response.json();
          if (data.secure_url) {
            avatarUrl = data.secure_url;
          }
        } catch (uploadErr) {
          console.warn('Error uploading avatar:', uploadErr);
        }
      }

      // Update team
      const { error: updateError } = await supabase
        .from('teams')
        .update({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          avatar_url: avatarUrl,
        })
        .eq('id', id);

      if (updateError) throw updateError;

      Alert.alert('Success', 'Team settings updated!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error updating team:', error);
      Alert.alert('Error', error.message || 'Failed to update team settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeam = () => {
    if (!isOwner) {
      Alert.alert('Error', 'Only the team owner can delete the team');
      return;
    }

    Alert.alert(
      'Delete Team',
      'Are you sure you want to delete this team? This action cannot be undone. All members will be removed and all team data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', id);

              if (error) throw error;

              Alert.alert('Success', 'Team deleted successfully.', [
                { text: 'OK', onPress: () => router.replace({ pathname: '/(tabs)/community', params: { tab: 'league' } }) }
              ]);
            } catch (error) {
              console.error('Error deleting team:', error);
              Alert.alert('Error', 'Failed to delete team.');
            }
          }
        }
      ]
    );
  };

  const handleLeaveTeam = () => {
    if (isOwner) {
      // Check if there are other members
      if (members.length === 0) {
        // No other members, delete the team
        Alert.alert(
          'Delete Team',
          'You are the only member. Leaving will delete the team. Are you sure?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { error: deleteError } = await supabase
                    .from('teams')
                    .delete()
                    .eq('id', id);

                  if (deleteError) throw deleteError;

                  Alert.alert('Team Deleted', 'The team has been deleted.', [
                    { text: 'OK', onPress: () => router.replace({ pathname: '/(tabs)/community', params: { tab: 'league' } }) }
                  ]);
                } catch (error) {
                  console.error('Error deleting team:', error);
                  Alert.alert('Error', 'Failed to delete team.');
                }
              }
            }
          ]
        );
      } else {
        // Show transfer ownership modal
        setShowTransferModal(true);
      }
    } else {
      // Regular member leaving
      Alert.alert(
        'Leave Team',
        'Are you sure you want to leave this team?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await supabase
                  .from('team_members')
                  .delete()
                  .eq('team_id', id)
                  .eq('user_id', userProfile.id);

                if (error) throw error;

                Alert.alert('Success', 'You have left the team.', [
                  { text: 'OK', onPress: () => router.replace({ pathname: '/(tabs)/community', params: { tab: 'league' } }) }
                ]);
              } catch (error) {
                console.error('Error leaving team:', error);
                Alert.alert('Error', 'Failed to leave team.');
              }
            }
          }
        ]
      );
    }
  };

  const handleTransferOwnership = async (newOwnerId) => {
    try {
      // Use the database function to transfer ownership (bypasses RLS)
      const { error: transferError } = await supabase.rpc('transfer_team_ownership', {
        p_team_id: id,
        p_new_owner_id: newOwnerId,
        p_current_owner_id: userProfile.id
      });

      if (transferError) throw transferError;

      // Remove old owner from team
      const { error: removeError } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', id)
        .eq('user_id', userProfile.id);

      if (removeError) throw removeError;

      setShowTransferModal(false);
      Alert.alert('Success', 'Ownership has been transferred and you have left the team.', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/(tabs)/community', params: { tab: 'league' } }) }
      ]);
    } catch (error) {
      console.error('Error transferring ownership:', error);
      Alert.alert('Error', error.message || 'Failed to transfer ownership.');
    }
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

  if (!team) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Team not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canEdit = isOwner || isAdmin;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Settings</Text>
        {canEdit && (
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            {saving ? (
              <ActivityIndicator size="small" color="#00ffff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        )}
        {!canEdit && <View style={styles.placeholder} />}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Team Avatar */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Avatar</Text>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={canEdit ? pickImage : undefined}
            disabled={!canEdit}
          >
            {teamAvatar ? (
              <Image source={{ uri: teamAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="people" size={40} color="#00ffff" />
              </View>
            )}
            {canEdit && (
              <View style={styles.avatarOverlay}>
                <Ionicons name="camera" size={20} color="#ffffff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Team Name */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Name</Text>
          <TextInput
            style={[styles.input, !canEdit && styles.inputDisabled]}
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Enter team name"
            placeholderTextColor="#6b7280"
            editable={canEdit}
            maxLength={50}
          />
          <Text style={styles.characterCount}>{teamName.length}/50</Text>
        </View>

        {/* Team Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <TextInput
            style={[styles.textArea, !canEdit && styles.inputDisabled]}
            value={teamDescription}
            onChangeText={setTeamDescription}
            placeholder="Enter team description (optional)"
            placeholderTextColor="#6b7280"
            editable={canEdit}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>{teamDescription.length}/500</Text>
        </View>

        {/* Team Info (Read-only) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Team Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>League:</Text>
            <Text style={styles.infoValue}>{team.current_league || 'Bronze'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Total Trophies:</Text>
            <Text style={styles.infoValue}>🏆 {team.total_trophies || 0}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Created:</Text>
            <Text style={styles.infoValue}>
              {new Date(team.created_at).toLocaleDateString()}
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          
          <TouchableOpacity
            style={[styles.dangerButton, styles.leaveButton]}
            onPress={handleLeaveTeam}
          >
            <Ionicons name="exit-outline" size={20} color="#ff4444" />
            <Text style={styles.dangerButtonText}>
              {isOwner ? 'Leave Team (Transfer Ownership)' : 'Leave Team'}
            </Text>
          </TouchableOpacity>

          {isOwner && (
            <TouchableOpacity
              style={[styles.dangerButton, styles.deleteButton]}
              onPress={handleDeleteTeam}
            >
              <Ionicons name="trash-outline" size={20} color="#ff4444" />
              <Text style={styles.dangerButtonText}>Delete Team</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Transfer Ownership Modal */}
      <Modal
        visible={showTransferModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTransferModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transfer Ownership</Text>
              <TouchableOpacity onPress={() => setShowTransferModal(false)}>
                <Ionicons name="close" size={24} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDescription}>
              Select a member to transfer team ownership to. You will leave the team after transferring ownership.
            </Text>
            <ScrollView style={styles.membersList}>
              {members.map((member) => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberSelectItem}
                  onPress={() => {
                    Alert.alert(
                      'Confirm Transfer',
                      `Transfer ownership to ${member.full_name || member.username}?`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Transfer',
                          onPress: () => handleTransferOwnership(member.user_id)
                        }
                      ]
                    );
                  }}
                >
                  {member.avatar_url ? (
                    <Image source={{ uri: member.avatar_url }} style={styles.memberSelectAvatar} />
                  ) : (
                    <View style={styles.memberSelectAvatarPlaceholder}>
                      <Ionicons name="person" size={20} color="#00ffff" />
                    </View>
                  )}
                  <View style={styles.memberSelectInfo}>
                    <Text style={styles.memberSelectName}>
                      {member.full_name || member.username}
                    </Text>
                    <Text style={styles.memberSelectRole}>
                      {member.role === 'admin' ? '⭐ Admin' : 'Member'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#6b7280" />
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowTransferModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 16,
  },
  backLink: {
    color: '#00ffff',
    fontSize: 16,
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
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 16,
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#00ffff',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#00ffff',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00ffff',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputDisabled: {
    opacity: 0.5,
  },
  textArea: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  infoLabel: {
    fontSize: 16,
    color: '#9ca3af',
  },
  infoValue: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  leaveButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  deleteButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderWidth: 2,
    borderColor: '#ff4444',
  },
  dangerButtonText: {
    color: '#ff4444',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 20,
    lineHeight: 20,
  },
  membersList: {
    maxHeight: 400,
    marginBottom: 20,
  },
  memberSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  memberSelectAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  memberSelectAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#00ffff',
  },
  memberSelectInfo: {
    flex: 1,
  },
  memberSelectName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  memberSelectRole: {
    fontSize: 14,
    color: '#9ca3af',
  },
  modalCancelButton: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  modalCancelButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

