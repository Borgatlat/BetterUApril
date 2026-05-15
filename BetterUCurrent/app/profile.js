import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, Linking, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PremiumAvatar } from './components/PremiumAvatar';
import SpotifyConnectButton from './components/SpotifyConnectButton';
import { supabase } from '../lib/supabase';

const ProfileScreen = () => {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState(null);
  const [spotifyConnectedMessage, setSpotifyConnectedMessage] = useState('');
  const [spotifyTopTracks, setSpotifyTopTracks] = useState([]);
  const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [musicModalVisible, setMusicModalVisible] = useState(false);

  useEffect(() => {
    // Fetch user profile data
    // Replace with actual API call
    setUserProfile({
      id: '1',
      username: 'john_doe',
      avatar_url: 'https://placehold.co/400x400',
      full_name: 'John Doe',
      is_premium: true,
      fitness_goal: 'Lose weight'
    });
  }, []);

  const fetchSpotifyTopTracks = useCallback(async () => {
    if (!userProfile?.id) {
      setSpotifyTopTracks([]);
      return;
    }

    setSpotifyLoading(true);
    try {
      const { data, error } = await supabase
        .from('workout_spotify_tracks')
        .select('track_name, artist_name, track_id, album_image_url')
        .eq('user_id', userProfile.id)
        .order('played_at', { ascending: false })
        .limit(75);

      if (error) {
        throw error;
      }

      const frequencyMap = new Map();
      (data || []).forEach((track) => {
        if (!track.track_name) {
          return;
        }
        const key = track.track_id ?? `${track.track_name}|||${track.artist_name ?? ''}`;
        const current = frequencyMap.get(key) ?? {
          track_name: track.track_name,
          artist_name: track.artist_name ?? '',
          track_id: track.track_id ?? null,
          album_image_url: track.album_image_url ?? null,
          play_count: 0
        };
        current.play_count += 1;
        if (!current.album_image_url && track.album_image_url) {
          current.album_image_url = track.album_image_url;
        }
        if (!current.track_id && track.track_id) {
          current.track_id = track.track_id;
        }
        frequencyMap.set(key, current);
      });

      const sorted = Array.from(frequencyMap.values())
        .sort((a, b) => b.play_count - a.play_count)
        .slice(0, 3);

      setSpotifyTopTracks(sorted);
    } catch (error) {
      console.error('Failed to fetch Spotify top tracks (profile.js):', error);
      setSpotifyTopTracks([]);
    } finally {
      setSpotifyLoading(false);
    }
  }, [userProfile?.id]);

  useEffect(() => {
    fetchSpotifyTopTracks();
  }, [fetchSpotifyTopTracks]);

  const handleSpotifyConnected = useCallback(() => {
    setSpotifyConnectedMessage('Spotify connected! ✅');
    fetchSpotifyTopTracks();
  }, [fetchSpotifyTopTracks]);

  const openSpotifyTrack = useCallback(async (track) => {
    const trackId = typeof track?.track_id === 'string' ? track.track_id.trim() : '';
    if (!trackId) {
      Alert.alert('Track unavailable', 'We could not find a Spotify link for this song.');
      return;
    }

    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
    try {
      const supported = await Linking.canOpenURL(spotifyUrl);
      if (!supported) {
        Alert.alert('Spotify unavailable', 'Spotify could not be opened on this device.');
        return;
      }
      await Linking.openURL(spotifyUrl);
    } catch (error) {
      console.error('Failed to open Spotify track link:', error);
      Alert.alert('Error', 'Something went wrong while opening Spotify.');
    }
  }, []);

  const topTracksHeading = useMemo(() => {
    if (!spotifyTopTracks.length) {
      return null;
    }
    if (!userProfile) {
      return 'Top tracks';
    }
    return `Your top 3 songs`;
  }, [spotifyTopTracks.length, userProfile]);

  if (!userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <PremiumAvatar
          userId={userProfile.id}
          source={userProfile.avatar_url ? { uri: userProfile.avatar_url } : null}
          size={100}
          style={styles.avatar}
          isPremium={userProfile.is_premium}
          username={userProfile.username}
          fullName={userProfile.full_name}
        />
        <Text style={styles.username}>@{userProfile.username}</Text>
        {userProfile.full_name && (
          <Text style={styles.fullName}>{userProfile.full_name}</Text>
        )}
        <View style={styles.goalBox}>
          <Text style={styles.goalText}>{userProfile.fitness_goal ? `Goal: ${userProfile.fitness_goal.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : 'No goal set.'}</Text>
        </View>
      </View>

      <View style={styles.bodySection}>
        {(spotifyLoading || topTracksHeading) && (
          <View style={styles.spotifyTopTracksWrapper}>
            <View style={styles.spotifyTopTracksCard}>
              {spotifyLoading ? (
                <View style={styles.spotifyTopTracksLoading}>
                  <ActivityIndicator size="small" color="#38bdf8" />
                  <Text style={styles.spotifyTopTracksHelper}>Crunching your top songs…</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.spotifyTopTracksTitle}>{topTracksHeading}</Text>
                  <View style={styles.spotifyTopTracksList}>
                    {spotifyTopTracks.map((track, index) => (
                      <TouchableOpacity
                        key={`${track.track_id || track.track_name || index}-${index}`}
                        style={styles.spotifyTrackChip}
                        activeOpacity={0.85}
                        onPress={() => openSpotifyTrack(track)}
                      >
                        <View style={styles.spotifyTrackNumber}>
                          <Text style={styles.spotifyTrackNumberText}>{index + 1}</Text>
                        </View>
                        {track.album_image_url ? (
                          <Image source={{ uri: track.album_image_url }} style={styles.spotifyTrackArtwork} />
                        ) : (
                          <View style={styles.spotifyTrackArtworkFallback}>
                            <Ionicons name="musical-notes-outline" size={18} color="#38bdf8" />
                          </View>
                        )}
                        <View style={styles.spotifyTrackInfo}>
                          <Text style={styles.spotifyTrackTitle} numberOfLines={1}>
                            {track.track_name}
                          </Text>
                          {track.artist_name ? (
                            <Text style={styles.spotifyTrackArtist} numberOfLines={1}>
                              {track.artist_name}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.spotifyTrackPlayCount}>
                          <Ionicons name="play-outline" size={14} color="#38bdf8" />
                          <Text style={styles.spotifyTrackPlayCountText}>{track.play_count}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.musicIntegrationButton}
          activeOpacity={0.85}
          onPress={() => setMusicModalVisible(true)}
        >
          <View style={styles.musicIntegrationButtonContent}>
            <View style={styles.musicIntegrationButtonIcon}>
              <Ionicons name="musical-notes-outline" size={20} color="#0f172a" />
            </View>
            <View style={styles.musicIntegrationButtonTextBlock}>
              <Text style={styles.musicIntegrationButtonTitle}>Music Integration</Text>
              <Text style={styles.musicIntegrationButtonSubtitle}>
                Connect Spotify to power your recaps and feed cards.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#0f172a" />
          </View>
        </TouchableOpacity>

        <Modal
          transparent
          visible={musicModalVisible}
          animationType="slide"
          onRequestClose={() => setMusicModalVisible(false)}
        >
          <View style={styles.musicModalBackdrop}>
            <View style={styles.musicModalCard}>
              <TouchableOpacity
                style={styles.musicModalClose}
                onPress={() => setMusicModalVisible(false)}
                accessibilityLabel="Close music integration"
              >
                <Ionicons name="close" size={22} color="#0f172a" />
              </TouchableOpacity>
              <ScrollView
                style={styles.musicModalScroll}
                contentContainerStyle={styles.musicModalContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.musicModalTitle}>Spotify x BetterU</Text>
                <Text style={styles.musicModalSubtitle}>
                  Add your Spotify account to sync top workout songs, show music on your community feed, and keep friends updated.
                </Text>

                <View style={styles.spotifyCard}>
                  <View style={styles.spotifyGradient}>
                    <View style={styles.spotifyLogoContainer}>
                      <View style={styles.spotifyBadge}>
                        <Ionicons name="musical-notes" size={18} color="#0f172a" />
                      </View>
                      <Text style={styles.spotifyHeadline}>Spotify x BetterU</Text>
                    </View>
                    <Text style={styles.spotifyDescription}>
                      Connect Spotify to surface your top workout songs automatically, add live track cards to your recaps, and boost motivation with real-time music insights.
                    </Text>

                    <View style={styles.spotifyPerksGrid}>
                      {[
                        { icon: 'flash', color: '#facc15', label: 'Auto track songs' },
                        { icon: 'analytics', color: '#38bdf8', label: 'Spotify insights' },
                        { icon: 'globe', color: '#34d399', label: 'Share in community' },
                      ].map((perk) => (
                        <View key={perk.label} style={styles.spotifyPerkItem}>
                          <View style={[styles.spotifyPerkBadge, { backgroundColor: `${perk.color}22`, borderColor: `${perk.color}55` }]}> 
                            <Ionicons name={perk.icon} size={18} color={perk.color} />
                          </View>
                          <Text style={styles.spotifyPerkLabel}>{perk.label}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.spotifyButtonRow}>
                      <SpotifyConnectButton onConnected={() => {
                        handleSpotifyConnected();
                        setMusicModalVisible(false);
                      }} />
                    </View>

                    {spotifyConnectedMessage ? (
                      <Text style={styles.successMessage}>{spotifyConnectedMessage}</Text>
                    ) : (
                      <Text style={styles.helperText}>
                        Your top tracks will show up in workout summaries, feed cards, and weekly reflections.
                      </Text>
                    )}
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        <TouchableOpacity style={styles.seeAllButton} onPress={() => router.push('/profile/activity')}>
          <Text style={styles.seeAllButtonText}>See All Activity</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerSection: {
    flexDirection: 'column',
    alignItems: 'stretch',
    padding: 20,
    gap: 16,
    width: '100%',
  },
  bodySection: {
    width: '100%',
    paddingHorizontal: 20,
    gap: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
    alignSelf: 'center',
  },
  username: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  fullName: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  premiumText: {
    color: '#FFD700',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  goalBox: {
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    alignSelf: 'stretch',
  },
  goalText: {
    fontSize: 16,
  },
  seeAllButton: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignSelf: 'center',
  },
  seeAllButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  spotifyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    maxWidth: 280
  },
  spotifyArtwork: {
    width: 96,
    height: 96,
    borderRadius: 18,
    opacity: 0.9
  },
  spotifyCard: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: '#0f172a',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1e293b'
  },
  spotifyGradient: {
    padding: 24,
    gap: 18
  },
  spotifyLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  spotifyBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center'
  },
  spotifyHeadline: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700'
  },
  spotifyDescription: {
    color: '#cbd5f5',
    fontSize: 14,
    lineHeight: 22
  },
  spotifyPerksGrid: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between'
  },
  spotifyPerkItem: {
    flex: 1,
    gap: 8
  },
  spotifyPerkBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1
  },
  spotifyPerkLabel: {
    color: '#cbd5f5',
    fontSize: 13,
    lineHeight: 18
  },
  spotifyButtonRow: {
    gap: 14
  },
  spotifyTopTracksSection: {
    width: '100%',
    marginTop: 24,
    marginBottom: 24,
    alignSelf: 'stretch',
  },
  spotifyTopTracksWrapper: {
    width: '100%',
    alignItems: 'center',
  },
  spotifyTopTracksCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    gap: 14,
    // alignSelf makes sure the whole card centers itself inside the wrapper instead of hugging the left padding
    alignSelf: 'center',
    width: '92%',
    maxWidth: 520,
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  spotifyTopTracksLoading: {
    alignItems: 'center',
    gap: 10,
  },
  spotifyTopTracksHelper: {
    color: '#94a3b8',
    fontSize: 13,
  },
  spotifyTopTracksTitle: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
    // textAlign centers the title text without changing how the list below lays out
    textAlign: 'center',
  },
  spotifyTopTracksList: {
    gap: 12,
    width: '100%',
  },
  spotifyTrackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    width: '100%',
  },
  spotifyTrackNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(56, 189, 248, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyTrackNumberText: {
    color: '#38bdf8',
    fontWeight: '700',
  },
  spotifyTrackArtwork: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  spotifyTrackArtworkFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(148, 163, 184, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spotifyTrackInfo: {
    flex: 1,
    minWidth: 0,
  },
  spotifyTrackTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '600',
  },
  spotifyTrackArtist: {
    color: '#cbd5f5',
    fontSize: 12,
    marginTop: 2,
  },
  spotifyTrackPlayCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  spotifyTrackPlayCountText: {
    color: '#38bdf8',
    fontWeight: '600',
    fontSize: 12,
  },
  helperText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18
  },
  successMessage: {
    fontSize: 13,
    color: '#4ade80',
    fontWeight: '600'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  musicIntegrationButton: {
    width: '100%',
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  musicIntegrationButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  musicIntegrationButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicIntegrationButtonTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  musicIntegrationButtonTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
  musicIntegrationButtonSubtitle: {
    color: '#1e293b',
    fontSize: 13,
    marginTop: 4,
  },
  musicModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  musicModalCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    padding: 20,
    maxHeight: '88%',
  },
  musicModalClose: {
    alignSelf: 'flex-end',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  musicModalScroll: {
    marginTop: 6,
  },
  musicModalContent: {
    paddingBottom: 10,
    gap: 18,
  },
  musicModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  musicModalSubtitle: {
    fontSize: 14,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
});

export default ProfileScreen; 