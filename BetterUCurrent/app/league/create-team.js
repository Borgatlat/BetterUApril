"use client";

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

export default function CreateTeamScreen() {
  const router = useRouter();
  const { userProfile } = useUser();
  const [teamName, setTeamName] = useState('');
  const [teamDescription, setTeamDescription] = useState('');
  const [teamAvatar, setTeamAvatar] = useState(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'We need access to your photos to set a team avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setTeamAvatar(result.assets[0].uri);
    }
  };

  const createTeam = async () => {
    if (!teamName.trim()) {
      Alert.alert('Error', 'Please enter a team name');
      return;
    }

    if (teamName.length > 50) {
      Alert.alert('Error', 'Team name must be 50 characters or less');
      return;
    }

    if (!userProfile?.id) {
      Alert.alert('Error', 'Please log in to create a team');
      return;
    }

    setLoading(true);
    
    try {
      // Check if user already has a team
      const { data: existingTeam, error: checkError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userProfile.id)
        .single();

      if (existingTeam) {
        setLoading(false);
        Alert.alert('Error', 'You are already in a team. Leave your current team to create a new one.');
        return;
      }

      // Upload avatar if provided (using Cloudinary like the rest of the app)
      let avatarUrl = null;
      if (teamAvatar) {
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
          } else {
            console.warn('Avatar upload failed, continuing without avatar');
          }
        } catch (uploadErr) {
          console.warn('Error uploading avatar, continuing without avatar:', uploadErr);
          // Continue without avatar - it's optional
        }
      }

      // Create team
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .insert({
          name: teamName.trim(),
          description: teamDescription.trim() || null,
          avatar_url: avatarUrl,
          created_by: userProfile.id,
        })
        .select()
        .single();

      if (teamError) {
        throw teamError;
      }

      // The trigger will automatically add the creator as owner
      // But let's verify it worked
      const { error: memberError } = await supabase
        .from('team_members')
        .select('*')
        .eq('team_id', teamData.id)
        .eq('user_id', userProfile.id)
        .single();

      if (memberError && memberError.code !== 'PGRST116') {
        // PGRST116 means no rows found, which shouldn't happen due to trigger
        console.error('Error verifying team membership:', memberError);
      }

      // Auto-enroll in active challenges
      const { data: activeChallenges } = await supabase
        .from('league_challenges')
        .select('id')
        .eq('status', 'active');

      if (activeChallenges && activeChallenges.length > 0) {
        const enrollments = activeChallenges.map(challenge => ({
          challenge_id: challenge.id,
          team_id: teamData.id,
          current_value: 0,
        }));

        await supabase
          .from('team_challenge_participants')
          .insert(enrollments);
      }

      setLoading(false);
      Alert.alert(
        'Team Created!',
        'Your team has been created successfully. You can now compete in monthly challenges!',
        [
          {
            text: 'OK',
            onPress: () => router.replace({ pathname: '/(tabs)/community', params: { tab: 'league' } })
          }
        ]
      );
    } catch (error) {
      setLoading(false);
      console.error('Error creating team:', error);
      Alert.alert('Error', error.message || 'Failed to create team. Please try again.');
    }
  };

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
        <Text style={styles.headerTitle}>Create Team</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formContainer}>
          <Text style={styles.description}>
            Create your team and start competing in monthly challenges. Teams can have up to 20 members.
          </Text>

          {/* Avatar Upload */}
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={pickImage}
          >
            {teamAvatar ? (
              <Image source={{ uri: teamAvatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="camera-outline" size={40} color="#00ffff" />
                <Text style={styles.avatarPlaceholderText}>Tap to add avatar</Text>
              </View>
            )}
            <View style={styles.avatarOverlay}>
              <Ionicons name="camera" size={20} color="#ffffff" />
            </View>
          </TouchableOpacity>

          {/* Team Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Team Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter team name (max 50 characters)"
              placeholderTextColor="#6b7280"
              value={teamName}
              onChangeText={setTeamName}
              maxLength={50}
              autoCapitalize="words"
            />
            <Text style={styles.charCount}>{teamName.length}/50</Text>
          </View>

          {/* Team Description */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Description (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell others about your team..."
              placeholderTextColor="#6b7280"
              value={teamDescription}
              onChangeText={setTeamDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle-outline" size={20} color="#00ffff" />
            <Text style={styles.infoText}>
              You can only be in one team at a time. As the creator, you'll be the team owner and can manage members.
            </Text>
          </View>

          {/* Create Button */}
          <TouchableOpacity 
            style={[
              styles.createButton,
              (!teamName.trim() || loading) && styles.createButtonDisabled
            ]}
            onPress={createTeam}
            disabled={!teamName.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000000" />
            ) : (
              <Text style={styles.createButtonText}>Create Team</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingBottom: 100,
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    lineHeight: 24,
    marginBottom: 30,
    textAlign: 'center',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 30,
    position: 'relative',
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
    borderStyle: 'dashed',
  },
  avatarPlaceholderText: {
    color: '#00ffff',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00ffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000000',
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
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
  textArea: {
    height: 100,
    paddingTop: 16,
  },
  charCount: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
    marginTop: 4,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#9ca3af',
    marginLeft: 12,
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#2a2a2a',
    shadowOpacity: 0,
  },
  createButtonText: {
    color: '#000000',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

