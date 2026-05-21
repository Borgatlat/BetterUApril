import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  getMondayWeekStart,
  getWeekDaysArray,
  getLocalDateString,
} from '../utils/scheduledWorkoutHelpers';
import { loadFutureuPlanArtifact, getFutureuChecklistByLocalDate } from '../utils/futureuPlanStorage';

/**
 * Shared week schedule data for Home + Workout tabs (Monday–Sunday).
 */
export function useWeeklySchedule(userId, options = {}) {
  const { refreshKey = 0, loadFuturePlan = true } = options;
  const [weekStart, setWeekStart] = useState(() => getMondayWeekStart());
  const [scheduledByDate, setScheduledByDate] = useState({});
  const [futureChecklistByDate, setFutureChecklistByDate] = useState({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setScheduledByDate({});
      setFutureChecklistByDate({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const days = getWeekDaysArray(weekStart);
      const startStr = getLocalDateString(days[0]);
      const endStr = getLocalDateString(days[6]);

      const { data, error } = await supabase
        .from('scheduled_workouts')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', startStr)
        .lte('scheduled_date', endStr)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      const byDate = {};
      (data || []).forEach((row) => {
        if (!byDate[row.scheduled_date]) byDate[row.scheduled_date] = [];
        byDate[row.scheduled_date].push(row);
      });
      setScheduledByDate(byDate);

      if (loadFuturePlan) {
        const plan = await loadFutureuPlanArtifact();
        setFutureChecklistByDate(getFutureuChecklistByLocalDate(plan));
      }
    } catch (err) {
      console.error('[useWeeklySchedule] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, loadFuturePlan]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);

  const goPrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  const goToThisWeek = useCallback(() => {
    setWeekStart(getMondayWeekStart());
  }, []);

  const days = getWeekDaysArray(weekStart);

  return {
    weekStart,
    setWeekStart,
    days,
    scheduledByDate,
    futureChecklistByDate,
    setFutureChecklistByDate,
    loading,
    refresh,
    goPrevWeek,
    goNextWeek,
    goToThisWeek,
  };
}
