import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * FeedbackCard - A reusable component for collecting user feedback on AI features and workouts.
 *
 * USAGE:
 * <FeedbackCard
 *   type="ai-workout"           // 'ai-workout' | 'ai-response' | 'workout-quality' | 'general'
 *   contextId="workout_123"     // optional: ID for analytics (workout/message ID)
 *   onSubmit={(data) => {...}}  // callback with { rating, reason?, comment?, type, contextId }
 *   compact={false}             // optional: smaller inline version
 * />
 *
 * PROPS:
 * - type: Determines the prompt text and follow-up options shown.
 * - contextId: Pass a workout ID, message ID, etc. so you can correlate feedback with specific content.
 * - onSubmit: Called when user submits. You can send this to Supabase, analytics, etc.
 * - compact: If true, uses a more minimal layout (e.g. just thumbs, no card padding).
 */

const FEEDBACK_CONFIG = {
  'ai-workout': {
    prompt: 'How was this AI workout?',
    positiveLabel: 'Good',
    negativeLabel: 'Could improve',
    negativeFollowUp: 'What would help?',
    reasons: [
      { id: 'too_easy', label: 'Too easy' },
      { id: 'too_hard', label: 'Too hard' },
      { id: 'wrong_exercises', label: 'Wrong exercises for my goals' },
      { id: 'bad_timing', label: 'Bad timing / rest' },
      { id: 'unfamiliar', label: 'Exercises were unfamiliar' },
      { id: 'other', label: 'Other' },
    ],
  },
  'ai-response': {
    prompt: 'Was this AI response helpful?',
    positiveLabel: 'Yes',
    negativeLabel: 'No',
    negativeFollowUp: 'What could be better?',
    reasons: [
      { id: 'too_generic', label: 'Too generic' },
      { id: 'wrong_info', label: 'Wrong or unhelpful info' },
      { id: 'not_relevant', label: 'Not relevant to my question' },
      { id: 'too_long', label: 'Too long / too short' },
      { id: 'other', label: 'Other' },
    ],
  },
  'workout-quality': {
    prompt: 'How was this workout?',
    positiveLabel: 'Good',
    negativeLabel: 'Could improve',
    negativeFollowUp: 'What would help?',
    reasons: [
      { id: 'too_easy', label: 'Too easy' },
      { id: 'too_hard', label: 'Too hard' },
      { id: 'wrong_muscles', label: "Didn't target the right muscles" },
      { id: 'exercises_unfamiliar', label: 'Exercises were unfamiliar' },
      { id: 'other', label: 'Other' },
    ],
  },
  'mental-heath': {
    prompt: 'How was this mental health session?',
    positiveLabel: 'Good',
    negativeLabel: 'Could improve',
    negativeFollowUp: 'What would help?',
    reasons:[
     {id: 'not helpful', label: 'Not helpful' },
     {id: 'not relevant', label: 'Not relevant to my question' },
     {id: 'too long', label: 'Too long' },
     {id: 'too short', label: 'Too short' },
     {id: 'other', label: 'Other' },
    ],
  },
  general: {
    prompt: 'How was your experience?',
    positiveLabel: 'Good',
    negativeLabel: 'Could improve',
    negativeFollowUp: 'What could we improve?',
    reasons: [
      { id: 'features', label: 'Need more features' },
      { id: 'bugs', label: 'Something broke or glitched' },
      { id: 'confusing', label: 'Confusing to use' },
      { id: 'other', label: 'Other' },
    ],
  },
};

export default function FeedbackCard({
  type = 'general',
  contextId = null,
  onSubmit,
  compact = false,
  accentColor = '#00ffff',
}) {
  const [rating, setRating] = useState(null); // 'positive' | 'negative'
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [comment, setComment] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const config = FEEDBACK_CONFIG[type] || FEEDBACK_CONFIG.general;

  const toggleReason = (id) => {
    setSelectedReasons((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    const payload = {
      type,
      contextId,
      rating,
      reason: selectedReasons.length > 0 ? selectedReasons : undefined,
      comment: comment.trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    onSubmit?.(payload);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <View style={styles.thankYouRow}>
          <Ionicons name="checkmark-circle" size={20} color={accentColor} />
          <Text style={[styles.thankYouText, { color: accentColor }]}>
            Thanks for your feedback!
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}
    >
      <View style={[styles.container, compact && styles.containerCompact]}>
        <Text style={styles.prompt}>{config.prompt}</Text>

        {/* Thumbs up / down */}
        <View style={styles.thumbsRow}>
          <TouchableOpacity
            style={[
              styles.thumbButton,
              rating === 'positive' && { ...styles.thumbSelected, borderColor: accentColor },
            ]}
            onPress={() => setRating('positive')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-up"
              size={compact ? 22 : 26}
              color={rating === 'positive' ? accentColor : '#888'}
            />
            <Text
              style={[
                styles.thumbLabel,
                rating === 'positive' && { color: accentColor },
              ]}
            >
              {config.positiveLabel}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.thumbButton,
              rating === 'negative' && { ...styles.thumbSelected, borderColor: accentColor },
            ]}
            onPress={() => setRating('negative')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="thumbs-down"
              size={compact ? 22 : 26}
              color={rating === 'negative' ? accentColor : '#888'}
            />
            <Text
              style={[
                styles.thumbLabel,
                rating === 'negative' && { color: accentColor },
              ]}
            >
              {config.negativeLabel}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Follow-up when negative */}
        {rating === 'negative' && (
          <View style={styles.followUp}>
            <Text style={styles.followUpTitle}>{config.negativeFollowUp}</Text>
            <View style={styles.reasonsContainer}>
              {config.reasons.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[
                    styles.reasonChip,
                    selectedReasons.includes(r.id) && {
                      borderColor: accentColor,
                      backgroundColor: `${accentColor}20`,
                    },
                  ]}
                  onPress={() => toggleReason(r.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReasons.includes(r.id) && { color: accentColor },
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.commentInput, { borderColor: accentColor + '50' }]}
              placeholder="Additional notes (optional)"
              placeholderTextColor="#666"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={2}
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: accentColor }]}
              onPress={handleSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Submit feedback</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick submit when positive */}
        {rating === 'positive' && (
          <TouchableOpacity
            style={[styles.submitButton, styles.submitButtonSmall, { backgroundColor: accentColor }]}
            onPress={handleSubmit}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    width: '100%',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  containerCompact: {
    padding: 12,
  },
  prompt: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 12,
    fontWeight: '500',
  },
  thumbsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  thumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#333',
  },
  thumbSelected: {
    borderWidth: 1.5,
  },
  thumbLabel: {
    fontSize: 14,
    color: '#888',
  },
  followUp: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  followUpTitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 10,
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    alignContent: 'flex-start',
  },
  reasonChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  reasonLabel: {
    fontSize: 13,
    color: '#aaa',
  },
  commentInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  submitButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonSmall: {
    marginTop: 12,
    paddingVertical: 10,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  thankYouRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  thankYouText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
