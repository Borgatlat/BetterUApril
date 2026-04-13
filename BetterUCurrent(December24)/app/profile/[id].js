import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, ScrollView, FlatList, TouchableOpacity, Alert, Linking } from 'react-native';
import ReportModal from '../../components/ReportModal';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import FeedCard from '../components/FeedCard';
import { createNudgeNotification } from '../../utils/notificationHelpers';
import { PremiumAvatar } from '../components/PremiumAvatar';
import { blockUser, areUsersBlocked } from '../../utils/blockingUtils';
import { clearFeedCache } from '../../utils/feedPreloader';
import { useAuth } from '../../context/AuthContext';
import { useUnits } from '../../context/UnitsContext'; // Import units context for weight/height display
import { StreakDisplay } from '../../components/StreakDisplay';
import BadgeDisplay from '../../components/BadgeDisplay';
import BadgeModal from '../../components/BadgeModal';
import TrophyCase from '../../components/TrophyCase';

const FriendProfileScreen = () => {
  const [showReportModal, setShowReportModal] = useState(false);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [prs, setPRs] = useState([]);
  const [mentalSessions, setMentalSessions] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [runs, setRuns] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showActivities, setShowActivities] = useState(false); // Toggle to show all activities
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false); // Add admin state
  const [banStatus, setBanStatus] = useState(null); // Add ban status state
  const [nudgeSending, setNudgeSending] = useState(false); // Track when a nudge is being sent
