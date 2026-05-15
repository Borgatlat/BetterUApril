import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, Dimensions, SafeAreaView, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { useUnits } from '../../context/UnitsContext';
import { useTracking } from '../../context/TrackingContext';
import { useNotifications } from '../../context/NotificationContext';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatNumber, formatWeight, formatPercentage } from '../../utils/formatUtils';
import { Picker } from '@react-native-picker/picker';

const { width } = Dimensions.get('window');
const chartWidth = width * 0.8;

// Generate weight arrays for both kg and lbs
const generateWeightArray = (unit) => {
  const weights = [];
  if (unit === 'kg') {
    // Generate weights from 20kg to 300kg in 2.5kg increments
    for (let i = 20; i <= 300; i += 2.5) {
      weights.push(i.toFixed(1));
    }
  } else {
    // Generate weights from 45lbs to 660lbs in 5lbs increments
    for (let i = 45; i <= 660; i += 5) {
      weights.push(i.toString());
    }
  }
  return weights;
};

const PRScreen = () => {
  const { userProfile } = useUser();
  const { getWeightUnit, convertWeight, convertWeightBack } = useUnits();
  const { stats } = useTracking();
  const { createNotification } = useNotifications();
  const [prGoals, setPRGoals] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [progressModalVisible, setProgressModalVisible] = useState(false);
  const [selectedPR, setSelectedPR] = useState(null);
  const [newPR, setNewPR] = useState({
    exercise: '',
    currentValue: getWeightUnit() === 'kg' ? '20.0' : '45',
    targetValue: getWeightUnit() === 'kg' ? '20.0' : '45',
    unit: getWeightUnit()
  });
  const [userId, setUserId] = useState(null);
  const [editingPR, setEditingPR] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const insets = useSafeAreaInsets();
  const [weightOptions, setWeightOptions] = useState(generateWeightArray(getWeightUnit()));
  const [showCurrentPicker, setShowCurrentPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Update weight options when unit changes
  useEffect(() => {
    setWeightOptions(generateWeightArray(getWeightUnit()));
  }, [getWeightUnit()]);

  // Conversion functions
  const kgToLbs = (kg) => kg * 2.20462;
  const lbsToKg = (lbs) => lbs / 2.20462;

  useEffect(() => {
    // Get the authenticated user's ID
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error('Error getting user:', error);
        return;
      }
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    setNewPR(prev => ({
      ...prev,
      unit: getWeightUnit()
    }));
  }, [getWeightUnit]);

  // Add effect to handle unit changes
  useEffect(() => {
    if (prGoals.length > 0) {
      const updatedGoals = prGoals.map(pr => {
        // If the stored unit is different from current unit, convert the values
        if (pr.unit !== getWeightUnit()) {
          const currentValue = pr.unit === 'kg' ? kgToLbs(pr.current_value) : lbsToKg(pr.current_value);
          const targetValue = pr.unit === 'kg' ? kgToLbs(pr.target_value) : lbsToKg(pr.target_value);
          return {
            ...pr,
            current_value: Math.round(currentValue),
            target_value: Math.round(targetValue),
            unit: getWeightUnit()
          };
        }
        return pr;
      });
      setPRGoals(updatedGoals);
    }
  }, [getWeightUnit()]);

  const fetchPRGoals = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from('personal_records')
        .select('*')
        .eq('profile_id', userId);
      
      if (error) throw error;

      const convertedData = data?.map(pr => ({
        id: pr.id,
        exercise: pr.exercise,
        // Always store the raw kg values from the database
        current_value: pr.weight_current,
        target_value: pr.weight_target,
        unit: getWeightUnit(),
        created_at: pr.created_at
      })) || [];

      // Convert to current unit
      const finalData = convertedData.map(pr => ({
        ...pr,
        current_value: getWeightUnit() === 'lbs' ? Math.round(kgToLbs(pr.current_value)) : Math.round(pr.current_value),
        target_value: getWeightUnit() === 'lbs' ? Math.round(kgToLbs(pr.target_value)) : Math.round(pr.target_value)
      }));

      setPRGoals(finalData);
    } catch (error) {
      console.error('Error fetching PR goals:', error);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchPRGoals();
    }
  }, [userId, userProfile]);

  const { incrementStat } = useTracking();

  const savePRGoal = async () => {
    if (!userId) {
      console.error('No user ID available');
      return;
    }

    try {
      let currentValueInKg = parseFloat(newPR.currentValue);
      let targetValueInKg = parseFloat(newPR.targetValue);

      if (getWeightUnit() === 'lbs') {
        currentValueInKg = lbsToKg(currentValueInKg);
        targetValueInKg = lbsToKg(targetValueInKg);
      }

      const { data, error } = await supabase
        .from('personal_records')
        .insert([{
          profile_id: userId,
          exercise: newPR.exercise,
          weight_current: currentValueInKg,
          weight_target: targetValueInKg,
          weight_unit: 'kg',
          created_at: new Date().toISOString()
        }]);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }
      
      setModalVisible(false);
      setNewPR({ 
        exercise: '', 
        currentValue: '', 
        targetValue: '', 
        unit: getWeightUnit() 
      });
      fetchPRGoals();
      
      // Increment PRs count
      incrementStat('prs_this_month');
      
      // Create notification for new PR
      const currentValueDisplay = getWeightUnit() === 'lbs' ? 
        Math.round(kgToLbs(currentValueInKg)) : 
        Math.round(currentValueInKg);
      const targetValueDisplay = getWeightUnit() === 'lbs' ? 
        Math.round(kgToLbs(targetValueInKg)) : 
        Math.round(targetValueInKg);
      
      await createNotification({
        type: 'personal_record',
        title: 'New Personal Record Set! 🏆',
        message: `You set a new PR goal: ${newPR.exercise} - ${currentValueDisplay}${getWeightUnit()} → ${targetValueDisplay}${getWeightUnit()}`,
        data: { 
          exercise: newPR.exercise, 
          current_value: currentValueInKg, 
          target_value: targetValueInKg,
          unit: getWeightUnit()
        },
        priority: 3
      });
    } catch (error) {
      console.error('Error saving PR goal:', error);
    }
  };

  const calculateProgress = (current, target) => {
    return Math.round((current / target) * 100);
  };

  // Exercise progression algorithms based on research and strength training principles
  const exerciseProgressionRates = {
    'Bench Press': { weeklyRate: 0.015, maxWeeklyRate: 0.025, plateauRate: 0.005 },
    'Squat': { weeklyRate: 0.02, maxWeeklyRate: 0.03, plateauRate: 0.008 },
    'Deadlift': { weeklyRate: 0.025, maxWeeklyRate: 0.035, plateauRate: 0.01 },
    'Overhead Press': { weeklyRate: 0.012, maxWeeklyRate: 0.02, plateauRate: 0.004 },
    'Barbell Row': { weeklyRate: 0.018, maxWeeklyRate: 0.025, plateauRate: 0.006 },
    'Pull-up': { weeklyRate: 0.02, maxWeeklyRate: 0.03, plateauRate: 0.008 },
    'Push-up': { weeklyRate: 0.025, maxWeeklyRate: 0.035, plateauRate: 0.01 },
    'Dumbbell Press': { weeklyRate: 0.014, maxWeeklyRate: 0.022, plateauRate: 0.005 },
    'Lunges': { weeklyRate: 0.018, maxWeeklyRate: 0.026, plateauRate: 0.007 },
    'Romanian Deadlift': { weeklyRate: 0.02, maxWeeklyRate: 0.028, plateauRate: 0.008 },
    'Front Squat': { weeklyRate: 0.018, maxWeeklyRate: 0.026, plateauRate: 0.007 },
    'Incline Bench Press': { weeklyRate: 0.014, maxWeeklyRate: 0.022, plateauRate: 0.005 },
    'Decline Bench Press': { weeklyRate: 0.016, maxWeeklyRate: 0.024, plateauRate: 0.006 },
    'Lat Pulldown': { weeklyRate: 0.018, maxWeeklyRate: 0.026, plateauRate: 0.007 },
    'Face Pull': { weeklyRate: 0.025, maxWeeklyRate: 0.035, plateauRate: 0.012 },
    'Bicep Curl': { weeklyRate: 0.022, maxWeeklyRate: 0.03, plateauRate: 0.008 },
    'Tricep Extension': { weeklyRate: 0.02, maxWeeklyRate: 0.028, plateauRate: 0.008 },
    'Shoulder Press': { weeklyRate: 0.012, maxWeeklyRate: 0.02, plateauRate: 0.004 },
    'Lateral Raise': { weeklyRate: 0.025, maxWeeklyRate: 0.035, plateauRate: 0.012 },
    'Leg Press': { weeklyRate: 0.025, maxWeeklyRate: 0.035, plateauRate: 0.01 },
    'Leg Extension': { weeklyRate: 0.028, maxWeeklyRate: 0.038, plateauRate: 0.012 },
    'Leg Curl': { weeklyRate: 0.026, maxWeeklyRate: 0.036, plateauRate: 0.011 },
    'Calf Raise': { weeklyRate: 0.03, maxWeeklyRate: 0.04, plateauRate: 0.015 },
    'Hip Thrust': { weeklyRate: 0.022, maxWeeklyRate: 0.03, plateauRate: 0.008 },
    'Good Morning': { weeklyRate: 0.018, maxWeeklyRate: 0.026, plateauRate: 0.007 },
    'Power Clean': { weeklyRate: 0.016, maxWeeklyRate: 0.024, plateauRate: 0.006 },
    'Snatch': { weeklyRate: 0.014, maxWeeklyRate: 0.022, plateauRate: 0.005 },
    'Clean and Jerk': { weeklyRate: 0.013, maxWeeklyRate: 0.021, plateauRate: 0.005 },
    'Kettlebell Swing': { weeklyRate: 0.025, maxWeeklyRate: 0.035, plateauRate: 0.012 },
    'Farmer\'s Walk': { weeklyRate: 0.02, maxWeeklyRate: 0.028, plateauRate: 0.008 },
    // Default rates for unknown exercises
    'default': { weeklyRate: 0.018, maxWeeklyRate: 0.026, plateauRate: 0.007 }
  };

  const calculateETA = (current, target, exerciseName) => {
    if (!current || !target) return '~1 month';
    if (current >= target) return 'Target reached!';
    
    const exercise = exerciseProgressionRates[exerciseName] || exerciseProgressionRates['default'];
    const difference = target - current;
    const percentDifference = (difference / current) * 100;
    
    // Adjust progression rate based on experience level and gap size
    let weeklyRate = exercise.weeklyRate;
    
    // Novice lifters (< 6 months) progress faster
    if (percentDifference <= 10) {
      weeklyRate = exercise.maxWeeklyRate;
    } else if (percentDifference <= 25) {
      weeklyRate = exercise.weeklyRate;
    } else {
      // Advanced lifters progress slower
      weeklyRate = exercise.plateauRate;
    }
    
    // Calculate weeks needed using compound growth formula
    const weeksNeeded = Math.ceil(Math.log(target / current) / Math.log(1 + weeklyRate));
    
    // Convert to months and provide realistic timeframe
    const monthsNeeded = Math.ceil(weeksNeeded / 4.33); // 4.33 weeks per month
    
    if (monthsNeeded <= 1) return '~1 month';
    if (monthsNeeded <= 12) return `~${monthsNeeded} months`;
    return '1+ year';
  };

  const generateProgressionData = (current, target, exerciseName) => {
    if (!current || !target || current >= target) return null;
    
    const exercise = exerciseProgressionRates[exerciseName] || exerciseProgressionRates['default'];
    const percentDifference = ((target - current) / current) * 100;
    
    // Determine progression rate based on experience level
    let weeklyRate = exercise.weeklyRate;
    if (percentDifference <= 10) {
      weeklyRate = exercise.maxWeeklyRate;
    } else if (percentDifference > 25) {
      weeklyRate = exercise.plateauRate;
    }
    
    // Generate realistic progression curve
    const dataPoints = [];
    const labels = [];
    let projectedValue = current;
    let week = 0;
    
    // Add current value
    dataPoints.push(Math.round(current));
    labels.push('Now');
    
    // Project weekly progress for up to 52 weeks (1 year)
    while (projectedValue < target && week < 52) {
      week++;
      projectedValue = projectedValue * (1 + weeklyRate);
      
      // Add checkpoints
      if (week === 4 || week === 8 || week === 12 || week === 24 || week === 52) {
        dataPoints.push(Math.round(Math.min(projectedValue, target)));
        labels.push(`+${week}w`);
      }
    }
    
    // Add target value
    dataPoints.push(Math.round(target));
    labels.push('Target');
    
    return {
      labels,
      datasets: [{
        data: dataPoints,
        color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
        strokeWidth: 3,
        fillShadowGradient: true,
        fillShadowGradientOpacity: 0.1
      }],
      legend: ['Projected Progress']
    };
  };

  const deletePR = async (prId) => {
    try {
      const { error } = await supabase
        .from('personal_records')
        .delete()
        .eq('id', prId);

      if (error) throw error;
      fetchPRGoals();
    } catch (error) {
      console.error('Error deleting PR:', error);
    }
  };

  const handleDeletePress = (pr) => {
    Alert.alert(
      'Delete PR Goal',
      `Are you sure you want to delete your ${pr.exercise} PR goal?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => deletePR(pr.id)
        }
      ]
    );
  };

  const startEditing = (pr) => {
    setEditingPR(pr);
    setIsEditMode(true);
    // Convert the values to the current unit and round to whole numbers
    const currentValue = getWeightUnit() === 'lbs' ? kgToLbs(pr.current_value) : pr.current_value;
    const targetValue = getWeightUnit() === 'lbs' ? kgToLbs(pr.target_value) : pr.target_value;
    setNewPR({
      exercise: pr.exercise,
      currentValue: Math.round(currentValue).toString(),
      targetValue: Math.round(targetValue).toString(),
      unit: getWeightUnit()
    });
    setModalVisible(true);
  };

  const updatePR = async () => {
    if (!userId || !editingPR) return;

    try {
      let currentValueInKg = parseFloat(newPR.currentValue);
      let targetValueInKg = parseFloat(newPR.targetValue);

      if (getWeightUnit() === 'lbs') {
        currentValueInKg = lbsToKg(currentValueInKg);
        targetValueInKg = lbsToKg(targetValueInKg);
      }

      const { error } = await supabase
        .from('personal_records')
        .update({
          exercise: newPR.exercise,
          weight_current: currentValueInKg,
          weight_target: targetValueInKg,
          weight_unit: 'kg',
          updated_at: new Date().toISOString()
        })
        .eq('id', editingPR.id);

      if (error) throw error;
      
      setModalVisible(false);
      setNewPR({ 
        exercise: '', 
        currentValue: '', 
        targetValue: '', 
        unit: getWeightUnit() 
      });
      setIsEditMode(false);
      setEditingPR(null);
      fetchPRGoals();
      
      // Create notification for updated PR
      const currentValueDisplay = getWeightUnit() === 'lbs' ? 
        Math.round(kgToLbs(currentValueInKg)) : 
        Math.round(currentValueInKg);
      const targetValueDisplay = getWeightUnit() === 'lbs' ? 
        Math.round(kgToLbs(targetValueInKg)) : 
        Math.round(targetValueInKg);
      
      await createNotification({
        type: 'personal_record',
        title: 'Personal Record Updated! 💪',
        message: `Updated PR: ${newPR.exercise} - ${currentValueDisplay}${getWeightUnit()} → ${targetValueDisplay}${getWeightUnit()}`,
        data: { 
          exercise: newPR.exercise, 
          current_value: currentValueInKg, 
          target_value: targetValueInKg,
          unit: getWeightUnit(),
          is_update: true
        },
        priority: 2
      });
    } catch (error) {
      console.error('Error updating PR:', error);
    }
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setIsEditMode(false);
    setEditingPR(null);
    setNewPR({
      exercise: '',
      currentValue: '',
      targetValue: '',
      unit: getWeightUnit()
    });
  };

  const getChartData = (current, target) => {
    if (!current || !target) return null;

    // Calculate realistic progression based on strength training principles
    const calculateNextWeight = (currentWeight, targetWeight, progress) => {
      const remainingProgress = targetWeight - currentWeight;
      const progressFactor = Math.log10(progress + 1) / Math.log10(10);
      return currentWeight + (remainingProgress * progressFactor);
    };

    // Generate data points
    const labels = ['Start', 'Now', '+1m', '+2m', 'Target'];
    const data = [];

    // Start value (85% of current)
    data.push(Math.round(current * 0.85 * 10) / 10);
    
    // Current value
    data.push(current);
    
    // Future projections
    let projectedValue = current;
    for (let i = 1; i <= 2; i++) {
      projectedValue = calculateNextWeight(current, target, i / 2);
      data.push(Math.min(target, Math.round(projectedValue * 10) / 10));
    }
    
    // Target value
    data.push(target);

    return {
      labels,
      datasets: [{
        data,
        color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
        strokeWidth: 3
      }],
      legend: ['Progress']
    };
  };

  const handleViewProgress = (pr) => {
    if (!pr) {
      console.error('No PR data provided to handleViewProgress');
      return;
    }
    
    setSelectedPR({
      ...pr,
      current_value: pr.current_value,
      target_value: pr.target_value,
      unit: getWeightUnit()
    });
    setProgressModalVisible(true);
  };

  const renderProgressModal = () => {
    if (!selectedPR) return null;

    const progress = calculateProgress(selectedPR.current_value, selectedPR.target_value);

    return (
      <Modal
        visible={progressModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setProgressModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.progressModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Progress Details</Text>
              <TouchableOpacity onPress={() => setProgressModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.progressContent}>
                <Text style={styles.exerciseTitle}>{selectedPR.exercise}</Text>

                {/* Progression Chart - Moved to top */}
                {progress < 100 && (
                  <View style={styles.chartSection}>
                    <View style={styles.chartHeader}>
                      <Text style={styles.sectionTitle}>Projected Timeline</Text>
                      <View style={styles.completionBadge}>
                        <Text style={styles.completionText}>
                          {calculateETA(selectedPR.current_value, selectedPR.target_value, selectedPR.exercise)}
                        </Text>
                      </View>
                    </View>
                    {(() => {
                      const chartData = generateProgressionData(selectedPR.current_value, selectedPR.target_value, selectedPR.exercise);
                      return chartData ? (
                        <View style={styles.chartContainer}>
                          <View style={styles.chartBackground}>
                            <LineChart
                              data={chartData}
                              width={chartWidth - 68}
                              height={200}
                              chartConfig={{
                                backgroundColor: '#000',
                                backgroundGradientFrom: '#000',
                                backgroundGradientTo: '#000',
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(0, 255, 255, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                fillShadowGradient: true,
                                fillShadowGradientOpacity: 0.2,
                                strokeWidth: 4,
                                propsForDots: {
                                  r: '6',
                                  strokeWidth: '4',
                                  stroke: '#00ffff',
                                  fill: '#000',
                                },
                                propsForBackgroundLines: {
                                  strokeDasharray: '',
                                  strokeColor: 'rgba(255, 255, 255, 0.15)',
                                  strokeWidth: 1,
                                },
                              }}
                              bezier
                              style={styles.chart}
                              withDots={true}
                              withShadow={false}
                              withInnerLines={true}
                              withOuterLines={false}
                              withVerticalLines={false}
                            />
                          </View>
                          <View style={styles.chartLegend}>
                            <View style={styles.legendItem}>
                              <View style={styles.legendDot} />
                              <Text style={styles.legendText}>Projected Progress</Text>
                            </View>
                            <View style={styles.legendItem}>
                              <View style={[styles.legendDot, { backgroundColor: '#00ff88' }]} />
                              <Text style={styles.legendText}>Target Goal</Text>
                            </View>
                          </View>
                        </View>
                      ) : null;
                    })()}
                  </View>
                )}
                
                <View style={styles.progressCircleContainer}>
                  <View style={styles.progressCircle}>
                    <LinearGradient
                      colors={['#00ffff', '#0088ff']}
                      style={styles.progressCircleGradient}
                    >
                      <Text style={styles.progressCircleText}>{progress}%</Text>
                    </LinearGradient>
                  </View>
                </View>

                <View style={styles.progressStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Current</Text>
                    <Text style={styles.statValue}>
                      {selectedPR.current_value} {selectedPR.unit}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Target</Text>
                    <Text style={styles.statValue}>
                      {selectedPR.target_value} {selectedPR.unit}
                    </Text>
                  </View>
                </View>

                <View style={styles.chartSection}>
                  <Text style={styles.sectionTitle}>Progress Overview</Text>
                  <View style={styles.progressBarContainer}>
                    <View style={styles.progressBarBackground}>
                      <LinearGradient
                        colors={['#00ffff', '#0088ff']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressBarFill, { width: `${progress}%` }]}
                      />
                    </View>
                  </View>
                  <View style={styles.progressLabels}>
                    <Text style={styles.progressLabel}>Start</Text>
                    <Text style={styles.progressLabel}>Target</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  const renderPRCard = (pr) => {
    const progress = calculateProgress(pr.current_value, pr.target_value);
    const isCompleted = progress >= 100;
    
    return (
      <View key={pr.id} style={styles.prCard}>
        <LinearGradient
          colors={isCompleted ? ['#00ff88', '#00cc66'] : ['#1a1a1a', '#0d0d0d']}
          style={styles.prCardGradient}
        >
          <View style={styles.prContent}>
            <View style={styles.prHeader}>
              <View style={styles.prTitleContainer}>
                <Ionicons 
                  name={isCompleted ? "trophy" : "fitness"} 
                  size={24} 
                  color={isCompleted ? "#fff" : "#00ffff"} 
                />
                <Text style={[styles.prExercise, isCompleted && styles.prExerciseCompleted]}>
                  {pr.exercise}
                </Text>
                {isCompleted && (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedBadgeText}>COMPLETED</Text>
                  </View>
                )}
              </View>
              <View style={styles.prActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => startEditing(pr)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="pencil" size={18} color="#00ffff" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDeletePress(pr)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={18} color="#ff4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.prStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Current</Text>
                <Text style={[styles.statValue, isCompleted && styles.statValueCompleted]}>
                  {pr.current_value} {getWeightUnit()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Target</Text>
                <Text style={[styles.statValue, isCompleted && styles.statValueCompleted]}>
                  {pr.target_value} {getWeightUnit()}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Progress</Text>
                <Text style={[styles.statValue, isCompleted && styles.statValueCompleted]}>
                  {formatPercentage(progress)}
                </Text>
              </View>
            </View>

            <View style={styles.progressBarContainer}>
              <LinearGradient
                colors={isCompleted ? ['#00ff88', '#00cc66'] : ['#00ffff', '#0088ff']}
                style={[
                  styles.progressFill,
                  { 
                    width: `${Math.min(progress, 100)}%`
                  }
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>

            <View style={styles.cardFooter}>
              <Text style={[styles.estimatedTime, isCompleted && styles.estimatedTimeCompleted]}>
                {isCompleted ? '🎉 Goal achieved!' : `Est. completion: ${calculateETA(pr.current_value, pr.target_value, pr.exercise)}`}
              </Text>
              <TouchableOpacity
                style={[styles.detailsButton, isCompleted && styles.detailsButtonCompleted]}
                onPress={() => handleViewProgress(pr)}
                activeOpacity={0.8}
              >
                <Text style={[styles.detailsButtonText, isCompleted && styles.detailsButtonTextCompleted]}>
                  Details
                </Text>
                <Ionicons 
                  name="chevron-forward" 
                  size={16} 
                  color={isCompleted ? "#fff" : "#00ffff"} 
                />
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderWeightPicker = (visible, onClose, value, onSelect, title) => (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.pickerModalContainer}>
        <View style={styles.pickerModalContent}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.pickerScroll}>
            {weightOptions.map((weight) => (
              <TouchableOpacity
                key={weight}
                style={[
                  styles.pickerOption,
                  value === weight && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  onSelect(weight);
                  onClose();
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  value === weight && styles.pickerOptionTextSelected
                ]}>
                  {weight} {getWeightUnit()}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Common exercises list
  const commonExercises = [
    'Bench Press',
    'Squat',
    'Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Pull-up',
    'Push-up',
    'Dumbbell Press',
    'Lunges',
    'Romanian Deadlift',
    'Front Squat',
    'Incline Bench Press',
    'Decline Bench Press',
    'Lat Pulldown',
    'Face Pull',
    'Bicep Curl',
    'Tricep Extension',
    'Shoulder Press',
    'Lateral Raise',
    'Leg Press',
    'Leg Extension',
    'Leg Curl',
    'Calf Raise',
    'Hip Thrust',
    'Good Morning',
    'Power Clean',
    'Snatch',
    'Clean and Jerk',
    'Kettlebell Swing',
    'Farmer\'s Walk'
  ];

  const filteredExercises = commonExercises.filter(exercise =>
    exercise.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderExercisePicker = () => (
    <Modal
      visible={showExercisePicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowExercisePicker(false)}
    >
      <View style={styles.pickerModalContainer}>
        <View style={styles.pickerModalContent}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Exercise</Text>
            <TouchableOpacity onPress={() => setShowExercisePicker(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView style={styles.pickerScroll}>
            {filteredExercises.map((exercise) => (
              <TouchableOpacity
                key={exercise}
                style={[
                  styles.pickerOption,
                  newPR.exercise === exercise && styles.pickerOptionSelected
                ]}
                onPress={() => {
                  setNewPR({ ...newPR, exercise });
                  setShowExercisePicker(false);
                  setSearchQuery('');
                }}
              >
                <Text style={[
                  styles.pickerOptionText,
                  newPR.exercise === exercise && styles.pickerOptionTextSelected
                ]}>
                  {exercise}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <LinearGradient
        colors={['#000', '#111', '#000']}
        style={styles.gradient}
      >
        <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <LinearGradient
              colors={['#0a0a0a', '#000000']}
              style={styles.headerGradient}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.title}>Personal Records</Text>
                  <Text style={styles.subtitle}>Track your strength goals</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => {
                    setIsEditMode(false);
                    setEditingPR(null);
                    setNewPR({
                      exercise: '',
                      currentValue: '',
                      targetValue: '',
                      unit: getWeightUnit()
                    });
                    setModalVisible(true);
                  }}
                  style={styles.addButton}
                  activeOpacity={0.8}
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

          <ScrollView 
            style={styles.content}
            contentContainerStyle={prGoals.length === 0 ? styles.emptyStateContainer : styles.prList}
            showsVerticalScrollIndicator={false}
          >
            {prGoals.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={['#00ffff', '#0088ff']}
                  style={styles.emptyStateIconContainer}
                >
                  <Ionicons name="trophy" size={48} color="#fff" />
                </LinearGradient>
                <Text style={styles.emptyStateTitle}>No Personal Records Yet</Text>
                <Text style={styles.emptyStateText}>
                  Start tracking your strength goals by adding your first personal record
                </Text>
                <TouchableOpacity
                  style={styles.emptyStateButton}
                  onPress={() => {
                    setIsEditMode(false);
                    setEditingPR(null);
                    setNewPR({
                      exercise: '',
                      currentValue: '',
                      targetValue: '',
                      unit: getWeightUnit()
                    });
                    setModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#00ffff', '#0088ff']}
                    style={styles.emptyStateButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.emptyStateButtonText}>Add Your First PR</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            ) : (
              prGoals.map(renderPRCard)
            )}
          </ScrollView>

          {renderProgressModal()}

          <Modal
            visible={modalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleModalClose}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalContainer}
            >
              <BlurView intensity={80} style={styles.modalBlur}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>
                      {isEditMode ? 'Edit PR Goal' : 'Add PR Goal'}
                    </Text>
                    <TouchableOpacity onPress={handleModalClose}>
                      <Ionicons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView 
                    style={styles.modalScroll}
                    contentContainerStyle={styles.modalScrollContent}
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>Exercise Name</Text>
                      <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowExercisePicker(true)}
                      >
                        <Text style={styles.pickerButtonText}>
                          {newPR.exercise || 'Select Exercise'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#00ffff" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>Current Value ({getWeightUnit()})</Text>
                      <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowCurrentPicker(true)}
                      >
                        <Text style={styles.pickerButtonText}>
                          {newPR.currentValue} {getWeightUnit()}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#00ffff" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.formGroup}>
                      <Text style={styles.inputLabel}>Target Value ({getWeightUnit()})</Text>
                      <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => setShowTargetPicker(true)}
                      >
                        <Text style={styles.pickerButtonText}>
                          {newPR.targetValue} {getWeightUnit()}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#00ffff" />
                      </TouchableOpacity>
                    </View>

                    {renderWeightPicker(
                      showCurrentPicker,
                      () => setShowCurrentPicker(false),
                      newPR.currentValue,
                      (value) => setNewPR({ ...newPR, currentValue: value }),
                      'Select Current Weight'
                    )}

                    {renderWeightPicker(
                      showTargetPicker,
                      () => setShowTargetPicker(false),
                      newPR.targetValue,
                      (value) => setNewPR({ ...newPR, targetValue: value }),
                      'Select Target Weight'
                    )}

                    {renderExercisePicker()}

                    <TouchableOpacity
                      style={styles.saveButton}
                      onPress={isEditMode ? updatePR : savePRGoal}
                    >
                      <LinearGradient
                        colors={['#00ffff', '#0088ff']}
                        style={styles.saveButtonGradient}
                      >
                        <Text style={styles.saveButtonText}>
                          {isEditMode ? 'Update Goal' : 'Save Goal'}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </BlurView>
            </KeyboardAvoidingView>
          </Modal>
        </SafeAreaView>
      </LinearGradient>
    </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerGradient: {
    paddingBottom: 15,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    fontWeight: '400',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  addButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  prList: {
    padding: 15,
    gap: 15,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    justifyContent: 'center',
    flex: 1,
  },
  emptyStateIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyStateTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  emptyStateButton: {
    width: '100%',
    maxWidth: 250,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
  },
  emptyStateButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  prCard: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  prCardGradient: {
    padding: 1,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  prContent: {
    backgroundColor: '#111',
    borderRadius: 15,
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
    gap: 12,
  },
  prExercise: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  prExerciseCompleted: {
    color: '#fff',
  },
  completedBadge: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  completedBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
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
  prStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  statValueCompleted: {
    color: '#fff',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#222',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  estimatedTime: {
    color: '#666',
    fontSize: 14,
    flex: 1,
  },
  estimatedTimeCompleted: {
    color: '#00ff88',
    fontWeight: 'bold',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  detailsButtonCompleted: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  detailsButtonText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  detailsButtonTextCompleted: {
    color: '#00ff88',
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
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalScroll: {
    width: '100%',
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  saveButton: {
    width: '100%',
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 20,
  },
  saveButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  progressModalContent: {
    backgroundColor: '#111',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  progressContent: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  exerciseTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 20,
    textAlign: 'center',
  },
  progressCircleContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  progressCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    backgroundColor: '#222',
  },
  progressCircleGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressCircleText: {
    color: '#000',
    fontSize: 24,
    fontWeight: 'bold',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  chartSection: {
    marginTop: 20,
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  progressBarBackground: {
    width: '100%',
    height: 20,
    backgroundColor: '#222',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 10,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  progressLabel: {
    color: '#666',
    fontSize: 14,
  },
  chartSubtitle: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  chartContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  completionBadge: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#00ffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  completionText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  chartBackground: {
    backgroundColor: '#000',
    borderRadius: 20,
    padding: 30,
    borderWidth: 2,
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
    gap: 30,
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  legendText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  pickerButton: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  pickerButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  pickerScroll: {
    maxHeight: 300,
  },
  pickerOption: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  pickerOptionText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerOptionTextSelected: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 12,
    marginBottom: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#333',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: 45,
    color: '#fff',
    fontSize: 16,
  },
});

export default PRScreen; 