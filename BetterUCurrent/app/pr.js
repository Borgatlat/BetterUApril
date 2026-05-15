import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Animated,
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useUser } from '../context/UserContext';
import { useUnits } from '../context/UnitsContext';
import { LineChart } from 'react-native-chart-kit';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

const PersonalRecordsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userProfile } = useUser();
  const { useImperial, getWeightUnit } = useUnits();
  
  // State management
  const [personalRecords, setPersonalRecords] = useState([]);
  const [prHistory, setPrHistory] = useState({});
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [newPR, setNewPR] = useState({
    exercise_name: '',
    exercise_type: 'weight',
    current_weight_kg: '',
    target_weight_kg: '',
    current_time_minutes: '',
    target_time_minutes: '',
    distance_meters: '',
    notes: ''
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    fetchPersonalRecords();
    animateIn();
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Fetch personal records from Supabase
  const fetchPersonalRecords = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPersonalRecords(data || []);
      
      // Fetch history for each PR
      if (data && data.length > 0) {
        const prIds = data.map(pr => pr.id);
        const { data: historyData, error: historyError } = await supabase
          .from('personal_record_history')
          .select('*')
          .in('pr_id', prIds)
          .order('updated_at', { ascending: true });

        if (!historyError && historyData) {
          const historyMap = {};
          historyData.forEach(entry => {
            if (!historyMap[entry.pr_id]) {
              historyMap[entry.pr_id] = [];
            }
            historyMap[entry.pr_id].push(entry);
          });
          setPrHistory(historyMap);
        }
      }
    } catch (error) {
      console.error('Error fetching PRs:', error);
      Alert.alert('Error', 'Failed to load personal records');
    } finally {
      setLoading(false);
    }
  };

  // Convert weight from display unit to kg for storage
  const convertWeightToKg = (displayValue) => {
    if (!displayValue) return null;
    const value = parseFloat(displayValue);
    return useImperial ? value / 2.20462 : value; // Convert lbs to kg if imperial
  };

  // Convert weight from kg to display unit
  const convertWeightFromKg = (kgValue) => {
    if (!kgValue) return '';
    return useImperial ? (kgValue * 2.20462).toFixed(1) : kgValue.toFixed(1);
  };

  // Save personal record
  const savePersonalRecord = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Validate required fields
      if (!newPR.exercise_name.trim()) {
        Alert.alert('Error', 'Please enter an exercise name');
        return;
      }

      if (newPR.exercise_type === 'weight') {
        if (!newPR.current_weight_kg || !newPR.target_weight_kg) {
          Alert.alert('Error', 'Please enter both current and target weights');
          return;
        }
      } else {
        if (!newPR.current_time_minutes || !newPR.target_time_minutes) {
          Alert.alert('Error', 'Please enter both current and target times');
          return;
        }
      }

      const prData = {
        user_id: user.id,
        exercise_name: newPR.exercise_name.trim(),
        exercise_type: newPR.exercise_type,
        current_weight_kg: newPR.exercise_type === 'weight' ? convertWeightToKg(newPR.current_weight_kg) : null,
        target_weight_kg: newPR.exercise_type === 'weight' ? convertWeightToKg(newPR.target_weight_kg) : null,
        current_time_minutes: newPR.exercise_type !== 'weight' ? parseFloat(newPR.current_time_minutes) : null,
        target_time_minutes: newPR.exercise_type !== 'weight' ? parseFloat(newPR.target_time_minutes) : null,
        distance_meters: newPR.exercise_type !== 'weight' ? (parseFloat(newPR.distance_meters) * 1000) || null : null,
        notes: newPR.notes.trim()
      };

      if (selectedPR) {
        // Update existing PR
        const { error } = await supabase
          .from('personal_records')
          .update(prData)
          .eq('id', selectedPR.id);

        if (error) throw error;
        Alert.alert('Success', 'Personal record updated!');
      } else {
        // Create new PR
        const { error } = await supabase
          .from('personal_records')
          .insert([prData]);

        if (error) throw error;
        Alert.alert('Success', 'Personal record added!');
      }

      // Reset form and close modal
      resetForm();
      setModalVisible(false);
      setEditModalVisible(false);
      fetchPersonalRecords();
    } catch (error) {
      console.error('Error saving PR:', error);
      Alert.alert('Error', 'Failed to save personal record');
    }
  };

  // Delete personal record
  const deletePersonalRecord = async () => {
    try {
      const { error } = await supabase
        .from('personal_records')
        .delete()
        .eq('id', selectedPR.id);

      if (error) throw error;
      
      Alert.alert('Success', 'Personal record deleted!');
      setDeleteModalVisible(false);
      setSelectedPR(null);
      fetchPersonalRecords();
    } catch (error) {
      console.error('Error deleting PR:', error);
      Alert.alert('Error', 'Failed to delete personal record');
    }
  };

  // Reset form
  const resetForm = () => {
    setNewPR({
      exercise_name: '',
      exercise_type: 'weight',
      current_weight_kg: '',
      target_weight_kg: '',
      current_time_minutes: '',
      target_time_minutes: '',
      distance_meters: '',
      notes: ''
    });
    setSelectedPR(null);
  };

  // Format weight for display
  const formatWeight = (kg) => {
    if (!kg) return '0';
    if (useImperial) {
      return (kg * 2.20462).toFixed(1);
    }
    return kg.toFixed(1);
  };

  // Format time for display
  const formatTime = (minutes) => {
    if (!minutes) return '0:00';
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    const secs = Math.floor((minutes % 1) * 60);
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage
  const calculateProgress = (current, target, exerciseType) => {
    if (!current || !target) return 0;
    
    if (exerciseType === 'weight') {
      // For weight: higher is better (current/target)
      return Math.min((current / target) * 100, 100);
    } else {
      // For running/biking: lower is better (target/current)
      // If current time is higher than target, progress is less than 100%
      return Math.min((target / current) * 100, 100);
    }
  };

  // Get progress color based on percentage
  const getProgressColor = (progress) => {
    if (progress >= 100) return ['#00ff88', '#00cc66'];
    if (progress >= 75) return ['#00ffff', '#0088ff'];
    if (progress >= 50) return ['#ffaa00', '#ff8800'];
    return ['#ff4444', '#cc3333'];
  };

  // Generate prediction data for when user will hit target
  const generatePredictionData = (history, currentValue, targetValue, exerciseType) => {
    if (!history || history.length < 2) return null;

    // Calculate average improvement rate
    let totalImprovement = 0;
    let improvementCount = 0;

    for (let i = 1; i < history.length; i++) {
      const prevValue = exerciseType === 'weight' 
        ? history[i-1].weight_kg 
        : history[i-1].time_minutes;
      const currentValue = exerciseType === 'weight' 
        ? history[i].weight_kg 
        : history[i].time_minutes;

      if (exerciseType === 'weight') {
        // For weight: improvement is increase when higher is better
        if (currentValue > prevValue) {
          totalImprovement += (currentValue - prevValue) / prevValue;
          improvementCount++;
        }
      } else {
        // For running/biking: improvement is decrease when lower is better
        if (currentValue < prevValue) {
          totalImprovement += (prevValue - currentValue) / prevValue;
          improvementCount++;
        }
      }
    }

    if (improvementCount === 0) return null;

    const avgImprovementRate = totalImprovement / improvementCount;
    const weeksBetweenUpdates = Math.max(1, Math.floor(history.length / 2)); // Estimate weeks between updates

    // Generate prediction points
    const predictionData = [];
    const labels = [];
    let projectedValue = currentValue;
    let week = 0;

    // Add current value
    predictionData.push(exerciseType === 'weight' 
      ? parseFloat(formatWeight(projectedValue)) 
      : projectedValue);
    labels.push('Now');

    // Project forward
    while (projectedValue !== targetValue && week < 20) { // Max 20 weeks projection
      week += weeksBetweenUpdates;
      
      if (exerciseType === 'weight') {
        projectedValue = projectedValue * (1 + avgImprovementRate);
        if (projectedValue >= targetValue) {
          projectedValue = targetValue;
          predictionData.push(parseFloat(formatWeight(projectedValue)));
          labels.push(`+${week}w`);
          break;
        }
      } else {
        projectedValue = projectedValue * (1 - avgImprovementRate);
        if (projectedValue <= targetValue) {
          projectedValue = targetValue;
          predictionData.push(projectedValue);
          labels.push(`+${week}w`);
          break;
        }
      }

      predictionData.push(exerciseType === 'weight' 
        ? parseFloat(formatWeight(projectedValue)) 
        : projectedValue);
      labels.push(`+${week}w`);
    }

    return {
      labels,
      datasets: [{
        data: predictionData,
        color: (opacity = 1) => `rgba(0, 255, 136, ${opacity})`, // Green for prediction
        strokeWidth: 2,
        strokeDashArray: [5, 5] // Dashed line for prediction
      }]
    };
  };

  // Start editing PR
  const startEditing = (pr) => {
    setSelectedPR(pr);
    setNewPR({
      exercise_name: pr.exercise_name,
      exercise_type: pr.exercise_type,
      current_weight_kg: pr.exercise_type === 'weight' ? convertWeightFromKg(pr.current_weight_kg) : '',
      target_weight_kg: pr.exercise_type === 'weight' ? convertWeightFromKg(pr.target_weight_kg) : '',
      current_time_minutes: pr.exercise_type !== 'weight' ? pr.current_time_minutes?.toString() || '' : '',
      target_time_minutes: pr.exercise_type !== 'weight' ? pr.target_time_minutes?.toString() || '' : '',
      distance_meters: pr.distance_meters ? (pr.distance_meters / 1000).toString() : '',
      notes: pr.notes || ''
    });
    setEditModalVisible(true);
  };

  // Show info modal
  const showInfo = (pr) => {
    setSelectedPR(pr);
    setInfoModalVisible(true);
  };

  // Show delete confirmation
  const showDeleteConfirmation = (pr) => {
    setSelectedPR(pr);
    setDeleteModalVisible(true);
  };

  // Render PR Card
  const renderPRCard = (pr) => {
    const isWeightPR = pr.exercise_type === 'weight';
    const currentValue = isWeightPR ? pr.current_weight_kg : pr.current_time_minutes;
    const targetValue = isWeightPR ? pr.target_weight_kg : pr.target_time_minutes;
    const progress = calculateProgress(currentValue, targetValue, pr.exercise_type);
    const progressColors = getProgressColor(progress);

    return (
      <Animated.View 
        key={pr.id} 
        style={[
          styles.prCard,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}
      >
        <LinearGradient
          colors={['#1a1a1a', '#0d0d0d']}
          style={styles.prCardGradient}
        >
          <View style={styles.prCardContent}>
            {/* Header */}
            <View style={styles.prHeader}>
              <View style={styles.prTitleContainer}>
                <LinearGradient
                  colors={['#00ffff', '#0088ff']}
                  style={styles.iconContainer}
                >
                  <Ionicons 
                    name={isWeightPR ? "barbell" : "fitness"} 
                    size={20} 
                    color="#000" 
                  />
                </LinearGradient>
                <Text style={styles.prExercise}>{pr.exercise_name}</Text>
              </View>
              <View style={styles.prActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => showInfo(pr)}
                >
                  <Ionicons name="information-circle" size={18} color="#00ffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => startEditing(pr)}
                >
                  <Ionicons name="pencil" size={18} color="#00ffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => showDeleteConfirmation(pr)}
                >
                  <Ionicons name="trash" size={18} color="#ff4444" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Current Value (Prominent) */}
            <View style={styles.currentValueContainer}>
              <Text style={styles.currentValueLabel}>Current</Text>
              <Text style={styles.currentValue}>
                {isWeightPR 
                  ? `${formatWeight(currentValue)} ${getWeightUnit()}`
                  : formatTime(currentValue)
                }
              </Text>
            </View>

            {/* Target Value (Less Prominent) */}
            <View style={styles.targetValueContainer}>
              <Text style={styles.targetValueLabel}>Target</Text>
              <Text style={styles.targetValue}>
                {isWeightPR 
                  ? `${formatWeight(targetValue)} ${getWeightUnit()}`
                  : formatTime(targetValue)
                }
              </Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <LinearGradient
                  colors={progressColors}
                  style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
              </View>
              <Text style={styles.progressText}>{progress.toFixed(1)}%</Text>
            </View>

            {/* Notes */}
            {pr.notes && (
              <Text style={styles.prNotes} numberOfLines={2}>{pr.notes}</Text>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  // Render form fields
  const renderFormFields = () => (
    <>
      {/* Exercise Name */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Exercise Name</Text>
        <View style={styles.textInputContainer}>
          <TextInput
            style={styles.textInput}
            value={newPR.exercise_name}
            onChangeText={(text) => setNewPR({ ...newPR, exercise_name: text })}
            placeholder="e.g., Bench Press, 5K Run"
            placeholderTextColor="#666"
          />
        </View>
      </View>

      {/* Exercise Type */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Exercise Type</Text>
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              newPR.exercise_type === 'weight' && styles.typeButtonActive
            ]}
            onPress={() => setNewPR({ ...newPR, exercise_type: 'weight' })}
          >
            <Ionicons 
              name="barbell" 
              size={18} 
              color={newPR.exercise_type === 'weight' ? '#000' : '#666'} 
            />
            <Text style={[
              styles.typeButtonText,
              newPR.exercise_type === 'weight' && styles.typeButtonTextActive
            ]}>Weight</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              newPR.exercise_type === 'running' && styles.typeButtonActive
            ]}
            onPress={() => setNewPR({ ...newPR, exercise_type: 'running' })}
          >
            <Ionicons 
              name="fitness" 
              size={18} 
              color={newPR.exercise_type === 'running' ? '#000' : '#666'} 
            />
            <Text style={[
              styles.typeButtonText,
              newPR.exercise_type === 'running' && styles.typeButtonTextActive
            ]}>Running</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              newPR.exercise_type === 'biking' && styles.typeButtonActive
            ]}
            onPress={() => setNewPR({ ...newPR, exercise_type: 'biking' })}
          >
            <Ionicons 
              name="bicycle" 
              size={18} 
              color={newPR.exercise_type === 'biking' ? '#000' : '#666'} 
            />
            <Text style={[
              styles.typeButtonText,
              newPR.exercise_type === 'biking' && styles.typeButtonTextActive
            ]}>Biking</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Weight Fields */}
      {newPR.exercise_type === 'weight' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Weight ({getWeightUnit()})</Text>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={newPR.current_weight_kg}
                onChangeText={(text) => setNewPR({ ...newPR, current_weight_kg: text })}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Target Weight ({getWeightUnit()})</Text>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={newPR.target_weight_kg}
                onChangeText={(text) => setNewPR({ ...newPR, target_weight_kg: text })}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
        </>
      )}

      {/* Running/Biking Fields */}
      {newPR.exercise_type !== 'weight' && (
        <>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Distance (km)</Text>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={newPR.distance_meters}
                onChangeText={(text) => setNewPR({ ...newPR, distance_meters: text })}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Current Time (minutes)</Text>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={newPR.current_time_minutes}
                onChangeText={(text) => setNewPR({ ...newPR, current_time_minutes: text })}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Target Time (minutes)</Text>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={newPR.target_time_minutes}
                onChangeText={(text) => setNewPR({ ...newPR, target_time_minutes: text })}
                placeholder="0"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
            </View>
          </View>
        </>
      )}

      {/* Notes */}
      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Notes (Optional)</Text>
        <View style={styles.textInputContainer}>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={newPR.notes}
            onChangeText={(text) => setNewPR({ ...newPR, notes: text })}
            placeholder="Add any notes..."
            placeholderTextColor="#666"
            multiline
            numberOfLines={3}
          />
        </View>
      </View>
    </>
  );

  // Render Add PR Modal
  const renderAddModal = () => (
    <Modal
      visible={modalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <BlurView intensity={80} style={styles.modalBlur}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1a1a1a', '#000']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Personal Record</Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {renderFormFields()}
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={savePersonalRecord}
                >
                  <LinearGradient
                    colors={['#00ffff', '#0088ff']}
                    style={styles.saveButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.saveButtonText}>Save Personal Record</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Render Edit Modal
  const renderEditModal = () => (
    <Modal
      visible={editModalVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setEditModalVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <BlurView intensity={80} style={styles.modalBlur}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#1a1a1a', '#000']}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Personal Record</Text>
                <TouchableOpacity
                  onPress={() => setEditModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {renderFormFields()}
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={savePersonalRecord}
                >
                  <LinearGradient
                    colors={['#00ffff', '#0088ff']}
                    style={styles.saveButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.saveButtonText}>Update Personal Record</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );

  // Render Info Modal with graphs and stats
  const renderInfoModal = () => {
    if (!selectedPR) return null;

    const history = prHistory[selectedPR.id] || [];
    const isWeightPR = selectedPR.exercise_type === 'weight';

    // Generate chart data
    const chartData = {
      labels: history.length > 0 ? history.map((_, index) => `${index + 1}`) : ['Now'],
      datasets: [{
        data: history.length > 0 
          ? history.map(entry => isWeightPR ? parseFloat(formatWeight(entry.weight_kg)) : entry.time_minutes)
          : [isWeightPR ? parseFloat(formatWeight(selectedPR.current_weight_kg)) : selectedPR.current_time_minutes],
        color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
        strokeWidth: 3
      }]
    };

    return (
      <Modal
        visible={infoModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <BlurView intensity={80} style={styles.modalBlur}>
            <View style={styles.infoModalContent}>
              <LinearGradient
                colors={['#1a1a1a', '#000']}
                style={styles.modalGradient}
              >
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedPR.exercise_name} Details</Text>
                  <TouchableOpacity
                    onPress={() => setInfoModalVisible(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* Progress Chart */}
                  {history.length > 0 && (
                    <View style={styles.chartSection}>
                      <Text style={styles.sectionTitle}>Progress History</Text>
                      <View style={styles.chartContainer}>
                        <LineChart
                          data={chartData}
                          width={width * 0.8}
                          height={220}
                          chartConfig={{
                            backgroundColor: '#000',
                            backgroundGradientFrom: '#000',
                            backgroundGradientTo: '#000',
                            decimalPlaces: isWeightPR ? 1 : 0,
                            color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                            style: { borderRadius: 16 }
                          }}
                          bezier
                          style={styles.chart}
                        />
                      </View>
                    </View>
                  )}

                  {/* Prediction Chart */}
                  {history.length > 1 && (() => {
                    const predictionData = generatePredictionData(
                      history,
                      isWeightPR ? selectedPR.current_weight_kg : selectedPR.current_time_minutes,
                      isWeightPR ? selectedPR.target_weight_kg : selectedPR.target_time_minutes,
                      selectedPR.exercise_type
                    );
                    
                    return predictionData && (
                      <View style={styles.chartSection}>
                        <Text style={styles.sectionTitle}>Target Prediction</Text>
                        <View style={styles.chartContainer}>
                          <LineChart
                            data={predictionData}
                            width={width * 0.8}
                            height={220}
                            chartConfig={{
                              backgroundColor: '#000',
                              backgroundGradientFrom: '#000',
                              backgroundGradientTo: '#000',
                              decimalPlaces: isWeightPR ? 1 : 0,
                              color: (opacity = 1) => `rgba(0, 255, 136, ${opacity})`,
                              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                              style: { borderRadius: 16 }
                            }}
                            bezier
                            style={styles.chart}
                          />
                        </View>
                        <Text style={styles.predictionNote}>
                          Based on your improvement rate, you should reach your target in {predictionData.labels[predictionData.labels.length - 1]}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Stats */}
                  <View style={styles.statsSection}>
                    <Text style={styles.sectionTitle}>Statistics</Text>
                    <View style={styles.statsGrid}>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Current</Text>
                        <Text style={styles.statValue}>
                          {isWeightPR 
                            ? `${formatWeight(selectedPR.current_weight_kg)} ${getWeightUnit()}`
                            : formatTime(selectedPR.current_time_minutes)
                          }
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Target</Text>
                        <Text style={styles.statValue}>
                          {isWeightPR 
                            ? `${formatWeight(selectedPR.target_weight_kg)} ${getWeightUnit()}`
                            : formatTime(selectedPR.target_time_minutes)
                          }
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Progress</Text>
                        <Text style={styles.statValue}>
                          {calculateProgress(
                            isWeightPR ? selectedPR.current_weight_kg : selectedPR.current_time_minutes,
                            isWeightPR ? selectedPR.target_weight_kg : selectedPR.target_time_minutes,
                            selectedPR.exercise_type
                          ).toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statLabel}>Updates</Text>
                        <Text style={styles.statValue}>{history.length}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Notes */}
                  {selectedPR.notes && (
                    <View style={styles.notesSection}>
                      <Text style={styles.sectionTitle}>Notes</Text>
                      <Text style={styles.notesText}>{selectedPR.notes}</Text>
                    </View>
                  )}
                </ScrollView>
              </LinearGradient>
            </View>
          </BlurView>
        </View>
      </Modal>
    );
  };

  // Render Delete Confirmation Modal
  const renderDeleteModal = () => (
    <Modal
      visible={deleteModalVisible}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setDeleteModalVisible(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.deleteModalContent}>
          <Text style={styles.deleteModalTitle}>Delete Personal Record</Text>
          <Text style={styles.deleteModalText}>
            Are you sure you want to delete "{selectedPR?.exercise_name}"? This action cannot be undone.
          </Text>
          <View style={styles.deleteModalButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setDeleteModalVisible(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={deletePersonalRecord}
            >
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#000', '#111', '#000']}
        style={styles.gradient}
      >
        <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <LinearGradient
              colors={['#0a0a0a', '#000000']}
              style={styles.headerGradient}
            >
              <View style={styles.headerContent}>
                <TouchableOpacity 
                  onPress={() => router.back()}
                  style={styles.backButton}
                >
                  <Ionicons name="arrow-back" size={24} color="#00ffff" />
                </TouchableOpacity>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.title}>Personal Records</Text>
                  <Text style={styles.subtitle}>Track your fitness goals</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    resetForm();
                    setModalVisible(true);
                  }}
                  style={styles.addButton}
                >
                  <LinearGradient
                    colors={['#00ffff', '#0088ff']}
                    style={styles.addButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="add" size={24} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading personal records...</Text>
              </View>
            ) : personalRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={['#00ffff', '#0088ff']}
                  style={styles.emptyStateIcon}
                >
                  <Ionicons name="trophy" size={48} color="#000" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>No Personal Records Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add your first personal record to start tracking your progress
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    resetForm();
                    setModalVisible(true);
                  }}
                >
                  <LinearGradient
                    colors={['#00ffff', '#0088ff']}
                    style={styles.emptyStateButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.emptyStateButtonText}>Add Your First PR</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.recordsList}>
                {personalRecords.map(renderPRCard)}
              </View>
            )}
          </ScrollView>

          {/* Modals */}
          {renderAddModal()}
          {renderEditModal()}
          {renderInfoModal()}
          {renderDeleteModal()}
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    marginBottom: 20,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  addButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  addButtonGradient: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  emptyStateButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  emptyStateButtonGradient: {
    paddingVertical: 15,
    paddingHorizontal: 30,
  },
  emptyStateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recordsList: {
    paddingBottom: 20,
  },
  prCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  prCardGradient: {
    padding: 1,
    borderRadius: 16,
  },
  prCardContent: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  prTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  prExercise: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 12,
  },
  prActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentValueContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  currentValueLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  currentValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  targetValueContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  targetValueLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  targetValue: {
    fontSize: 18,
    color: '#ccc',
  },
  progressContainer: {
    marginBottom: 15,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  prNotes: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBlur: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#222',
  },
  infoModalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#222',
  },
  modalGradient: {
    borderRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  modalScroll: {
    maxHeight: '80%',
  },
  inputGroup: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '500',
  },
  textInputContainer: {
    backgroundColor: '#333',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#555',
  },
  textInput: {
    padding: 15,
    fontSize: 16,
    color: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 4,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  typeButtonActive: {
    backgroundColor: '#00ffff',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#000',
  },
  saveButton: {
    margin: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  chartSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  chartContainer: {
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  predictionNote: {
    fontSize: 14,
    color: '#00ff88',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  statsSection: {
    padding: 20,
    paddingTop: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  notesSection: {
    padding: 20,
    paddingTop: 0,
  },
  notesText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  deleteModalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 30,
    width: '90%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#222',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  deleteModalText: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 22,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    gap: 15,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#ff4444',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default PersonalRecordsScreen;