const [spotifyTopTracks, setSpotifyTopTracks] = useState([]);
const [spotifyLoading, setSpotifyLoading] = useState(false);
  const [displayedBadge, setDisplayedBadge] = useState(null);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);
  
  // Pagination state for activities - start with 5 of each
  const [visiblePRs, setVisiblePRs] = useState(5);
  const [visibleWorkouts, setVisibleWorkouts] = useState(5);
  const [visibleMental, setVisibleMental] = useState(5);
  const [visibleRuns, setVisibleRuns] = useState(5);
  
  // Get unit preferences from context for displaying weight/height in correct units
  const { convertWeight, convertHeight, getWeightUnit, getHeightUnit, useImperial } = useUnits();
  
  // Format value helper - converts and displays values with appropriate units
  // This handles the conversion from database values (stored in metric) to display format
  const formatValue = useCallback((value, type) => {
    if (value === null || value === undefined) return 'Not set';
    
    if (type === 'weight') {
      // convertWeight takes kg from DB and converts to lbs if useImperial
      const displayValue = convertWeight(value);
      return `${displayValue} ${getWeightUnit()}`;
    }
    if (type === 'height') {
      // convertHeight takes cm from DB and converts to ft'in" if useImperial
      const displayValue = convertHeight(value);
      return useImperial ? displayValue : `${displayValue} ${getHeightUnit()}`;
    }
    return value;
  }, [convertWeight, convertHeight, getWeightUnit, getHeightUnit, useImperial]);
  
  // Calculate BMI from profile data
  // BMI = weight(kg) / height(m)^2
  const bmi = useMemo(() => {
    if (!profile?.weight || !profile?.height) return null;
    const heightInMeters = profile.height / 100; // height stored in cm
    const bmiValue = profile.weight / (heightInMeters * heightInMeters);
    return bmiValue.toFixed(1);
  }, [profile?.weight, profile?.height]);
  
  // Get BMI category based on calculated BMI value
  const bmiCategory = useMemo(() => {
    if (!bmi) return null;
    const bmiNum = parseFloat(bmi);
    if (bmiNum < 18.5) return 'Underweight';
    if (bmiNum < 25) return 'Normal';
    if (bmiNum < 30) return 'Overweight';
    return 'Obese';
  }, [bmi]);

  // Profile theme options - background colors (must match profile.js)
  const PROFILE_THEMES = {
    default: {
      name: 'Default',
      backgroundColor: '#000000',
    },
    light_blue: {
      name: 'Ocean Blue',
      backgroundColor: '#1e3a5f',
    },
    pink: {
      name: 'Sunset Pink',
      backgroundColor: '#4a1942',
    },
    green: {
      name: 'Forest Green',
      backgroundColor: '#1a3a2a',
    },
    midnight_blue: {
      name: 'Midnight Blue',
      backgroundColor: '#0a1628',
    },
    charcoal: {
      name: 'Charcoal',
      backgroundColor: '#1a1a1a',
    },
    crimson_night: {
      name: 'Crimson Night',
      backgroundColor: '#2d0a0a',
    },
    royal_purple: {
      name: 'Royal Purple',
      backgroundColor: '#1a0a2e',
    },
    emerald_dark: {
      name: 'Emerald Dark',
      backgroundColor: '#0a1f1a',
    },
    golden_hour: {
      name: 'Golden Hour',
      backgroundColor: '#2a1f0a',
    },
    aurora: {
      name: 'Aurora',
      backgroundColor: '#0a1a2a',
    },
    volcanic: {
      name: 'Volcanic',
      backgroundColor: '#1f0a0a',
    },
    platinum: {
      name: 'Platinum',
      backgroundColor: '#1a1a1f',
    },
    neon_cyber: {
      name: 'Neon Cyber',
      backgroundColor: '#0f0a1a',
    },
    obsidian: {
      name: 'Obsidian',
      backgroundColor: '#050505',
    },
  };

  // Get current theme based on profile's selected theme
  const currentTheme = useMemo(() => {
    return PROFILE_THEMES[profile?.profile_theme] || PROFILE_THEMES.default;
  }, [profile?.profile_theme]);

  // Check if profile is public (default to false/private if not set)
  const isProfilePublic = profile?.is_profile_public === true;

  // Helper to capitalize first letter of each word
  const capitalizeWords = useCallback((str) => {
    if (!str) return 'Not set';
    return str
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }, []);

  const formatWeightKg = useCallback((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return value % 1 === 0 ? `${value.toFixed(0)} kg` : `${value.toFixed(1)} kg`;
  }, []);

  const formatTimeMinutes = useCallback((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    if (value <= 0) return '0:00';
    const totalSeconds = Math.round(value * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const formatDistanceMeters = useCallback((value) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return '—';
    const km = value / 1000;
    const display = km >= 10 ? km.toFixed(1) : km.toFixed(2);
    return `${display} km`;
  }, []);

  const formatProgressPercent = useCallback((value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return `${Math.min(Math.max(Math.round(value), 0), 999)}%`;
  }, []);

  const resolveDurationSeconds = useCallback((secondsValue, fallbackValue, fallbackUnit = 'seconds') => {
    const toNumber = (val) => {
      if (val === null || val === undefined) return null;
      const numeric = typeof val === 'string' ? parseFloat(val) : val;
      return Number.isFinite(numeric) ? numeric : null;
    };

    const seconds = toNumber(secondsValue);
    if (seconds && seconds > 0) return seconds;

    const fallback = toNumber(fallbackValue);
    if (fallback && fallback > 0) {
      return fallbackUnit === 'minutes' ? fallback * 60 : fallback;
    }

    return null;
  }, []);

  const formatDurationSeconds = useCallback((value) => {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return '—';
    const minutes = value / 60;
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      if (remainingMinutes < 0.01) {
        return `${hours} hr${hours === 1 ? '' : 's'}`;
      }
      return `${hours} hr ${remainingMinutes >= 1 ? remainingMinutes.toFixed(0) : remainingMinutes.toFixed(1)} min`;
    }
    if (minutes >= 1) {
      return `${Math.round(minutes)} min`;
    }
    return `${value.toFixed(0)} sec`;
  }, []);

  const buildPRStats = useCallback((pr) => {
    if (!pr) return [];

    const stats = [];
    if (pr.exercise_type === 'weight') {
      const current = typeof pr.current_weight_kg === 'number' ? pr.current_weight_kg : null;
      const target = typeof pr.target_weight_kg === 'number' ? pr.target_weight_kg : null;
      const progress = current && target && target !== 0 ? (current / target) * 100 : null;

      stats.push({ value: formatWeightKg(current), label: 'Current', highlight: true });
      stats.push({ value: formatWeightKg(target), label: 'Target' });
      stats.push({ value: progress ? formatProgressPercent(progress) : '—', label: 'Progress' });
    } else {
      const current = typeof pr.current_time_minutes === 'number' ? pr.current_time_minutes : null;
      const target = typeof pr.target_time_minutes === 'number' ? pr.target_time_minutes : null;
      const distance = typeof pr.distance_meters === 'number' ? pr.distance_meters : null;
      const progress = current && target && current !== 0 ? (target / current) * 100 : null;

      stats.push({ value: formatTimeMinutes(current), label: 'Current', highlight: true });
      stats.push({ value: formatTimeMinutes(target), label: 'Target' });
      stats.push({ value: progress ? formatProgressPercent(progress) : formatDistanceMeters(distance), label: progress ? 'Progress' : 'Distance' });
    }

    return stats;
  }, [formatDistanceMeters, formatProgressPercent, formatTimeMinutes, formatWeightKg]);

  const handleEditWorkout = (workoutId) => {
    router.push(`/edit-workout/${workoutId}`);
  };

  const handleEditMental = (sessionId) => {
    router.push(`/edit-mental/${sessionId}`);
  };

  const handleEditRun = (runId) => {
    router.push(`/edit-run/${runId}`);
  };

const loadSpotifyTopTracks = useCallback(async (targetUserId) => {
  if (!targetUserId) {
    setSpotifyTopTracks([]);
    return;
  }

  setSpotifyLoading(true);
  try {
    const { data: recentTracks, error: tracksError } = await supabase
      .from('workout_spotify_tracks')
      .select('track_name, artist_name, track_id, album_image_url')
      .eq('user_id', targetUserId)
      .order('played_at', { ascending: false })
      .limit(100);

    if (tracksError) {
      throw tracksError;
    }

    const frequencyMap = new Map();
    (recentTracks || []).forEach((track) => {
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
    console.error('Failed to load Spotify top tracks for profile view:', error);
    setSpotifyTopTracks([]);
  } finally {
    setSpotifyLoading(false);
  }
}, []);

// Only load top tracks when viewing your own profile
useEffect(() => {
  // Check if we're viewing our own profile (currentUserId === id)
  // Only fetch top tracks for your own profile to save resources
  if (currentUserId && id && currentUserId === id && profile?.id) {
    loadSpotifyTopTracks(profile.id);
  } else {
    // Clear tracks if viewing someone else's profile
    setSpotifyTopTracks([]);
    setSpotifyLoading(false);
  }
}, [currentUserId, id, profile?.id, loadSpotifyTopTracks]);

const openSpotifyTrack = useCallback(async (track) => {
  const trackId = typeof track?.track_id === 'string' ? track.track_id.trim() : '';
  if (!trackId) {
    Alert.alert('Track unavailable', 'This song does not have a Spotify link yet.');
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
    console.error('Failed to open Spotify track link (profile/[id]):', error);
    Alert.alert('Error', 'Something went wrong while opening Spotify.');
  }
}, []);

const spotifyTopTracksHeading = useMemo(() => {
  if (!spotifyTopTracks.length) {
    return null;
  }

  if (currentUserId && profile?.id && currentUserId === profile.id) {
    return 'Your top 3 songs';
  }

  const displayName = profile?.full_name?.trim() || (profile?.username ? `@${profile.username}` : 'This athlete');
  if (!displayName) {
    return 'Top 3 songs';
  }

  const suffix = /s$/i.test(displayName) ? "'" : "'s";
  return `${displayName}${suffix} top 3 songs`;
}, [spotifyTopTracks.length, profile?.full_name, profile?.username, currentUserId, profile?.id]);

  // Add a refresh function to manually check ban status
  const refreshBanStatus = async () => {
    if (id) {
      console.log('🔄 Refreshing ban status for user:', id);
      const banStatus = await checkBanStatus(id);
      console.log('🔄 Refreshed ban status:', banStatus);
      setBanStatus(banStatus);
    }
  };

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
      
      // Check if current user is admin
      if (user?.id) {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('is_admin, full_name, username')
          .eq('id', user.id)
          .single();
        
        if (!error && profileData) {
          if (profileData.is_admin) {
            setIsAdmin(true);
          }
          setCurrentUserProfile(profileData);
        }
      }
      
      // Load profile data after setting current user ID
      if (id) {
        fetchAll();
      }
    })();
  }, [id]);

  // Add function to check if user is banned
  const checkBanStatus = async (userId) => {
    try {
      console.log('🔍 Checking ban status for user:', userId);
      console.log('🔍 Current user ID:', currentUserId);
      console.log('🔍 Is current user admin:', isAdmin);
      
      // Use the secure RLS function to get ban status
      let banStatus = { isBanned: false };
      
      try {
        // Call the secure function that respects RLS
        const { data: banData, error: banError } = await supabase
          .rpc('get_public_ban_status', { user_id_param: userId });
        
        if (banError) {
          console.log('🚫 Error calling get_public_ban_status:', banError);
          return { isBanned: false };
        }
        
        console.log('📋 Raw ban data from RLS function:', banData);
        
        // Also check directly in the bans table for debugging
        const { data: directBanCheck, error: directBanError } = await supabase
          .from('bans')
          .select('*')
          .eq('user_id', userId)
          .eq('is_active', true);
        
        console.log('🔍 Direct ban check from bans table:', directBanCheck);
        console.log('🔍 Direct ban check error:', directBanError);
        
        if (banData && banData.length > 0) {
          const banInfo = banData[0];
          console.log('📋 Ban status from RLS function:', banInfo);
          
          if (banInfo.is_banned) {
            console.log('🚫 User is banned');
            
            // Set ban status based on what the RLS function provides
            banStatus = { 
              isBanned: true, 
              permanent: banInfo.ban_status === 'banned_permanent',
              reason: null, // Will be fetched if user can see details
              canSeeReason: banInfo.can_see_details, // Only admins and banned user can see details
              endsAt: null // Will be fetched if user can see details
            };
            
            // If user can see details (admin or viewing own profile), fetch the actual ban details
            if (banInfo.can_see_details) {
              try {
                const { data: banDetails, error: banDetailsError } = await supabase
                  .from('bans')
                  .select('reason, banned_until, is_permanent')
                  .eq('user_id', userId)
                  .eq('is_active', true)
                  .order('created_at', { ascending: false })
                  .limit(1);
                
                if (!banDetailsError && banDetails && banDetails.length > 0) {
                  const ban = banDetails[0];
                  banStatus.reason = ban.reason;
                  banStatus.endsAt = ban.banned_until;
                  banStatus.permanent = ban.is_permanent;
                  console.log('📋 Ban details fetched:', ban);
                }
              } catch (detailsError) {
                console.log('🚫 Error fetching ban details:', detailsError);
              }
            }
            
            console.log('📋 Ban status set:', banStatus);
          } else {
            console.log('✅ User is not banned');
            banStatus = { isBanned: false };
          }
        } else {
          console.log('✅ No ban data returned');
          banStatus = { isBanned: false };
        }
        
      } catch (profileAccessError) {
        console.log('🚫 Profile access error:', profileAccessError);
        banStatus = { isBanned: false };
      }

      console.log('📋 Final ban status:', banStatus);
      return banStatus;
    } catch (error) {
      console.error('❌ Error checking ban status:', error);
      return { isBanned: false };
    }
  };

  const fetchAll = async () => {
      setLoading(true);
    setError(null);
    try {
      // Get current user ID for blocking check (must check inside fetchAll to ensure it's loaded)
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      const currentUserIdForBlock = currentUser?.id || currentUserId;
      
      // Check for blocking relationship before loading profile (mutual blocking)
      // This ensures users who blocked each other cannot see each other's profiles
      if (currentUserIdForBlock && currentUserIdForBlock !== id) {
        const isBlocked = await areUsersBlocked(currentUserIdForBlock, id);
        if (isBlocked) {
          // Users are blocked (mutual blocking) - redirect and show message
          setError('This profile is not available.');
          setLoading(false);
          Alert.alert(
            'Profile Unavailable',
            'You cannot view this profile because you have blocked this user or they have blocked you.',
            [
              {
                text: 'OK',
                onPress: () => router.replace('/(tabs)/community')
              }
            ]
          );
          return;
        }
      }
      
      // Update currentUserId state if we just fetched it
      if (currentUser?.id && !currentUserId) {
        setCurrentUserId(currentUser.id);
      }

      // Fetch profile with displayed badge
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          badge_definitions:displayed_badge_id (
            id,
            badge_key,
            name,
            description,
            how_to_earn,
            icon_url
          )
        `)
        .eq('id', id)
        .single();
      if (profileError) throw profileError;
      setProfile(profileData);
      
      // Set displayed badge if exists
      if (profileData?.badge_definitions) {
        // Get earned_at from user_badges
        const { data: badgeData } = await supabase
          .from('user_badges')
          .select('earned_at, is_displayed')
          .eq('user_id', id)
          .eq('badge_id', profileData.badge_definitions.id)
          .single();
        
        // Normalize badge data - badge_definitions uses 'name', but get_user_badges uses 'badge_name'
        const badgeDef = profileData.badge_definitions;
        setDisplayedBadge({
          ...badgeDef,
          name: badgeDef?.name, // Ensure name is set
          badge_name: badgeDef?.name, // Also set badge_name for consistency
          earned_at: badgeData?.earned_at || null,
          is_displayed: badgeData?.is_displayed || false,
        });
      }

      // Check ban status
      const banStatus = await checkBanStatus(id);
      console.log('🎯 Ban status result:', banStatus);
      setBanStatus(banStatus);

      // Only fetch other data if user is not banned
      if (!banStatus.isBanned) {
        console.log('✅ User not banned, fetching profile data...');
        // Fetch PRs
        const { data: prData, error: prError } = await supabase
          .from('personal_records')
          .select('*')
          .eq('user_id', id);
        if (prError) throw prError;
        setPRs(prData || []);

        // Fetch mental sessions
        const { data: msData, error: msError } = await supabase
          .from('mental_session_logs')
          .select('*')
          .eq('profile_id', id)
          .order('completed_at', { ascending: false });
        if (msError) throw msError;
        setMentalSessions(msData || []);

        // Fetch workouts
        const { data: workoutData, error: workoutError } = await supabase
          .from('user_workout_logs')
          .select('*')
          .eq('user_id', id)
          .order('completed_at', { ascending: false });
        if (workoutError) throw workoutError;
        setWorkouts(workoutData || []);

        // Fetch runs
        const { data: runsData, error: runsError } = await supabase
          .from('runs')
          .select('*')
          .eq('user_id', id)
          .order('start_time', { ascending: false });
        if (runsError) throw runsError;
        setRuns(runsData || []);

      // Fetch all kudos in bulk for the activities
      const [workoutKudos, mentalKudos, runKudos] = await Promise.all([
        supabase
          .from('workout_kudos')
          .select('*')
          .in('workout_id', (workoutData || []).map(w => w.id)),
        supabase
          .from('mental_session_kudos')
          .select('*')
          .in('session_id', (msData || []).map(m => m.id)),
        supabase
          .from('run_kudos')
          .select('*')
          .in('run_id', (runsData || []).map(r => r.id))
      ]);

      if (workoutKudos.error) throw workoutKudos.error;
      if (mentalKudos.error) throw mentalKudos.error;
      if (runKudos.error) throw runKudos.error;

      // Create kudos maps for quick lookup
      const kudosMap = {};
      (workoutKudos.data || []).forEach(k => {
        if (!kudosMap[k.workout_id]) kudosMap[k.workout_id] = [];
        kudosMap[k.workout_id].push(k);
      });
      (mentalKudos.data || []).forEach(k => {
        if (!kudosMap[k.session_id]) kudosMap[k.session_id] = [];
        kudosMap[k.session_id].push(k);
      });
      (runKudos.data || []).forEach(k => {
        if (!kudosMap[k.run_id]) kudosMap[k.run_id] = [];
        kudosMap[k.run_id].push(k);
      });

      // Fetch all comments in bulk
      const [workoutComments, mentalComments, runComments] = await Promise.all([
        supabase
          .from('workout_comments')
          .select('*')
          .in('workout_id', (workoutData || []).map(w => w.id)),
        supabase
          .from('mental_session_comments')
          .select('*')
          .in('session_id', (msData || []).map(m => m.id)),
        supabase
          .from('run_comments')
          .select('*')
          .in('run_id', (runsData || []).map(r => r.id))
      ]);

      // Create comments maps for quick lookup
      const commentsMap = {};
      (workoutComments.data || []).forEach(c => {
        if (!commentsMap[c.workout_id]) commentsMap[c.workout_id] = [];
        commentsMap[c.workout_id].push(c);
      });
      (mentalComments.data || []).forEach(c => {
        if (!commentsMap[c.session_id]) commentsMap[c.session_id] = [];
        commentsMap[c.session_id].push(c);
      });
      (runComments.data || []).forEach(c => {
        if (!commentsMap[c.run_id]) commentsMap[c.run_id] = [];
        commentsMap[c.run_id].push(c);
      });

      // Update the state with kudos and comments data
      setWorkouts((workoutData || []).map(w => ({
        ...w,
        kudos: kudosMap[w.id] || [],
        comments: commentsMap[w.id] || []
      })));

      setMentalSessions((msData || []).map(m => ({
        ...m,
        kudos: kudosMap[m.id] || [],
        comments: commentsMap[m.id] || []
      })));

      setRuns((runsData || []).map(r => ({
        ...r,
        kudos: kudosMap[r.id] || [],
        comments: commentsMap[r.id] || []
      })));
      }

    } catch (e) {
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  // Add ban user function
  const handleBanUser = async () => {
    if (!isAdmin) return;
    
    // Create a simple input for the ban reason
    Alert.prompt(
      'Ban User',
      `Enter reason for banning @${profile?.username || 'this user'}:`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Continue',
          onPress: (reason) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for the ban');
              return;
            }
            
            // Show ban options with the reason
            showBanOptions(reason.trim());
          }
        }
      ],
      'plain-text',
      'Violation of community guidelines'
    );
  };

  // Show ban options after reason is provided
  const showBanOptions = (reason) => {
    Alert.alert(
      'Ban User',
      `Ban @${profile?.username || 'this user'} for: "${reason}"`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Temporary Ban (7 days)',
          onPress: async () => {
            try {
              // Check if current user is authenticated
              if (!currentUserId) {
                Alert.alert('Error', 'You must be logged in to ban users');
                return;
              }

              const { error } = await supabase
                .from('bans')
                .insert({
                  user_id: id,
                  reason: reason,
                  banned_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                  is_permanent: false,
                  created_by: currentUserId
                });

              if (error) throw error;

              Alert.alert('Success', 'User has been temporarily banned for 7 days');
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            }
          }
        },
        {
          text: 'Permanent Ban',
          style: 'destructive',
          onPress: async () => {
            try {
              // Check if current user is authenticated
              if (!currentUserId) {
                Alert.alert('Error', 'You must be logged in to ban users');
                return;
              }

              const { error } = await supabase
                .from('bans')
                .insert({
                  user_id: id,
                  reason: reason,
                  is_permanent: true,
                  created_by: currentUserId
                });

              if (error) throw error;

              Alert.alert('Success', 'User has been permanently banned');
            } catch (error) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  // Show banned user display if user is banned
  if (banStatus?.isBanned) {
    console.log('🚫 Rendering banned user display, ban status:', banStatus);
    return (
      <View style={[styles.container, { backgroundColor: currentTheme.backgroundColor }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)/community')}>
            <Ionicons name="arrow-back" size={24} color="#00ffff" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.bannedUserContainer}>
          <Ionicons name="ban" size={80} color="#ff0055" style={styles.bannedIcon} />
          <Text style={styles.bannedTitle}>This User is Banned</Text>
          <Text style={styles.bannedSubtitle}>
            {banStatus.permanent ? "Permanently Suspended" : "Temporarily Suspended"}
          </Text>
          <Text style={styles.bannedMessage}>
            This account has been suspended and is no longer accessible.
          </Text>
          {/* Only show reason and time details to users who can see them */}
          {banStatus.reason && banStatus.canSeeReason && (
            <View style={styles.bannedReasonContainer}>
              <Text style={styles.bannedReasonLabel}>Reason:</Text>
              <Text style={styles.bannedReasonText}>{banStatus.reason}</Text>
            </View>
          )}
          {/* Only show time details to users who can see them */}
          {banStatus.endsAt && banStatus.canSeeReason && (
            <View style={styles.bannedTimeContainer}>
              <Text style={styles.bannedTimeLabel}>Suspended Until:</Text>
              <Text style={styles.bannedTimeText}>
                {new Date(banStatus.endsAt).toLocaleDateString()}
              </Text>
            </View>
          )}
          <View style={styles.bannedWarningContainer}>
            <Ionicons name="warning" size={20} color="#ffaa00" style={styles.warningIcon} />
            <Text style={styles.bannedWarning}>
              This profile is completely inaccessible while the user is suspended.
            </Text>
          </View>
          <Text style={styles.bannedNote}>
            This ban applies to all users in the community.
          </Text>
          {/* Add refresh button for admins */}
          {isAdmin && (
            <TouchableOpacity style={styles.refreshButton} onPress={refreshBanStatus}>
              <Ionicons name="refresh" size={16} color="#00ffff" />
              <Text style={styles.refreshButtonText}>Refresh Status</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  } else {
    console.log('✅ User not banned, rendering normal profile, ban status:', banStatus);
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Profile not found</Text>
      </View>
    );
  }

  // Tab content renderers
  const renderPRs = () => {
    if (prs && prs.length > 0) {
      return (
        <>
          {prs.map((item) => (
            <FeedCard
              key={item.id}
              avatarUrl={profile.avatar_url}
              name={profile.full_name || profile.username || 'User'}
              date={item.updated_at ? new Date(item.updated_at).toLocaleDateString() : (item.created_at ? new Date(item.created_at).toLocaleDateString() : '-')}
              title={item.exercise_name || 'Personal Record'}
              description={item.notes ?? undefined}
              stats={buildPRStats(item)}
              type="pr"
              targetId={item.id}
              isOwner={currentUserId === profile.id}
              onEdit={null}
              userId={profile.id}
              initialKudosCount={0}
              initialHasKudoed={false}
              initialCommentCount={0}
            />
          ))}
        </>
      );
    }
    return <Text style={styles.emptyText}>No PRs found.</Text>;
  };

  const renderMental = () => {
    if (mentalSessions && mentalSessions.length > 0) {
      return (
        <>
          {mentalSessions.map((item) => {
            const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration_minutes ?? item.duration, 'minutes');
            const durationDisplay = durationSeconds
              ? formatDurationSeconds(durationSeconds)
              : resolveDurationSeconds(null, item.duration) // fallback minutes string
                ? `${resolveDurationSeconds(null, item.duration) / 60} min`
                : '—';
            const sessionDescription = [
              item.session_type,
              item.session_name,
              item.notes,
            ]
              .map((fragment) => (fragment ?? '').trim())
              .filter(Boolean)
              .join(' • ');

            return (
              <FeedCard
                key={item.id}
                avatarUrl={profile.avatar_url}
                name={profile.full_name || profile.username || 'User'}
                date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
                title={item.session_name || item.session_type || 'Session'}
                description={sessionDescription || undefined}
                stats={[
                  { value: durationDisplay, label: 'Duration', highlight: true },
                  { value: item.calmness_level ? `${item.calmness_level}/10` : '—', label: 'Calmness' },
                ]}
                type="mental"
                targetId={item.id}
                isOwner={currentUserId === profile.id}
                onEdit={() => handleEditMental(item.id)}
                userId={profile.id}
                photoUrl={item.photo_url}
                initialKudosCount={item.kudos?.length || 0}
                initialHasKudoed={item.kudos?.some(k => k.user_id === currentUserId) || false}
                initialCommentCount={item.comments?.length || 0}
              />
            );
          })}
        </>
      );
    }
    return <Text style={styles.emptyText}>No mental sessions found.</Text>;
  };

  const renderWorkouts = () => {
    if (workouts && workouts.length > 0) {
      return (
        <>
          {workouts.map((item) => {
            const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration, 'seconds');
            const durationDisplay = durationSeconds
              ? formatDurationSeconds(durationSeconds)
              : '—';
            const description = [item.description, item.workout_focus, item.notes]
              .map((fragment) => (fragment ?? '').trim())
              .filter(Boolean)
              .join(' • ');

            return (
              <FeedCard
                key={item.id}
                avatarUrl={profile.avatar_url}
                name={profile.full_name || profile.username || 'User'}
                date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
                title={item.workout_name || 'Workout'}
                description={description || undefined}
                stats={[
                  { value: durationDisplay, label: 'Duration', highlight: true },
                  { value: item.exercise_count ?? item.total_exercises ?? '—', label: 'Exercises' },
                ]}
                type="workout"
                targetId={item.id}
                isOwner={currentUserId === profile.id}
                onEdit={() => handleEditWorkout(item.id)}
                userId={profile.id}
                photoUrl={item.photo_url}
                initialKudosCount={item.kudos?.length || 0}
                initialHasKudoed={item.kudos?.some(k => k.user_id === currentUserId) || false}
                initialCommentCount={item.comments?.length || 0}
              />
            );
          })}
        </>
      );
    }
    return <Text style={styles.emptyText}>No workouts found.</Text>;
  };

  const renderOtherActivities = () => {
    if (runs && runs.length > 0) {
      return (
        <>
          {runs.map((item) => {
            const distanceKm = typeof item.distance_meters === 'number'
              ? item.distance_meters / 1000
              : null;
            const paceMinutes = item.average_pace_minutes_per_km;
            const paceFormatted = paceMinutes
              ? `${Math.floor(paceMinutes)}:${Math.floor((paceMinutes % 1) * 60).toString().padStart(2, '0')}`
              : null;
            const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration_minutes, 'minutes');

            const stats = [];
            if (distanceKm) {
              stats.push({
                value: distanceKm >= 10 ? `${distanceKm.toFixed(1)} km` : `${distanceKm.toFixed(2)} km`,
                label: 'Distance',
                highlight: true,
              });
            }
            if (paceFormatted) {
              stats.push({ value: `${paceFormatted} /km`, label: 'Pace' });
            }
            stats.push({ value: formatDurationSeconds(durationSeconds), label: 'Duration' });

            return (
              <FeedCard
                key={item.id}
                avatarUrl={profile.avatar_url}
                name={profile.full_name || profile.username || 'User'}
                date={item.start_time ? new Date(item.start_time).toLocaleDateString() : '-'}
                title={item.name || 'Activity'}
                description={item.notes || item.location || undefined}
                stats={stats}
                type="run"
                targetId={item.id}
                isOwner={currentUserId === profile.id}
                onEdit={() => handleEditRun(item.id)}
                userId={profile.id}
                photoUrl={item.photo_url}
                initialKudosCount={item.kudos?.length || 0}
                initialHasKudoed={item.kudos?.some(k => k.user_id === currentUserId) || false}
                initialCommentCount={item.comments?.length || 0}
                runData={{
                  path: item.path,
                  distance_meters: item.distance_meters,
                  duration_seconds: durationSeconds,
                  start_time: item.start_time,
                  end_time: item.end_time,
                }}
                showMapToOthers={item.show_map_to_others !== false}
              />
            );
          })}
        </>
      );
    }
    return <Text style={styles.emptyText}>No other activities found.</Text>;
  };

  const handleSendNudge = async (nudgeType) => {
    if (!currentUserId || !id) {
      return;
    }

    try {
      setNudgeSending(true); // Keep track of the async call so we can disable the button.
      const nudgerName = currentUserProfile?.full_name || currentUserProfile?.username || 'A friend';
      await createNudgeNotification(
        currentUserId,
        id,
        nudgeType,
        nudgerName,
      );
      const targetLabel = profile.full_name || profile.username || 'them';
      const friendlyType =
        nudgeType === 'run' ? 'go for a run' :
        nudgeType === 'mental' ? 'do a mental session' :
        'work out';
      Alert.alert(
        'Nudge Sent',
        `We let ${targetLabel} know you want them to ${friendlyType}.`,
      );
    } catch (error) {
      console.error('❌ Error sending nudge:', error);
      Alert.alert('Error', 'Could not send the nudge. Please try again.');
    } finally {
      setNudgeSending(false);
    }
  };

  const handleNudgePress = () => {
    if (nudgeSending) {
      return;
    }

    const targetName = profile.full_name || `@${profile.username}`;
    // Alert.alert opens the native chooser with buttons so the user can pick a nudge type.
    Alert.alert(
      'Send a Nudge',
      `What do you want ${targetName} to do?`,
      [
        { text: 'Workout', onPress: () => handleSendNudge('workout') },
        { text: 'Run', onPress: () => handleSendNudge('run') },
        { text: 'Mental Session', onPress: () => handleSendNudge('mental') },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleBlockUser = async () => {
    if (!currentUserId || !id) {
      return;
    }

    const targetName = profile?.full_name || profile?.username || 'this user';
    
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${targetName}? You won't be able to see each other's profiles or interact.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await blockUser(id, currentUserId);
              if (result.success) {
                // Clear feed cache so blocked user's activities are removed immediately
                clearFeedCache();
                
                Alert.alert(
                  'User Blocked',
                  `${targetName} has been blocked. You won't see each other's profiles or activities.`,
                  [
                    {
                      text: 'OK',
                      onPress: () => router.replace('/(tabs)/community')
                    }
                  ]
                );
              } else {
                Alert.alert('Error', result.error || 'Failed to block user. Please try again.');
              }
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.backgroundColor }]}>
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/(tabs)/community')}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
      </View>

      {/* Nudge Button */}
      {currentUserId && currentUserId !== id && (
        <TouchableOpacity
          style={[styles.nudgeButton, nudgeSending && styles.nudgeButtonDisabled]}
          onPress={handleNudgePress}
          disabled={nudgeSending}
        >
          <Ionicons
            name="megaphone-outline"
            size={20}
            color={nudgeSending ? '#999999' : '#00ffff'}
          />
          <Text style={styles.nudgeButtonText}>
            {nudgeSending ? 'Sending...' : 'Send Nudge'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Profile Info Card - Matches the user's own profile layout */}
      <View style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatarWrapper}>
            <PremiumAvatar
              userId={profile.id}
              source={profile.avatar_url ? { uri: profile.avatar_url } : null}
              size={100}
              style={styles.avatar}
              isPremium={profile.is_premium}
              username={profile.username}
              fullName={profile.full_name}
            />
            {/* Badge positioned at bottom right of avatar */}
            {displayedBadge && (
              <View style={styles.badgeOverlay}>
                <BadgeDisplay
                  badge={displayedBadge}
                  onPress={() => {
                    const badgeForModal = {
                      ...displayedBadge,
                      name: displayedBadge.name || displayedBadge.badge_name,
                      id: displayedBadge.id || displayedBadge.badge_id,
                    };
                    setSelectedBadge(badgeForModal);
                    setBadgeModalVisible(true);
                  }}
                  size="medium"
                  showLabel={false}
                />
              </View>
            )}
          </View>
          {profile.is_premium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="star" size={16} color="#FFD700" />
            </View>
          )}
        </View>
        
        {/* Name Section */}
        <View style={styles.nameContainer}>
          <Text style={styles.name}>{profile.full_name || 'User'}</Text>
          <Text style={styles.username}>@{profile.username || '--'}</Text>
        </View>

        {/* Trophy Case - Display all badges */}
        <TrophyCase userId={id} />

        {/* Bio Section (read-only) */}
        <View style={styles.bioSection}>
          <Text style={styles.bioText}>{profile?.bio || 'No bio yet'}</Text>
        </View>
      </View>

      {/* Stats Cards - Age, Weight, Height (only for public profiles) */}
      {isProfilePublic && (
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{formatValue(profile?.age)}</Text>
            <Text style={styles.statCardLabel}>Age</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{formatValue(profile?.weight, 'weight')}</Text>
            <Text style={styles.statCardLabel}>Weight</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{formatValue(profile?.height, 'height')}</Text>
            <Text style={styles.statCardLabel}>Height</Text>
          </View>
        </View>
      )}

      {/* Fitness Profile Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fitness Profile</Text>
        <View style={styles.infoCard}>
          {/* Fitness Goal */}
          <View style={styles.infoRow}>
            <Ionicons name="trophy-outline" size={24} color="#00ffff" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Fitness Goal</Text>
              <Text style={styles.infoValue}>
                {capitalizeWords(profile?.fitness_goal)}
              </Text>
            </View>
          </View>

          {/* Gender */}
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={24} color="#00ffff" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Gender</Text>
              <Text style={styles.infoValue}>
                {capitalizeWords(profile?.gender)}
              </Text>
            </View>
          </View>

          {/* Training Level */}
          <View style={[styles.infoRow, !isProfilePublic && { marginBottom: 0, borderBottomWidth: 0 }]}>
            <Ionicons name="barbell-outline" size={24} color="#00ffff" />
            <View style={styles.infoTextContainer}>
              <Text style={styles.infoLabel}>Training Level</Text>
              <Text style={styles.infoValue}>
                {capitalizeWords(profile?.training_level)}
              </Text>
            </View>
          </View>

          {/* BMI - calculated from weight and height (only for public profiles) */}
          {isProfilePublic && (
            <View style={[styles.infoRow, { marginBottom: 0, borderBottomWidth: 0 }]}>
              <Ionicons name="speedometer-outline" size={24} color="#00ffff" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>BMI</Text>
                <Text style={[styles.infoValue, { color: bmi ? '#00ffff' : '#fff' }]}>
                  {bmi ? (
                    <Text>
                      <Text style={styles.bmiValue}>{bmi}</Text>
                      <Text style={styles.bmiCategory}> ({bmiCategory})</Text>
                    </Text>
                  ) : 'Not available'}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Activity Stats Row (only for public profiles) */}
      {isProfilePublic && (
        <View style={styles.activityStatsCard}>
          <Text style={styles.activityStatsTitle}>Activity Summary</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
              <Ionicons name="barbell-outline" size={22} color="#00ffff" />
            <Text style={styles.statValue}>{workouts.length}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statItem}>
              <Ionicons name="leaf-outline" size={22} color="#00ffff" />
            <Text style={styles.statValue}>{mentalSessions.length}</Text>
            <Text style={styles.statLabel}>Mental</Text>
          </View>
          <View style={styles.statItem}>
              <Ionicons name="fitness-outline" size={22} color="#00ffff" />
            <Text style={styles.statValue}>{runs.length}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>
        </View>
        </View>
      )}

        {/* Streak Display */}
        {profile?.id && (
          <View style={styles.streakSection}>
            <Text style={styles.streakLabel}>Current Streak</Text>
            <StreakDisplay 
              userId={profile.id} 
              size="large"
            />
          </View>
        )}

      {/* Private Profile Notice */}
      {!isProfilePublic && (
        <View style={styles.privateProfileNotice}>
          <Ionicons name="lock-closed" size={24} color="#888" />
          <Text style={styles.privateProfileText}>This profile is private</Text>
          <Text style={styles.privateProfileSubtext}>Activities and personal stats are hidden</Text>
        </View>
      )}

      {/* View Activities Button (only for public profiles) */}
      {isProfilePublic && (
        <>
                      <TouchableOpacity
          style={styles.viewActivitiesButton} 
          onPress={() => {
            if (showActivities) {
              // Reset pagination when hiding
              setVisiblePRs(5);
              setVisibleWorkouts(5);
              setVisibleMental(5);
              setVisibleRuns(5);
            }
            setShowActivities(!showActivities);
          }}
        >
          <Ionicons 
            name={showActivities ? "chevron-up" : "list-outline"} 
            size={22} 
            color="#00ffff" 
          />
          <Text style={styles.viewActivitiesButtonText}>
            {showActivities ? 'Hide Activities' : 'View Activities'}
                          </Text>
          <Ionicons 
            name={showActivities ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#00ffff" 
          />
                      </TouchableOpacity>

        {/* All Activities Section - shows when button is pressed */}
        {showActivities && (
        <View style={styles.allActivitiesContainer}>
          {/* PRs Section */}
          {prs && prs.length > 0 && (
            <View style={styles.activitySection}>
              <View style={styles.activitySectionHeader}>
                <Ionicons name="trophy-outline" size={20} color="#FFD700" />
                <Text style={styles.activitySectionTitle}>Personal Records</Text>
                <Text style={styles.activityCount}>{visiblePRs >= prs.length ? prs.length : `${visiblePRs}/${prs.length}`}</Text>
                  </View>
              {prs.slice(0, visiblePRs).map((item) => (
                <FeedCard
                  key={item.id}
                  avatarUrl={profile.avatar_url}
                  name={profile.full_name || profile.username || 'User'}
                  date={item.updated_at ? new Date(item.updated_at).toLocaleDateString() : (item.created_at ? new Date(item.created_at).toLocaleDateString() : '-')}
                  title={item.exercise_name || 'Personal Record'}
                  description={item.notes ?? undefined}
                  stats={buildPRStats(item)}
                  type="pr"
                  targetId={item.id}
                  isOwner={currentUserId === profile.id}
                  onEdit={null}
                  userId={profile.id}
                  initialKudosCount={0}
                  initialHasKudoed={false}
                  initialCommentCount={0}
                />
              ))}
              {visiblePRs < prs.length && (
                <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => setVisiblePRs(prev => prev + 5)}
                >
                  <Text style={styles.loadMoreText}>Load More ({prs.length - visiblePRs} remaining)</Text>
                  <Ionicons name="chevron-down" size={16} color="#00ffff" />
                </TouchableOpacity>
              )}
          </View>
        )}

          {/* Workouts Section */}
          {workouts && workouts.length > 0 && (
            <View style={styles.activitySection}>
              <View style={styles.activitySectionHeader}>
                <Ionicons name="barbell-outline" size={20} color="#00ffff" />
                <Text style={styles.activitySectionTitle}>Workouts</Text>
                <Text style={styles.activityCount}>{visibleWorkouts >= workouts.length ? workouts.length : `${visibleWorkouts}/${workouts.length}`}</Text>
      </View>
              {workouts.slice(0, visibleWorkouts).map((item) => {
                const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration, 'seconds');
                const durationDisplay = durationSeconds ? formatDurationSeconds(durationSeconds) : '—';
                const description = [item.description, item.workout_focus, item.notes]
                  .map((fragment) => (fragment ?? '').trim())
                  .filter(Boolean)
                  .join(' • ');
                return (
                  <FeedCard
                    key={item.id}
                    avatarUrl={profile.avatar_url}
                    name={profile.full_name || profile.username || 'User'}
                    date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
                    title={item.workout_name || 'Workout'}
                    description={description || undefined}
                    stats={[
                      { value: durationDisplay, label: 'Duration', highlight: true },
                      { value: item.exercise_count ?? item.total_exercises ?? '—', label: 'Exercises' },
                    ]}
                    type="workout"
                    targetId={item.id}
                    isOwner={currentUserId === profile.id}
                    onEdit={() => handleEditWorkout(item.id)}
                    userId={profile.id}
                    photoUrl={item.photo_url}
                    initialKudosCount={item.kudos?.length || 0}
                    initialHasKudoed={item.kudos?.some(k => k.user_id === currentUserId) || false}
                    initialCommentCount={item.comments?.length || 0}
                  />
                );
              })}
              {visibleWorkouts < workouts.length && (
        <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => setVisibleWorkouts(prev => prev + 5)}
                >
                  <Text style={styles.loadMoreText}>Load More ({workouts.length - visibleWorkouts} remaining)</Text>
                  <Ionicons name="chevron-down" size={16} color="#00ffff" />
        </TouchableOpacity>
              )}
            </View>
          )}

          {/* Mental Sessions Section */}
          {mentalSessions && mentalSessions.length > 0 && (
            <View style={styles.activitySection}>
              <View style={styles.activitySectionHeader}>
                <Ionicons name="leaf-outline" size={20} color="#4ade80" />
                <Text style={styles.activitySectionTitle}>Mental Sessions</Text>
                <Text style={styles.activityCount}>{visibleMental >= mentalSessions.length ? mentalSessions.length : `${visibleMental}/${mentalSessions.length}`}</Text>
              </View>
              {mentalSessions.slice(0, visibleMental).map((item) => {
                const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration_minutes ?? item.duration, 'minutes');
                const durationDisplay = durationSeconds
                  ? formatDurationSeconds(durationSeconds)
                  : resolveDurationSeconds(null, item.duration)
                    ? `${resolveDurationSeconds(null, item.duration) / 60} min`
                    : '—';
                const sessionDescription = [item.session_type, item.session_name, item.notes]
                  .map((fragment) => (fragment ?? '').trim())
                  .filter(Boolean)
                  .join(' • ');
                return (
                  <FeedCard
                    key={item.id}
                    avatarUrl={profile.avatar_url}
                    name={profile.full_name || profile.username || 'User'}
                    date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
                    title={item.session_name || item.session_type || 'Session'}
                    description={sessionDescription || undefined}
                    stats={[
                      { value: durationDisplay, label: 'Duration', highlight: true },
                      { value: item.calmness_level ? `${item.calmness_level}/10` : '—', label: 'Calmness' },
                    ]}
                    type="mental"
                    targetId={item.id}
                    isOwner={currentUserId === profile.id}
                    onEdit={() => handleEditMental(item.id)}
                    userId={profile.id}
                    photoUrl={item.photo_url}
                    initialKudosCount={item.kudos?.length || 0}
                    initialHasKudoed={item.kudos?.some(k => k.user_id === currentUserId) || false}
                    initialCommentCount={item.comments?.length || 0}
                  />
                );
              })}
              {visibleMental < mentalSessions.length && (
        <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => setVisibleMental(prev => prev + 5)}
                >
                  <Text style={styles.loadMoreText}>Load More ({mentalSessions.length - visibleMental} remaining)</Text>
                  <Ionicons name="chevron-down" size={16} color="#00ffff" />
        </TouchableOpacity>
              )}
            </View>
          )}

          {/* Runs/Other Activities Section */}
          {runs && runs.length > 0 && (
            <View style={styles.activitySection}>
              <View style={styles.activitySectionHeader}>
                <Ionicons name="fitness-outline" size={20} color="#f97316" />
                <Text style={styles.activitySectionTitle}>Runs & Activities</Text>
                <Text style={styles.activityCount}>{visibleRuns >= runs.length ? runs.length : `${visibleRuns}/${runs.length}`}</Text>
              </View>
              {runs.slice(0, visibleRuns).map((item) => {
                const distanceKm = typeof item.distance_meters === 'number' ? item.distance_meters / 1000 : null;
                const paceMinutes = item.average_pace_minutes_per_km;
                const paceFormatted = paceMinutes
                  ? `${Math.floor(paceMinutes)}:${Math.floor((paceMinutes % 1) * 60).toString().padStart(2, '0')}`
                  : null;
                const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration_minutes, 'minutes');
                const stats = [];
                if (distanceKm) {
                  stats.push({
                    value: distanceKm >= 10 ? `${distanceKm.toFixed(1)} km` : `${distanceKm.toFixed(2)} km`,
                    label: 'Distance',
                    highlight: true,
                  });
                }
                if (paceFormatted) {
                  stats.push({ value: `${paceFormatted} /km`, label: 'Pace' });
                }
                stats.push({ value: formatDurationSeconds(durationSeconds), label: 'Duration' });
                return (
                  <FeedCard
                    key={item.id}
                    avatarUrl={profile.avatar_url}
                    name={profile.full_name || profile.username || 'User'}
                    date={item.start_time ? new Date(item.start_time).toLocaleDateString() : '-'}
                    title={item.name || 'Activity'}
                    description={item.notes || item.location || undefined}
                    stats={stats}
                    type="run"
                    targetId={item.id}
                    isOwner={currentUserId === profile.id}
                    onEdit={() => handleEditRun(item.id)}
                    userId={profile.id}
                    photoUrl={item.photo_url}
                    initialKudosCount={item.kudos?.length || 0}
                    initialHasKudoed={item.kudos?.some(k => k.user_id === currentUserId) || false}
                    initialCommentCount={item.comments?.length || 0}
                    runData={{
                      path: item.path,
                      distance_meters: item.distance_meters,
                      duration_seconds: durationSeconds,
                      start_time: item.start_time,
                      end_time: item.end_time,
                    }}
                    showMapToOthers={item.show_map_to_others !== false}
                  />
                );
              })}
              {visibleRuns < runs.length && (
        <TouchableOpacity 
                  style={styles.loadMoreButton}
                  onPress={() => setVisibleRuns(prev => prev + 5)}
                >
                  <Text style={styles.loadMoreText}>Load More ({runs.length - visibleRuns} remaining)</Text>
                  <Ionicons name="chevron-down" size={16} color="#00ffff" />
        </TouchableOpacity>
              )}
      </View>
          )}

          {/* Empty state */}
          {(!prs || prs.length === 0) && 
           (!workouts || workouts.length === 0) && 
           (!mentalSessions || mentalSessions.length === 0) && 
           (!runs || runs.length === 0) && (
            <View style={styles.emptyActivities}>
              <Ionicons name="fitness-outline" size={48} color="#666" />
              <Text style={styles.emptyActivitiesText}>No activities yet</Text>
            </View>
          )}
        </View>
        )}
          </>
        )}

      {/* Report, Block, Ban Buttons - At bottom of profile */}
      {currentUserId !== id && (
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Report & Block</Text>
          
          {/* Report Button */}
          <TouchableOpacity 
            style={styles.reportButton}
            onPress={() => setShowReportModal(true)}
          >
            <Ionicons name="flag-outline" size={20} color="#dc3545" />
            <Text style={styles.reportButtonText}>Report User</Text>
          </TouchableOpacity>

          {/* Block Button */}
          {currentUserId && (
            <TouchableOpacity 
              style={styles.blockButton}
              onPress={handleBlockUser}
            >
              <Ionicons name="ban-outline" size={20} color="#dc3545" />
              <Text style={styles.blockButtonText}>Block User</Text>
            </TouchableOpacity>
          )}

          {/* Admin Ban Button */}
          {isAdmin && (
            <TouchableOpacity 
              style={styles.banButton}
              onPress={handleBanUser}
            >
              <Ionicons name="warning-outline" size={20} color="#ff0055" />
              <Text style={styles.banButtonText}>Ban User (Admin Only)</Text>
            </TouchableOpacity>
        )}
      </View>
      )}

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={id}
        reportedContent={`User profile`}
        contentType="User"
      />

      </ScrollView>
      
      {/* Badge Modal */}
      <BadgeModal
        visible={badgeModalVisible}
        badge={selectedBadge}
        onClose={() => {
          setBadgeModalVisible(false);
          setSelectedBadge(null);
        }}
        isOwnBadge={currentUserId === id}
        onSetAsDisplay={async (badgeId) => {
          const { error } = await supabase
            .rpc('set_displayed_badge', {
              p_user_id: currentUserId,
              p_badge_id: badgeId,
            });
          if (!error) {
            // Refresh badge
            const { data: profileData } = await supabase
              .from('profiles')
              .select(`
                *,
                badge_definitions:displayed_badge_id (
                  id,
                  badge_key,
                  name,
                  description,
                  how_to_earn,
                  icon_url
                )
              `)
              .eq('id', id)
              .single();
            if (profileData?.badge_definitions) {
              const { data: badgeData } = await supabase
                .from('user_badges')
                .select('earned_at, is_displayed')
                .eq('user_id', id)
                .eq('badge_id', profileData.badge_definitions.id)
                .single();
              setDisplayedBadge({
                ...profileData.badge_definitions,
                earned_at: badgeData?.earned_at || null,
                is_displayed: badgeData?.is_displayed || false,
              });
            }
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  profileCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  badgeOverlay: {
    position: 'absolute',
    bottom: -12,
    right: -12,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },
  avatar: {
    marginBottom: 8,
  },
  // Name container - matches profile.js layout
  nameContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  name: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 24,
    marginBottom: 4,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  username: {
    color: '#00ffff',
    fontSize: 16,
    marginBottom: 8,
    textAlign: 'center',
    opacity: 0.9,
  },
  fullName: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    opacity: 0.8,
    textAlign: 'center',
  },
  // Bio section - read-only display of user's bio
  bioSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  bioText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.9,
  },
  // Stats container - Age, Weight, Height cards
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  statCardValue: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statCardLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Section styles - for Fitness Profile section
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // Info card - container for fitness profile details
  infoCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  infoLabel: {
    color: '#999',
    fontSize: 12,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  bmiValue: {
    color: '#00ffff',
    fontWeight: 'bold',
  },
  bmiCategory: {
    color: '#999',
    fontSize: 14,
  },
  // Activity stats card - workouts, mental, runs summary
  activityStatsCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  activityStatsTitle: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  badgeSection: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  badgeSectionOld: {
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  streakSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 16,
    backgroundColor: 'rgba(255, 107, 53, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.1)',
  },
  streakLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    color: '#fff',
    fontSize: 12,
    marginTop: 2,
    opacity: 0.7,
  },
  goalSection: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  goalLabel: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  goalText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  spotifyTopTracksSection: {
    width: '100%',
    marginBottom: 20,
  },
  spotifyTopTracksCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
    gap: 14,
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
  },
  spotifyTopTracksList: {
    gap: 12,
  },
  spotifyTrackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
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
  section: {
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 2,
  },
  cardValue: {
    color: '#fff',
    fontSize: 14,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  seeAllButton: {
    backgroundColor: '#00ffff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  seeAllButtonText: {
    color: '#181b1f',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // View Activities Button - single button to show all activities
  viewActivitiesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    gap: 10,
  },
  viewActivitiesButtonText: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  // All Activities Container
  allActivitiesContainer: {
    marginBottom: 20,
  },
  activitySection: {
    marginBottom: 24,
  },
  activitySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  activitySectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  activityCount: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emptyActivities: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 16,
  },
  emptyActivitiesText: {
    color: '#666',
    fontSize: 16,
    marginTop: 12,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    gap: 8,
  },
  loadMoreText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  privateProfileNotice: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    paddingVertical: 30,
    paddingHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(136, 136, 136, 0.3)',
  },
  privateProfileText: {
    color: '#888',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
  },
  privateProfileSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  dangerZone: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(220, 53, 69, 0.2)',
  },
  dangerZoneTitle: {
    color: '#dc3545',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    padding: 10,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 53, 69, 0.2)',
  },
  blockButtonText: {
    color: '#dc3545',
    marginLeft: 8,
    fontWeight: '600',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    padding: 10,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(220, 53, 69, 0.2)',
  },
  reportButtonText: {
    color: '#dc3545',
    marginLeft: 8,
    fontWeight: '600',
  },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    padding: 10,
    borderRadius: 20,
    marginBottom: 16,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    justifyContent: 'center',
  },
  nudgeButtonDisabled: {
    opacity: 0.6,
  },
  nudgeButtonText: {
    color: '#00ffff',
    marginLeft: 8,
    fontWeight: '600',
  },
  banButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 85, 0.1)',
    padding: 10,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 85, 0.2)',
  },
  banButtonText: {
    color: '#ff0055',
    marginLeft: 8,
    fontWeight: '600',
  },
  premiumBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
  },
  bannedUserContainer: {
    backgroundColor: 'rgba(255, 0, 85, 0.1)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 85, 0.2)',
  },
  bannedIcon: {
    marginBottom: 15,
  },
  bannedTitle: {
    color: '#ff0055',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  bannedSubtitle: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  bannedMessage: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    lineHeight: 22,
  },
  bannedReasonContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  bannedReasonLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bannedReasonText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  bannedTimeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 10,
  },
  bannedTimeLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  bannedTimeText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  bannedWarningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 170, 0, 0.2)',
    marginTop: 10,
  },
  warningIcon: {
    marginRight: 8,
  },
  bannedWarning: {
    color: '#ffaa00',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  bannedNote: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 20,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  refreshButtonText: {
    color: '#00ffff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 14,
  },
});

export default FriendProfileScreen; 