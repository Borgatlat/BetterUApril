/**
 * CompactWorkoutCard
 * ------------------
 * A small, dense card used in workout-list screens (Your Workouts,
 * More Workouts, Premium Workouts).
 *
 * Shows ONLY the vital info: title, short description, time, and
 * intensity. The exercise list, weights, reps, and muscle map are NOT
 * shown here — those appear on the dedicated detail screen that opens
 * when the user taps this card.
 *
 * Tapping the card calls `onPress(workout)`. If the card is locked
 * (e.g. premium content for a non-premium user), we show a lock icon
 * and dim the card, but still call onPress so the parent can decide to
 * route to a paywall or show a popup.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CompactWorkoutCard = ({
  workout,
  onPress,
  // Optional: when true, shows a small star toggle button on the right.
  isFavorite = false,
  onFavorite = null,
  // Optional: when true, dims the card and shows a lock icon (premium gating).
  locked = false,
  // Optional: extra status badge text (e.g. "5 exercises" for custom workouts).
  badgeText = null,
}) => {
  // .stopPropagation prevents the favorite-tap from also triggering the
  // outer card's onPress. Without it, tapping the star would BOTH toggle
  // the favorite AND open the detail screen.
  const handleFavoritePress = (e) => {
    e?.stopPropagation?.();
    onFavorite?.(workout);
  };

  return (
    <TouchableOpacity
      style={[styles.card, locked && styles.cardLocked]}
      onPress={() => onPress?.(workout)}
      activeOpacity={0.85}
    >
      <View style={styles.row}>
        <View style={styles.titleColumn}>
          <Text style={styles.title} numberOfLines={1}>
            {workout.workout_name || workout.name || 'Workout'}
          </Text>
          {workout.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {workout.description}
            </Text>
          ) : null}

          {/* Meta row: clock + time, flame + intensity */}
          <View style={styles.metaRow}>
            {workout.duration ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#999" />
                <Text style={styles.metaText}>{workout.duration}</Text>
              </View>
            ) : null}
            {workout.intensity ? (
              <View style={styles.metaItem}>
                <Ionicons name="flame-outline" size={14} color="#999" />
                <Text style={styles.metaText}>{workout.intensity}</Text>
              </View>
            ) : null}
            {badgeText ? (
              <View style={styles.metaItem}>
                <Ionicons name="list-outline" size={14} color="#999" />
                <Text style={styles.metaText}>{badgeText}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Right column: favorite star (optional), lock icon (when locked),
            and a chevron to hint that tapping opens a detail screen. */}
        <View style={styles.rightColumn}>
          {onFavorite ? (
            <TouchableOpacity
              onPress={handleFavoritePress}
              style={styles.favoriteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isFavorite ? 'star' : 'star-outline'}
                size={18}
                color="#00ffff"
              />
            </TouchableOpacity>
          ) : null}
          {locked ? (
            <Ionicons name="lock-closed" size={18} color="#ff4444" />
          ) : (
            <Ionicons name="chevron-forward" size={20} color="#666" />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLocked: {
    opacity: 0.55,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleColumn: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    color: '#999',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#999',
    fontSize: 12,
  },
  rightColumn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  favoriteButton: {
    padding: 4,
  },
});

export default CompactWorkoutCard;
