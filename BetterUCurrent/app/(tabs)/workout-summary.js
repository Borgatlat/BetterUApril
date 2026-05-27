import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTracking } from '../../context/TrackingContext';
import { supabase } from '../../lib/supabase';

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { stats } = useTracking();
  const [spotifyTracks, setSpotifyTracks] = useState([]);
  const [loadingTracks, setLoadingTracks] = useState(false);

  /**
   * Decode the `newPRs` route param. We send it as a JSON string from
   * active-workout because Expo Router serializes everything to URL
   * strings — objects/arrays would otherwise get stringified poorly.
   *
   * useMemo:
   *   Caches the parsed array across re-renders so we don't JSON.parse
   *   on every keystroke / state change.
   * try/catch:
   *   Defensive — a malformed param won't crash the summary screen,
   *   it'll just show "no PRs" which is the safe fallback.
   */
  const newPRs = useMemo(() => {
    const raw = Array.isArray(params.newPRs) ? params.newPRs[0] : params.newPRs;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [params.newPRs]);

  // Once we know which session finished, load any Spotify tracks tied to it
  useEffect(() => {
    const sessionId = Array.isArray(params.workoutSessionId)
      ? params.workoutSessionId[0]
      : params.workoutSessionId;

    if (!sessionId) {
      setSpotifyTracks([]);
      return;
    }

    let isMounted = true;

    const fetchTracks = async () => {
      setLoadingTracks(true);
      try {
        const { data, error } = await supabase
          .from('workout_spotify_tracks')
          .select('id, track_name, artist_name, album_name, album_image_url, played_at')
          .eq('workout_session_id', sessionId)
          .order('played_at', { ascending: true });

        if (!isMounted) return;

        if (error) {
          console.error('Error loading Spotify tracks for workout:', error);
          setSpotifyTracks([]);
        } else {
          setSpotifyTracks(data ?? []);
        }
      } catch (error) {
        if (isMounted) {
          console.error('Unexpected error fetching Spotify tracks:', error);
          setSpotifyTracks([]);
        }
      } finally {
        if (isMounted) {
          setLoadingTracks(false);
        }
      }
    };

    fetchTracks();

    return () => {
      isMounted = false;
    };
  }, [params.workoutSessionId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workout Complete! 💪</Text>
      </View>

      <ScrollView contentContainerStyle={styles.summaryScroll}>
      <View style={styles.summaryCard}>
        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>{formatTime(params.duration || 0)}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="barbell-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Exercises</Text>
            <Text style={styles.statValue}>{params.exerciseCount || 0}</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Ionicons name="checkmark-circle-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Sets Completed</Text>
            <Text style={styles.statValue}>{params.completedSets || 0}</Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="fitness-outline" size={24} color="#00ffff" />
            <Text style={styles.statLabel}>Total Weight</Text>
            <Text style={styles.statValue}>{params.totalWeight || 0} lbs</Text>
          </View>
        </View>

        <View style={styles.messageContainer}>
          <Text style={styles.message}>Great work!</Text>
        </View>

        {/*
          New Personal Records section
          ----------------------------
          Renders one row per exercise where the user beat (or set
          for the first time) a PR during this workout. Hidden when
          newPRs is empty — keeps the summary uncluttered when a
          session was just maintenance work.

          .toFixed(1):
            Forces one decimal place. We could keep the raw lbs but
            "275.0 → 280.5 lbs" reads cleaner than "275 → 280.5 lbs".
        */}
        {newPRs.length > 0 && (
          <View style={styles.prSection}>
            <View style={styles.prHeader}>
              <Ionicons name="trophy" size={20} color="#ffd700" />
              <Text style={styles.prHeaderText}>
                New Personal Records ({newPRs.length})
              </Text>
            </View>
            {newPRs.map((pr, idx) => (
              <View key={`${pr.exerciseName}-${idx}`} style={styles.prRow}>
                <View style={styles.prRowLeft}>
                  <Text style={styles.prExerciseName} numberOfLines={1}>
                    {pr.exerciseName}
                  </Text>
                  <Text style={styles.prSubText}>
                    {pr.isFirstTime
                      ? 'First time tracked'
                      : `Was ${(pr.previousLbs || 0).toFixed(1)} lbs`}
                  </Text>
                </View>
                <View style={styles.prRowRight}>
                  <Text style={styles.prWeight}>
                    {(pr.weightLbs || 0).toFixed(1)} lbs
                  </Text>
                  {!pr.isFirstTime && (
                    <Text style={styles.prDelta}>
                      +{((pr.weightLbs || 0) - (pr.previousLbs || 0)).toFixed(1)}
                    </Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Only show music section if loading tracks or if tracks were detected */}
        {(loadingTracks || spotifyTracks.length > 0) && (
          <View style={styles.tracksSection}>
            <Text style={styles.sectionHeader}>Music Played</Text>
            {loadingTracks ? (
              <View style={styles.tracksPlaceholder}>
                <ActivityIndicator color="#00ffff" />
                <Text style={styles.placeholderText}>Syncing with Spotify...</Text>
              </View>
            ) : (
              <ScrollView style={styles.trackList} contentContainerStyle={styles.trackListContent}>
                {spotifyTracks.map((track, index) => {
                  const key = track.id || `${track.track_id}-${track.played_at}`;
                  return (
                    <View
                      key={key}
                      style={[styles.trackRow, index === spotifyTracks.length - 1 ? null : styles.trackRowDivider]}
                    >
                      {track.album_image_url ? (
                        <Image source={{ uri: track.album_image_url }} style={styles.albumArt} />
                      ) : (
                        <View style={styles.albumPlaceholder}>
                          <Ionicons name="musical-notes-outline" size={18} color="#00ffff" />
                        </View>
                      )}
                      <View style={styles.trackMeta}>
                        <Text style={styles.trackTitle} numberOfLines={1}>
                          {track.track_name}
                        </Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>
                          {track.artist_name || 'Unknown artist'}
                        </Text>
                        {track.album_name ? (
                          <Text style={styles.trackAlbum} numberOfLines={1}>
                            {track.album_name}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(tabs)/workout')}
        >
          <Text style={styles.buttonText}>Back to Workouts</Text>
        </TouchableOpacity>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
  },
  summaryScroll: {
    paddingBottom: 40,
  },
  header: {
    marginTop: 60,
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 30,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    color: '#666',
    fontSize: 14,
    marginTop: 5,
    marginBottom: 5,
  },
  statValue: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  messageContainer: {
    alignItems: 'center',
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  message: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  submessage: {
    color: '#666',
    fontSize: 14,
  },
  prSection: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.25)',
  },
  prHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  prHeaderText: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: '700',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  prRowLeft: {
    flex: 1,
    paddingRight: 10,
  },
  prExerciseName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  prSubText: {
    color: '#bbb',
    fontSize: 12,
    marginTop: 2,
  },
  prRowRight: {
    alignItems: 'flex-end',
  },
  prWeight: {
    color: '#ffd700',
    fontSize: 16,
    fontWeight: '700',
  },
  prDelta: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#00ffff',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tracksSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 16,
    marginTop: 12,
  },
  sectionHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  tracksPlaceholder: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  placeholderText: {
    color: '#666',
    fontSize: 13,
    marginTop: 6,
  },
  trackList: {
    maxHeight: 240,
  },
  trackListContent: {
    paddingBottom: 4,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  trackRowDivider: {
    marginBottom: 12,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  albumPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  trackMeta: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  trackArtist: {
    color: '#00ffff',
    fontSize: 13,
    marginTop: 2,
  },
  trackAlbum: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
}); 