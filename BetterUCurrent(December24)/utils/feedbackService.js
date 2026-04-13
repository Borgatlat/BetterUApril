/**
 * feedbackService.js - Submits user feedback to Supabase
 *
 * USAGE:
 * import { submitFeedback } from '../utils/feedbackService';
 *
 * submitFeedback({
 *   type: 'ai-response',
 *   contextId: messageId,
 *   rating: 'positive',
 *   reason: undefined,
 *   comment: undefined,
 *   timestamp: new Date().toISOString(),
 * });
 */

import { supabase } from '../lib/supabase';

/**
 * Submits feedback to Supabase feedback table.
 * @param {Object} payload - Feedback data from FeedbackCard
 * @param {string} payload.type - 'ai-workout' | 'ai-response' | 'workout-quality' | 'general'
 * @param {string|null} payload.contextId - Optional ID (workout ID, message ID, etc.)
 * @param {string} payload.rating - 'positive' | 'negative'
 * @param {string[]|undefined} payload.reason - Optional array of reason IDs
 * @param {string|undefined} payload.comment - Optional free-text comment
 * @param {string} payload.timestamp - ISO timestamp (client-side)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function submitFeedback(payload) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Map UI-only types to DB-allowed types (feedback table CHECK constraint)
    const dbType = ['mental-heath', 'mental-health'].includes(payload.type)
      ? 'general'
      : payload.type;

    const { error } = await supabase.from('feedback').insert({
      user_id: user.id,
      type: dbType,
      context_id: payload.contextId || null,
      rating: payload.rating,
      reason: payload.reason && payload.reason.length > 0 ? payload.reason : null,
      comment: payload.comment || null,
    });

    if (error) {
      console.error('[feedbackService] Insert error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[feedbackService] Unexpected error:', err);
    return { success: false, error: err.message };
  }
}
