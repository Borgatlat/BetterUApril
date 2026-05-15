import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUnits } from '../context/UnitsContext';
import { useTracking } from '../context/TrackingContext';
import { useUser } from '../context/UserContext';
import { supabase } from '../lib/supabase';
import PremiumFeature from './components/PremiumFeature';

const SettingsScreen = () => {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const { useImperial, toggleUnits } = useUnits();
  const { calories, water, updateGoal } = useTracking();
  /** Premium flag lives in UserContext (synced from subscriptions), not AuthContext */
  const { userProfile, updateProfile, isPremium } = useUser();
  const [editingField, setEditingField] = useState(null);
  const [editValue, setEditValue] = useState('');

  const handleBackToProfile = () => {
    router.replace('/(tabs)/profile');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleGoalEdit = async (type, value) => {
    try {
      // For water, allow up to 1 decimal place
      const numValue = type === 'water' 
        ? parseFloat(parseFloat(value).toFixed(1))
        : parseInt(value);
        
      if (isNaN(numValue) || numValue <= 0) {
        Alert.alert('Invalid Value', 'Please enter a valid number greater than 0');
        return;
      }

      await updateGoal(type, numValue);
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      Alert.alert('Error', 'Failed to update goal');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBackToProfile}
        >
          <Ionicons name="chevron-back" size={24} color="#00ffff" />
          <Text style={styles.backButtonText}>Back to Profile</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Go Premium button for free users */}
      {!isPremium && (
        <TouchableOpacity
          style={{
            backgroundColor: '#00ffff',
            borderRadius: 10,
            padding: 14,
            alignItems: 'center',
            marginBottom: 20,
            marginHorizontal: 20,
          }}
          onPress={() => router.push('/purchase-subscription')}
        >
          <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 18 }}>Go Premium</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Use Imperial Units</Text>
            <Switch
              value={useImperial}
              onValueChange={toggleUnits}
              trackColor={{ false: '#333', true: '#00ffff50' }}
              thumbColor={useImperial ? '#00ffff' : '#666'}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowWithBorder, { flexDirection: 'column', alignItems: 'flex-start' }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Calorie Goal</Text>
                <Text style={styles.settingValue}>{calories.goal} cal</Text>
              </View>
              <View style={{ position: 'relative', width: 35, height: 35 }}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    if (isPremium) {
                      setEditingField('calorie_goal');
                      setEditValue(calories.goal.toString());
                    }
                  }}
                  disabled={!isPremium}
                >
                  <Ionicons name="pencil" size={20} color="#00ffff" />
                </TouchableOpacity>
                {!isPremium && (
                  <View style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    borderRadius: 17.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    pointerEvents: 'auto',
                  }}>
                    <Ionicons name="lock-closed" size={28} color="#fff" style={{ opacity: 0.85 }} />
                  </View>
                )}
              </View>
            </View>
            {!isPremium && (
              <Text style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginTop: 8, alignSelf: 'center', width: '100%', fontWeight: '500', letterSpacing: 0.1 }}>
                Upgrade to Premium in the settings
              </Text>
            )}
          </View>

          <View style={[styles.settingRow, styles.settingRowWithBorder, { flexDirection: 'column', alignItems: 'flex-start' }]}> 
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Water Goal</Text>
                <Text style={styles.settingValue}>{water.goal} L</Text>
              </View>
              <View style={{ position: 'relative', width: 35, height: 35 }}>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    if (isPremium) {
                      setEditingField('water_goal');
                      setEditValue(water.goal.toString());
                    }
                  }}
                  disabled={!isPremium}
                >
                  <Ionicons name="pencil" size={20} color="#00ffff" />
                </TouchableOpacity>
                {!isPremium && (
                  <View style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: '100%',
                    height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.45)',
                    borderRadius: 17.5,
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                    pointerEvents: 'auto',
                  }}>
                    <Ionicons name="lock-closed" size={28} color="#fff" style={{ opacity: 0.85 }} />
                  </View>
                )}
              </View>
            </View>
            {!isPremium && (
              <Text style={{ color: '#ff4444', fontSize: 13, textAlign: 'center', marginTop: 8, alignSelf: 'center', width: '100%', fontWeight: '500', letterSpacing: 0.1 }}>
                Upgrade to Premium in the settings
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.privacyInfo}>
              <View style={styles.privacyHeader}>
                <Ionicons 
                  name={userProfile?.is_profile_public === true ? "earth-outline" : "lock-closed-outline"} 
                  size={20} 
                  color="#00ffff" 
                  style={{ marginRight: 10 }}
                />
                <Text style={styles.settingLabel}>Public Profile</Text>
              </View>
              <Text style={styles.privacyDescription}>
                {userProfile?.is_profile_public === true 
                  ? 'Others can see your stats and activities' 
                  : 'Your stats and activities are hidden'}
              </Text>
            </View>
            <Switch
              value={userProfile?.is_profile_public === true}
              onValueChange={async (value) => {
                try {
                  const { error } = await supabase
                    .from('profiles')
                    .update({ is_profile_public: value })
                    .eq('id', user?.id);
                  if (error) throw error;
                  if (updateProfile) {
                    updateProfile({ is_profile_public: value });
                  }
                } catch (error) {
                  console.error('Error updating privacy:', error);
                  Alert.alert('Error', 'Failed to update privacy setting');
                }
              }}
              trackColor={{ false: '#333', true: 'rgba(0, 255, 255, 0.4)' }}
              thumbColor={userProfile?.is_profile_public === true ? '#00ffff' : '#888'}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity 
            style={styles.settingButton}
              onPress={handleSignOut}
            >
              <Text style={styles.dangerText}>Sign Out</Text>
              <Ionicons name="log-out-outline" size={20} color="#ff4444" />
            </TouchableOpacity>
        </View>
      </View>

      {editingField && (
        <Modal
          visible={true}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setEditingField(null)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingField === 'calorie_goal' ? 'Edit Calorie Goal' : 'Edit Water Goal'}
              </Text>
              <View style={styles.modalInputContainer}>
                <TextInput
                  style={styles.modalInput}
                  value={editValue}
                  onChangeText={setEditValue}
                  keyboardType="decimal-pad"
                  placeholder={editingField === 'calorie_goal' ? 'Enter calorie goal' : 'Enter water goal'}
                  placeholderTextColor="#666"
                />
                <Text style={styles.modalInputLabel}>
                  {editingField === 'calorie_goal' ? 'calories' : 'L'}
                </Text>
              </View>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setEditingField(null);
                    setEditValue('');
                  }}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={() => handleGoalEdit(
                    editingField === 'calorie_goal' ? 'calories' : 'water',
                    editValue
                  )}
                >
                  <Text style={styles.buttonText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 60,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 25,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  editButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  dangerText: {
    fontSize: 16,
    color: '#ff4444',
    letterSpacing: 0.3,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  modalInput: {
    backgroundColor: '#222',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  modalInputLabel: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#333',
  },
  saveButton: {
    backgroundColor: '#00ffff',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  settingRowWithBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 10,
    paddingTop: 20,
  },
  privacyInfo: {
    flex: 1,
    marginRight: 15,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  privacyDescription: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
    marginLeft: 30,
  },
});

export default SettingsScreen; 