import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  const loadProfile = async (userId) => {
    try {
      console.log('=== Profile Loading Debug ===');
      console.log('Attempting to load profile for user ID:', userId);
      
      // First try to get the profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Profile loading error:', profileError);
        console.log('Error code:', profileError.code);
        
        // If profile doesn't exist, create it
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          const newProfileData = {
            id: userId,
            username: user?.email?.split('@')[0] || 'User',
            full_name: user?.email?.split('@')[0] || 'User',
            updated_at: new Date().toISOString(),
          };
          console.log('Attempting to create profile with data:', newProfileData);
          
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([newProfileData])
            .select()
            .single();

          if (createError) {
            console.error('Error creating profile:', createError);
            return null;
          }

          console.log('New profile created successfully:', newProfile);
          return newProfile;
        }
        return null;
      }

      console.log('Profile loaded successfully:', profileData);
      console.log('Profile fields:', {
        id: profileData.id,
        username: profileData.username,
        full_name: profileData.full_name,
        updated_at: profileData.updated_at
      });
      return profileData;
    } catch (error) {
      console.error('Unexpected error in loadProfile:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log('=== Auth State Change Debug ===');
    // Check active sessions and sets the user
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('Initial session check:', session ? 'Session found' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('User found in session, loading profile...');
        const profileData = await loadProfile(session.user.id);
        console.log('Profile load result:', profileData ? 'Success' : 'Failed');
        setProfile(profileData);
      }
      
      setLoading(false);
    });

    // Listen for changes on auth state
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('Auth state changed:', _event);
      console.log('Session:', session ? 'Present' : 'None');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        console.log('User found in auth change, loading profile...');
        const profileData = await loadProfile(session.user.id);
        console.log('Profile load result:', profileData ? 'Success' : 'Failed');
        setProfile(profileData);
      } else {
        console.log('No user in session, clearing profile');
        setProfile(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, profile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 