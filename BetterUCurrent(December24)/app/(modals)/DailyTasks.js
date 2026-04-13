"use client";

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTracking } from '../../context/TrackingContext';
import { useUser } from '../../context/UserContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
// Define the default daily tasks
const DEFAULT_TASKS = [
  { id: 'workout', label: 'Complete a workout', icon: 'fitness', completed: false },
  { id: 'mental', label: 'Do a mental session', icon: 'heart', completed: false },
  { id: 'friend', label: 'Talk to a friend', icon: 'people', completed: false },
  { id: 'forgive', label: 'Forgive someone', icon: 'hand-left', completed: false },
  { id: 'gratitude', label: 'Practice gratitude', icon: 'sunny', completed: false },
  { id: 'water', label: 'Drink enough water', icon: 'water', completed: false },
];

// Storage key for persisting daily tasks
const STORAGE_KEY = 'daily_tasks';
const CUSTOM_TASK_KEY = 'daily_custom_tasks';

// Neuros earned per task completed (once per task per day)
const NEUROS_PER_TASK = 5;

const DailyTasks = ({ visible, onClose }) => {
  const router = useRouter();
  const { stats } = useTracking();
  const { userProfile, updateProfile } = useUser();
  const insets = useSafeAreaInsets();

  // State to track which tasks are completed
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [lastResetDate, setLastResetDate] = useState(null);
  // State for "Add task" modal / inline form
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState('');

  // Load tasks from storage when component mounts or becomes visible
  useEffect(() => {
    if (visible) {
      loadTasks();
    }
  }, [visible]);

  // Sync with tracking context for workout and mental session
  useEffect(() => {
    if (stats) {
      setTasks(prevTasks => 
        prevTasks.map(task => {
          // Auto-complete workout if it's completed in tracking
          if (task.id === 'workout' && stats.today_workout_completed) {
            return { ...task, completed: true };
          }
          // Auto-complete mental session if it's completed in tracking
          if (task.id === 'mental' && stats.today_mental_completed) {
            return { ...task, completed: true };
          }
          return task;
        })
      );
    }
  }, [stats]);

  // Track which task IDs have already awarded neuros today (avoid double reward)
  const [awardedTaskIds, setAwardedTaskIds] = useState([]);

  // Function to load tasks from AsyncStorage
  const loadTasks = async () => {
    try {
      const today = new Date().toDateString();
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (stored) {
        const data = JSON.parse(stored);
        
        // Check if we need to reset (new day)
        if (data.date !== today) {
          // Reset all tasks for the new day
          resetTasksForNewDay();
        } else {
          // Load saved tasks for today; awardedTaskIds may be missing in old data
          setTasks(data.tasks);
          setLastResetDate(data.date);
          setAwardedTaskIds(Array.isArray(data.awardedTaskIds) ? data.awardedTaskIds : []);
        }
      } else {
        // First time - initialize with today's date
        resetTasksForNewDay();
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
      // On error, use default tasks
      resetTasksForNewDay();
    }
  };

  // Function to reset tasks for a new day (clears neuros-awarded list so tasks can earn again)
  const resetTasksForNewDay = async () => {
    const today = new Date().toDateString();
    const baseTasks = DEFAULT_TASKS.map(task => ({
      ...task,
      completed: (task.id === 'workout' && stats?.today_workout_completed) ||
                 (task.id === 'mental' && stats?.today_mental_completed) ||
                 false
    }));
    const rawTemplates = await AsyncStorage.getItem(CUSTOM_TASK_KEY);
    const customTemplates = rawTemplates ? JSON.parse(rawTemplates) : [];
    const customTasks = customTemplates.map(template => ({
      ...template,
      completed: false,
      custom: true,
    }));
    const resetTasks = [...baseTasks, ...customTasks];
    setTasks(resetTasks);
    setLastResetDate(today);
    setAwardedTaskIds([]);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({
        date: today,
        tasks: resetTasks,
        awardedTaskIds: []
      }));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  // Function to save tasks (and optionally awardedTaskIds) to AsyncStorage
  const saveTasks = async (updatedTasks, awardedIds = null) => {
    try {
      const today = new Date().toDateString();
      const payload = {
        date: today,
        tasks: updatedTasks,
        awardedTaskIds: awardedIds !== null ? awardedIds : awardedTaskIds
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.error('Error saving tasks:', error);
    }
  };

  // Function to toggle task completion; awards neuros when marking a task complete (once per task per day)
  const toggleTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    const isMarkingComplete = task && !task.completed;

    const updatedTasks = tasks.map(t =>
      t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);

    // Award neuros only when completing a task (not when unchecking), once per task per day
    if (isMarkingComplete && userProfile?.id && !awardedTaskIds.includes(taskId)) {
      const currentBalance = userProfile.neuros_balance ?? 0;
      const newBalance = currentBalance + NEUROS_PER_TASK;
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ neuros_balance: newBalance })
          .eq('id', userProfile.id);
        if (error) throw error;
        updateProfile({ neuros_balance: newBalance });
        const newAwarded = [...awardedTaskIds, taskId];
        setAwardedTaskIds(newAwarded);
        await saveTasks(updatedTasks, newAwarded);
        Alert.alert('Neuros earned!', `+${NEUROS_PER_TASK} Neuros for completing this task.`);
      } catch (err) {
        console.error('Error awarding neuros:', err);
        Alert.alert('Error', 'Could not award Neuros. Try again.');
      }
    }
  };

  // Navigate to Workout or Mental tab when user taps the arrow on those tasks
  const handleTaskNavigation = (taskId) => {
    onClose();
    if (taskId === 'workout') {
      router.push('/(tabs)/workout');
    } else if (taskId === 'mental') {
      router.push('/(tabs)/mental');
    }
  };

  // Add a new custom task from the "Add task" form
  const handleCreateTask = async () => {
    const label = newTaskLabel.trim();
    if (!label) return;
    const newTask = {
      id: 'custom_' + Date.now(),
      label,
      icon: 'add-outline',
      completed: false,
      custom: true,
    };
    const updatedTasks = [...tasks, newTask];
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    setNewTaskLabel('');
    setShowAddTaskModal(false);
    const rawTemplates = await AsyncStorage.getItem(CUSTOM_TASK_KEY);
    const templates = rawTemplates ? JSON.parse(rawTemplates) : [];
    templates.push({label, icon: newTask.icon, id: newTask.id});
    await AsyncStorage.setItem(CUSTOM_TASK_KEY, JSON.stringify(templates));

  };

  // Remove a custom task (only custom tasks can be deleted)
  const handleDeleteTask = async (taskId) => {
    const updatedTasks = tasks.filter(t => t.id !== taskId);
    setTasks(updatedTasks);
    await saveTasks(updatedTasks);
    const rawTemplates = await AsyncStorage.getItem(CUSTOM_TASK_KEY);
    const templates = rawTemplates ? JSON.parse(rawTemplates) : [];
    const updatedTemplates = templates.filter(t => t.id !== taskId);
    await AsyncStorage.setItem(CUSTOM_TASK_KEY, JSON.stringify(updatedTemplates));
    console.log('Custom task deleted:', taskId);
  };

  // Calculate completion percentage
  const completedCount = tasks.filter(task => task.completed).length;
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, { paddingTop: insets.top }]}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="checkmark-circle" size={28} color="#00ffff" />
              <Text style={styles.headerTitle}>Daily Tasks</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <Text style={styles.progressText}>
              {completedCount} of {totalTasks} completed
            </Text>
            <View style={styles.neurosRow}>
              <Text style={styles.neurosEarnText}>Earn {NEUROS_PER_TASK} Neuros per task</Text>
              {userProfile?.id != null && (
                <Text style={styles.neurosBalanceText}>
                  Balance: {userProfile?.neuros_balance ?? 0} Neuros
                </Text>
              )}
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${completionPercentage}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressPercentage}>{completionPercentage}%</Text>
          </View>

          {/* Tasks List */}
          <ScrollView
            style={styles.tasksList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.tasksListContent}
          >
            {tasks.map((task) => (
              <View
                key={task.id}
                style={[
                  styles.taskItem,
                  task.completed && styles.taskItemCompleted
                ]}
              >
                <TouchableOpacity
                  style={styles.taskLeft}
                  onPress={() => toggleTask(task.id)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.checkbox,
                    task.completed && styles.checkboxCompleted
                  ]}>
                    {task.completed && (
                      <Ionicons name="checkmark" size={20} color="#000" />
                    )}
                  </View>
                  <Ionicons
                    name={task.icon}
                    size={24}
                    color={task.completed ? '#00ffff' : '#666'}
                    style={styles.taskIcon}
                  />
                  <Text
                    style={[
                      styles.taskLabel,
                      task.completed && styles.taskLabelCompleted
                    ]}
                    numberOfLines={1}
                  >
                    {task.label}
                  </Text>
                </TouchableOpacity>
                <View style={styles.taskRight}>
                  {task.completed ? (
                    <Ionicons name="checkmark-circle" size={24} color="#00ffff" />
                  ) : (task.id === 'workout' || task.id === 'mental') ? (
                    <TouchableOpacity
                      onPress={() => handleTaskNavigation(task.id)}
                      style={styles.taskNavButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="arrow-forward" size={20} color="#00ffff" />
                    </TouchableOpacity>
                  ) : task.custom ? (
                    <TouchableOpacity
                      onPress={() => handleDeleteTask(task.id)}
                      style={styles.taskDeleteButton}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ff4444" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}

            {/* Add task button */}
            <TouchableOpacity
              style={styles.addTaskButton}
              onPress={() => setShowAddTaskModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={24} color="#00ffff" />
              <Text style={styles.addTaskButtonText}>Add task</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Add task modal / inline form */}
          <Modal
            visible={showAddTaskModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowAddTaskModal(false)}
          >
            <TouchableOpacity
              style={styles.addTaskOverlay}
              activeOpacity={1}
              onPress={() => setShowAddTaskModal(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.addTaskModalContent}
              >
                <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
                  <Text style={styles.addTaskTitle}>New task</Text>
                  <TextInput
                    style={styles.addTaskInput}
                    placeholder="e.g. Take vitamins, Read 10 min"
                    placeholderTextColor="#666"
                    value={newTaskLabel}
                    onChangeText={setNewTaskLabel}
                    autoFocus
                  />
                  <View style={styles.addTaskActions}>
                    <TouchableOpacity
                      style={styles.addTaskCancelButton}
                      onPress={() => {
                        setNewTaskLabel('');
                        setShowAddTaskModal(false);
                      }}
                    >
                      <Text style={styles.addTaskCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.addTaskSubmitButton, !newTaskLabel.trim() && styles.addTaskSubmitDisabled]}
                      onPress={handleCreateTask}
                      disabled={!newTaskLabel.trim()}
                    >
                      <Text style={styles.addTaskSubmitText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </TouchableOpacity>
          </Modal>

          {/* Motivational Message / Compassionate check-in */}
          {completionPercentage === 100 ? (
            <View style={styles.completionMessage}>
              <Ionicons name="trophy" size={32} color="#FFD700" />
              <Text style={styles.completionText}>Amazing! You've completed all your daily tasks! 🎉</Text>
            </View>
          ) : completionPercentage > 0 ? (
            <View style={styles.completionMessage}>
              <Ionicons name="heart" size={28} color="#00d4ff" />
              <Text style={styles.completionText}>You completed {completedCount} of {totalTasks} — every task counts. Tomorrow's a new day.</Text>
            </View>
          ) : (
            <View style={styles.completionMessage}>
              <Ionicons name="leaf" size={28} color="#00d4ff" />
              <Text style={styles.completionText}>Tomorrow's a fresh start. Even one task counts.</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingTop: 20,
    paddingBottom: 30,
    height: '85%',
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  progressText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  neurosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  neurosEarnText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  neurosBalanceText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ffff',
    borderRadius: 4,
  },
  progressPercentage: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  tasksList: {
    flex: 1,
    minHeight: 0,
    marginTop: 20,
  },
  tasksListContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  taskItemCompleted: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  taskLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  taskRight: {
    marginLeft: 8,
    justifyContent: 'center',
  },
  taskNavButton: {
    padding: 8,
  },
  taskDeleteButton: {
    padding: 8,
  },
  addTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 255, 255, 0.4)',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  addTaskButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  addTaskOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  addTaskModalContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  addTaskTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  addTaskInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  addTaskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  addTaskCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addTaskCancelText: {
    color: '#888',
    fontSize: 16,
  },
  addTaskSubmitButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#00ffff',
    borderRadius: 10,
  },
  addTaskSubmitDisabled: {
    opacity: 0.5,
  },
  addTaskSubmitText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#666',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxCompleted: {
    backgroundColor: '#00ffff',
    borderColor: '#00ffff',
  },
  taskIcon: {
    marginRight: 4,
  },
  taskLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
    flex: 1,
  },
  taskLabelCompleted: {
    color: '#00ffff',
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  completionMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    gap: 12,
  },
  completionText: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
});

export default DailyTasks;

