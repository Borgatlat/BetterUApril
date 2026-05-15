import { supabase } from '../lib/supabase';

export const getProfileId = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }
    return user.id;
  } catch (error) {
    console.error('Error getting profile ID:', error);
    throw error;
  }
}; 