"use client"

import { createContext, useState, useContext, useEffect } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { supabase } from "../lib/supabase"

// Create user context with proper type
const UserContext = createContext({
  userProfile: null,
  isLoading: true,
  initializationError: null,
  updateProfile: () => {},
  personalRecords: [],
  fetchPersonalRecords: () => {},
  addPersonalRecord: () => {},
  isPremium: false,
  checkSubscriptionStatus: () => {},
});

export const UserProvider = ({ children, onReady }) => {
  const [userProfile, setUserProfile] = useState({
    name: "",
    age: "",
    weight: "",
    height: "",
    goal: "",
    trainingLevel: "intermediate",
    fitness_goal: "",
    gender: ""
  })

  const [isLoading, setIsLoading] = useState(true)
  const [initializationError, setInitializationError] = useState(null)
  const [personalRecords, setPersonalRecords] = useState([]);
  const [isPremium, setIsPremium] = useState(false);

  // Save profile changes to Supabase and local state
  const updateProfile = async (updates) => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { success: false, error: 'No user logged in' };
      }

      // Update Supabase
      const response = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      // Check for errors
      if (response.error) {
        console.error('[UserContext] Error updating profile:', response.error);
        return { success: false, error: response.error.message };
      }

      // If successful, update local state
      if (response.data) {
        const updatedProfile = { ...userProfile, ...updates };
        setUserProfile(updatedProfile);
        await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        return { success: true, data: response.data };
      }

      // If no data returned
      return { success: false, error: 'No data returned from update' };
    } catch (err) {
      console.error('[UserContext] Error in updateProfile:', err);
      return { success: false, error: err.message || 'An error occurred' };
    }
  };

  // Rest of the UserContext code...
  // (Keep all other functions and state management the same)

  const value = {
    userProfile,
    isLoading,
    initializationError,
    updateProfile,
    personalRecords,
    fetchPersonalRecords,
    addPersonalRecord,
    isPremium,
    checkSubscriptionStatus,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}

export default { UserProvider, useUser } 