import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { createNotificationWithPush } from '../../../utils/notificationHelpers';

export default function ReferralCodeScreen() {
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // This function validates the referral code and creates the referral record
  const handleNext = async () => {
    // Clear previous errors
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        router.replace('/(auth)/login');
        return;
      }

      const currentUserId = session.user.id;

      // If no referral code entered, skip to next step
      if (!referralCode.trim()) {
        router.push('/(auth)/onboarding/goal-gender');
        return;
      }

      setLoading(true);

      // Normalize the referral code (remove @ if present, lowercase)
      // Usernames are stored in lowercase in the database
      const normalizedCode = referralCode.trim().replace(/^@/, '').toLowerCase();

      // Check if the referral code matches a username
      const { data: referrerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', normalizedCode)
        .maybeSingle(); // Use maybeSingle() instead of single() to avoid error when no row found

      if (profileError) {
        console.error('Error checking referral code:', profileError);
        setError('Failed to validate referral code. Please try again.');
        setLoading(false);
        return;
      }

      if (!referrerProfile) {
        setError(`Referral code "${referralCode.trim().toUpperCase()}" not found. Please check the spelling and try again.`);
        setLoading(false);
        return;
      }

      // Don't allow self-referral
      if (referrerProfile.id === currentUserId) {
        setError('You cannot use your own referral code.');
        setLoading(false);
        return;
      }

      // Check if user has already been referred (one referral per user)
      const { data: existingReferral } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', currentUserId)
        .single();

      if (existingReferral) {
        setError('You have already used a referral code.');
        setLoading(false);
        return;
      }

      // Create referral record with status 'completed'
      const { data: referralData, error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: referrerProfile.id,
          referred_id: currentUserId,
          referral_code: normalizedCode,
          status: 'completed', // Mark as completed immediately to award Sparks
          sparks_awarded: false,
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (referralError) {
        console.error('Error creating referral:', referralError);
        // Check if it's a duplicate (user might have tried twice)
        if (referralError.code === '23505') {
          setError('This referral code has already been used.');
        } else {
          setError('Failed to apply referral code. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Award Sparks immediately to both users using the database function
      if (referralData?.id) {
        try {
          const { data: sparksResult, error: sparksError } = await supabase.rpc('award_referral_sparks_immediate', {
            p_referrer_id: referrerProfile.id,
            p_referred_id: currentUserId,
            p_referral_id: referralData.id,
          });

          if (sparksError) {
            console.error('Error awarding Sparks:', sparksError);
            console.error('Referrer ID:', referrerProfile.id);
            console.error('Referred ID:', currentUserId);
            console.error('Referral ID:', referralData.id);
          } else if (sparksResult) {
            console.log('Sparks award result:', sparksResult);
            
            // Check if both users got Sparks
            if (!sparksResult.success) {
              console.error('Sparks function returned partial success:', sparksResult);
              
              // If referred user didn't get Sparks, try to award directly
              if (!sparksResult.referred_updated && sparksResult.referrer_updated) {
                console.log('Attempting to award Sparks to referred user directly...');
                const { error: directError } = await supabase
                  .from('profiles')
                  .update({ sparks_balance: (userProfile?.sparks_balance || 0) + 3 })
                  .eq('id', currentUserId);
                
                if (directError) {
                  console.error('Failed to award Sparks directly to referred user:', directError);
                } else {
                  // Update the referral record to mark as awarded
                  await supabase
                    .from('referrals')
                    .update({ sparks_awarded: true })
                    .eq('id', referralData.id);
                  console.log('Successfully awarded Sparks to referred user directly');
                }
              }
            }
          }
        } catch (sparksError) {
          console.error('Exception awarding Sparks:', sparksError);
        }
      }

      // Send notification to the referrer
      try {
        await createNotificationWithPush({
          toUserId: referrerProfile.id,
          type: 'referral_code_used',
          title: '🎉 Your Referral Code Was Used!',
          message: `Someone signed up using your referral code (${normalizedCode.toUpperCase()}). You both received 3 Sparks!`,
          data: {
            referral_code: normalizedCode,
            referred_user_id: currentUserId,
          },
          isActionable: true,
          actionType: 'navigate',
          actionData: {
            screen: 'profile',
            params: { userId: currentUserId },
          },
          priority: 2, // Medium priority
        });
      } catch (notifError) {
        console.error('Error sending notification:', notifError);
        // Don't block the flow if notification fails
      }

      // Show success message
      Alert.alert(
        'Referral Code Applied! ✨',
        `Your referral code has been successfully applied. You both received 3 Sparks! ${referrerProfile.full_name || 'Your referrer'} will be notified!`,
        [
          {
            text: 'Continue',
            onPress: () => router.push('/(auth)/onboarding/goal-gender'),
          },
        ]
      );

    } catch (error) {
      console.error('Error in handleNext:', error);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(auth)/onboarding/goal-gender');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.card}>
                <View style={styles.iconContainer}>
                  <Ionicons name="gift-outline" size={48} color="#FFD700" />
                </View>
                
                <Text style={styles.title}>Have a Referral Code?</Text>
                <Text style={styles.subtitle}>
                  Enter a friend's referral code to help them earn Sparks! This is optional - you can skip if you don't have one.
                </Text>

                <View style={styles.inputContainer}>
                  <Ionicons name="sparkles" size={24} color="#FFD700" style={styles.icon} />
                  <TextInput
                    style={styles.input}
                    value={referralCode}
                    onChangeText={(text) => {
                      setReferralCode(text);
                      setError(''); // Clear error when user types
                    }}
                    placeholder="Enter referral code (e.g., USERNAME)"
                    placeholderTextColor="#666"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    returnKeyType="done"
                    onSubmitEditing={handleNext}
                  />
                </View>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity 
                  style={[styles.button, loading && styles.buttonDisabled]} 
                  onPress={handleNext}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Apply Code</Text>
                      <Ionicons name="arrow-forward" size={20} color="#000" style={styles.buttonIcon} />
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.skipButton} 
                  onPress={handleSkip}
                  disabled={loading}
                >
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  card: {
    width: '100%',
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  icon: {
    padding: 15,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    padding: 15,
  },
  error: {
    color: '#ff4444',
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },
  skipButton: {
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#666',
    fontSize: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
});

