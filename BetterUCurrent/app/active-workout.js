const finishWorkout = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        Alert.alert('Error', 'You must be logged in to save workouts');
        return;
      }

      // Calculate total weight lifted
      const totalWeight = exercises.reduce((sum, exercise) => {
        return sum + (exercise.weight * exercise.sets.reduce((setSum, set) => setSum + set.reps, 0));
      }, 0);

      // Calculate total time in seconds
      const totalTime = Math.floor((Date.now() - startTime) / 1000);

      // First check if stats exist
      const { data: existingStats, error: checkError } = await supabase
        .from('user_stats')
        .select('*')
        .eq('id', session.user.id)
        .single();

      let statsResult;
      if (checkError && checkError.code === 'PGRST116') {
        // Stats don't exist, create them
        statsResult = await supabase
          .from('user_stats')
          .insert({
            id: session.user.id,
            total_workouts: 1,
            total_weight_lifted: totalWeight,
            total_workout_time: totalTime,
            total_calories_burned: 0
          });
      } else {
        // Stats exist, update them with direct increments
        statsResult = await supabase
          .from('user_stats')
          .update({
            total_workouts: (existingStats.total_workouts || 0) + 1,
            total_weight_lifted: (existingStats.total_weight_lifted || 0) + totalWeight,
            total_workout_time: (existingStats.total_workout_time || 0) + totalTime
          })
          .eq('id', session.user.id);
      }

      if (statsResult.error) {
        console.error('Error updating stats:', statsResult.error);
        throw statsResult.error;
      }

      // Save workout to history
      const { error: historyError } = await supabase
        .from('workout_history')
        .insert({
          id: session.user.id,
          workout_type: route.params?.type || 'Custom Workout',
          exercises: exercises,
          total_weight: totalWeight,
          duration: totalTime,
          date: new Date().toISOString()
        });

      if (historyError) {
        console.error('Error saving workout history:', historyError);
        throw historyError;
      }

      Alert.alert(
        'Workout Complete!',
        'Great job! Your workout has been saved.',
        [
          {
            text: 'View Progress',
            onPress: () => router.push('/(tabs)/progress')
          },
          {
            text: 'Back to Home',
            onPress: () => router.push('/(tabs)/home')
          }
        ]
      );
    } catch (error) {
      console.error('Error finishing workout:', error);
      Alert.alert('Error', 'Failed to save workout. Please try again.');
    }
  }; 