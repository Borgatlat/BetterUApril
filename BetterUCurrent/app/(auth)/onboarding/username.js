import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Alert,
  Platform,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../../../context/UserContext';
import { supabase } from '../../../lib/supabase';

export default function UsernameScreen() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { updateProfile } = useUser();

  const validateUsername = (username) => {
    // Username must be 3-20 characters, alphanumeric and underscores only
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
  };

  const checkUsernameAvailability = async (username) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !data; // true if username is available
  };

  const handleNext = async () => {
    if (!username) {
      setError('Please enter a username');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }

      // Check if username is available
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        setError('Username is already taken');
        Alert.alert(
          "Username Taken",
          "This username is already taken. Please choose a different one.",
          [{ text: "OK" }]
        );
        setIsLoading(false);
        return;
      }

      // Update onboarding data
      const { error: updateError } = await supabase
        .from('onboarding_data')
        .update({
          username: username,
          bio: bio
        })
        .eq('id', session.user.id);

      if (updateError) throw updateError;

      // Navigate to the next screen in the onboarding flow
      router.push('/(auth)/onboarding/age-weight');
    } catch (err) {
      console.error('Error in handleNext:', err);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Create Your Profile</Text>
          <Text style={styles.subtitle}>Choose your username and tell us about yourself</Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Enter username"
              placeholderTextColor="#666"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
            />
            {username.length > 0 && (
              <TouchableOpacity
                style={styles.clearButton}
                onPress={() => setUsername('')}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.requirements}>
            • 3-20 characters{'\n'}
            • Letters, numbers, and underscores only{'\n'}
            • Must be unique
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself (optional)"
              placeholderTextColor="#666"
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={100}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          <Text style={styles.requirements}>
            • Share your fitness journey{'\n'}
            • Mention your goals and interests{'\n'}
            • Max 100 characters
          </Text>

          <TouchableOpacity
            style={[styles.nextButton, (!username || isLoading) && styles.buttonDisabled]}
            onPress={handleNext}
            disabled={!username || isLoading}
          >
            <Text style={styles.nextButtonText}>
              {isLoading ? 'Checking...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: Platform.OS === 'ios' ? 50 : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 20,
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#B3B3B3',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    padding: 15,
    color: '#ffffff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  clearButton: {
    position: 'absolute',
    right: 15,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  requirements: {
    color: '#B3B3B3',
    fontSize: 14,
    marginBottom: 30,
    lineHeight: 20,
  },
  nextButton: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 'auto',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
}); 