// Quick test to verify workout sharing database tables exist
import { supabase } from './lib/supabase';

export const testWorkoutSharingTables = async () => {
  console.log('Testing workout sharing tables...');
  
  try {
    // Test workout_shares table
    const { data: shares, error: sharesError } = await supabase
      .from('workout_shares')
      .select('*')
      .limit(1);
    
    if (sharesError) {
      console.error('workout_shares table error:', sharesError);
    } else {
      console.log('✅ workout_shares table exists');
    }
    
    // Test shared_workouts table
    const { data: workouts, error: workoutsError } = await supabase
      .from('shared_workouts')
      .select('*')
      .limit(1);
    
    if (workoutsError) {
      console.error('shared_workouts table error:', workoutsError);
    } else {
      console.log('✅ shared_workouts table exists');
    }
    
    // Test notifications table with workout_share type
    const { data: notifications, error: notificationsError } = await supabase
      .from('notifications')
      .select('*')
      .eq('type', 'workout_share')
      .limit(1);
    
    if (notificationsError) {
      console.error('notifications table workout_share type error:', notificationsError);
    } else {
      console.log('✅ notifications table supports workout_share type');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
};
