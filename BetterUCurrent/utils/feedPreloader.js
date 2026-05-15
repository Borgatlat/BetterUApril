/**
 * Feed Preloader Utility
 * 
 * This utility preloads the feed data when the app opens, so users don't have to wait
 * when they navigate to the feed for the first time.
 */

import { DeviceEventEmitter } from 'react-native';
import { supabase } from '../lib/supabase';

/** Emitted when a new row is inserted into `events` so Community can refetch (AddEventModal, etc.). */
export const COMMUNITY_FEED_INVALIDATE_EVENT = 'betteru:communityFeedInvalidate';

let communityFeedNeedsRefresh = false;

/** Call when the `events` table changes so the next Community tab focus refetches the feed. */
export const markCommunityFeedNeedsRefresh = () => {
  communityFeedNeedsRefresh = true;
};

/** Returns true once per mark; used by Community useFocusEffect. */
export const consumeCommunityFeedNeedsRefresh = () => {
  const v = communityFeedNeedsRefresh;
  communityFeedNeedsRefresh = false;
  return v;
};

// Module-level cache for feed data (shared with Community component)
let feedLoadedInSession = false;
let cachedFeedData = {
  feed: [],
  allFeedItems: [],
  profileMap: {},
  feedPage: 0,
  hasMoreFeed: true
};

// Export functions to access/update the cache
export const getFeedCache = () => ({
  feedLoadedInSession,
  cachedFeedData
});

export const setFeedLoaded = (loaded) => {
  feedLoadedInSession = loaded;
};

export const setCachedFeedData = (data) => {
  cachedFeedData = data;
};

// Clear the feed cache (useful when blocking changes)
export const clearFeedCache = () => {
  feedLoadedInSession = false;
  cachedFeedData = {
    feed: [],
    allFeedItems: [],
    profileMap: {},
    feedPage: 0,
    hasMoreFeed: true
  };
  console.log('🗑️ Feed cache cleared');
};

/** Clears cached feed, marks refresh, and notifies listeners (Community tab may be mounted). */
export const notifyCommunityFeedUpdated = () => {
  markCommunityFeedNeedsRefresh();
  clearFeedCache();
  DeviceEventEmitter.emit(COMMUNITY_FEED_INVALIDATE_EVENT);
};

/**
 * Preload feed data for a user
 * This function can be called from anywhere (like UserContext) to preload the feed
 */
export const preloadFeed = async (userId) => {
  // If already loaded, don't reload
  if (feedLoadedInSession) {
    console.log('📰 Feed already preloaded, skipping...');
    return;
  }

  console.log('📰 Preloading feed for user:', userId);

  try {
    // Get all accepted friends' IDs
    const { data: accepted, error: acceptedError } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');
    
    if (acceptedError) throw acceptedError;
    
    const friendIds = (accepted || []).map(f => f.user_id === userId ? f.friend_id : f.user_id);
    
    // Filter out blocked users (both directions - users we blocked and users who blocked us)
    const { data: blockedByMe, error: blockedError } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);

    const { data: blockedMe, error: blockersError } = await supabase
      .from('blocks')
      .select('blocker_id')
      .eq('blocked_id', userId);

    // Combine all blocked user IDs
    const blockedIds = new Set();
    blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
    blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

    // Filter out blocked users from friend list
    const nonBlockedFriendIds = friendIds.filter(id => !blockedIds.has(id));
    
    const allUserIds = [...new Set([...nonBlockedFriendIds, userId])];

    if (allUserIds.length === 0) {
      feedLoadedInSession = true;
      cachedFeedData = {
        feed: [],
        allFeedItems: [],
        profileMap: {},
        feedPage: 0,
        hasMoreFeed: false
      };
      return;
    }

    // Fetch all profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, ban_status')
      .in('id', allUserIds);
    
    const newProfileMap = {};
    (profiles || []).forEach(p => { newProfileMap[p.id] = p; });

    // Filter out banned users
    const nonBannedUserIds = allUserIds.filter(userId => {
      const profile = newProfileMap[userId];
      return profile && !profile.ban_status;
    });

    // Fetch all activity types
    const [workoutsResult, mentalsResult, prsResult, runsResult] = await Promise.all([
      supabase
        .from('user_workout_logs')
        .select('*')
        .in('user_id', nonBannedUserIds)
        .order('completed_at', { ascending: false }),
      supabase
        .from('mental_session_logs')
        .select('*')
        .in('profile_id', nonBannedUserIds)
        .order('completed_at', { ascending: false }),
      supabase
        .from('personal_records')
        .select('*')
        .in('user_id', nonBannedUserIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('runs')
        .select('*')
        .in('user_id', nonBannedUserIds)
        .order('start_time', { ascending: false })
        .not('distance_meters', 'eq', 0)
    ]);

    const workouts = workoutsResult.data || [];
    const mentals = mentalsResult.data || [];
    const prs = prsResult.data || [];
    const runs = runsResult.data || [];

    // Fetch Spotify tracks for workouts
    const spotifyTrackMap = {};
    const sessionIds = workouts
      .map(w => w.workout_session_id)
      .filter(id => !!id);

    if (sessionIds.length > 0) {
      const { data: trackRows, error: trackError } = await supabase
        .from('workout_spotify_tracks')
        .select('workout_session_id, track_name, artist_name, album_name, album_image_url, played_at, track_id')
        .in('workout_session_id', sessionIds)
        .order('played_at', { ascending: true });

      if (trackError) {
        console.error('Error preloading workout Spotify tracks:', trackError);
      } else if (trackRows) {
        trackRows.forEach(row => {
          if (!spotifyTrackMap[row.workout_session_id]) {
            spotifyTrackMap[row.workout_session_id] = [];
          }
          spotifyTrackMap[row.workout_session_id].push({
            track_name: row.track_name,
            artist_name: row.artist_name,
            album_name: row.album_name,
            album_image_url: row.album_image_url,
            played_at: row.played_at,
            track_id: row.track_id
          });
        });
      }
    }

    // Fetch kudos and comments in parallel
    const kudosPromises = [];
    const commentsPromises = [];

    if (workouts.length > 0) {
      kudosPromises.push(
        supabase
          .from('workout_kudos')
          .select('*')
          .in('workout_id', workouts.map(w => w.id))
      );
      commentsPromises.push(
        supabase
          .from('workout_comments')
          .select('*')
          .in('workout_id', workouts.map(w => w.id))
      );
    } else {
      kudosPromises.push(Promise.resolve({ data: [] }));
      commentsPromises.push(Promise.resolve({ data: [] }));
    }

    if (mentals.length > 0) {
      kudosPromises.push(
        supabase
          .from('mental_session_kudos')
          .select('*')
          .in('session_id', mentals.map(m => m.id))
      );
      commentsPromises.push(
        supabase
          .from('mental_session_comments')
          .select('*')
          .in('session_id', mentals.map(m => m.id))
      );
    } else {
      kudosPromises.push(Promise.resolve({ data: [] }));
      commentsPromises.push(Promise.resolve({ data: [] }));
    }

    if (runs.length > 0) {
      kudosPromises.push(
        supabase
          .from('run_kudos')
          .select('*')
          .in('run_id', runs.map(r => r.id))
      );
      commentsPromises.push(
        supabase
          .from('run_comments')
          .select('*')
          .in('run_id', runs.map(r => r.id))
      );
    } else {
      kudosPromises.push(Promise.resolve({ data: [] }));
      commentsPromises.push(Promise.resolve({ data: [] }));
    }

    // Wait for all kudos and comments to load
    const [workoutKudosResult, mentalKudosResult, runKudosResult] = await Promise.all(kudosPromises);
    const [workoutCommentsResult, mentalCommentsResult, runCommentsResult] = await Promise.all(commentsPromises);

    const workoutKudos = workoutKudosResult.data || [];
    const mentalKudos = mentalKudosResult.data || [];
    const runKudos = runKudosResult.data || [];
    const workoutComments = workoutCommentsResult.data || [];
    const mentalComments = mentalCommentsResult.data || [];
    const runComments = runCommentsResult.data || [];

    // Create lookup maps for kudos and comments
    const kudosMap = {};
    const commentsMap = {};

    // Process workout kudos
    workoutKudos.forEach(k => {
      if (!kudosMap[k.workout_id]) kudosMap[k.workout_id] = [];
      kudosMap[k.workout_id].push(k);
    });

    // Process mental session kudos
    mentalKudos.forEach(k => {
      if (!kudosMap[k.session_id]) kudosMap[k.session_id] = [];
      kudosMap[k.session_id].push(k);
    });

    // Process run kudos
    runKudos.forEach(k => {
      if (!kudosMap[k.run_id]) kudosMap[k.run_id] = [];
      kudosMap[k.run_id].push(k);
    });

    // Process workout comments
    workoutComments.forEach(c => {
      if (!commentsMap[c.workout_id]) commentsMap[c.workout_id] = [];
      commentsMap[c.workout_id].push(c);
    });

    // Process mental session comments
    mentalComments.forEach(c => {
      if (!commentsMap[c.session_id]) commentsMap[c.session_id] = [];
      commentsMap[c.session_id].push(c);
    });

    // Process run comments
    runComments.forEach(c => {
      if (!commentsMap[c.run_id]) commentsMap[c.run_id] = [];
      commentsMap[c.run_id].push(c);
    });

    const feedItems = [];
    const seenActivities = new Map();
    const duplicateCheck = new Map();

    workouts.forEach(item => {
      const key = `workout_${item.id}`;
      const contentKey = `workout_${item.user_id}_${item.completed_at}_${item.workout_name}`;
      if (!seenActivities.has(key) && !duplicateCheck.has(contentKey)) {
        seenActivities.set(key, true);
        duplicateCheck.set(contentKey, true);
        const previewTracks = item.workout_session_id && spotifyTrackMap[item.workout_session_id]
          ? spotifyTrackMap[item.workout_session_id].slice(-3)
          : [];
        const trackCount = item.workout_session_id && spotifyTrackMap[item.workout_session_id]
          ? spotifyTrackMap[item.workout_session_id].length
          : 0;
        feedItems.push({
          ...item,
          type: 'workout',
          date: item.completed_at,
          user_id: item.user_id,
          kudos: kudosMap[item.id] || [],
          comments: commentsMap[item.id] || [],
          spotify_tracks_preview: previewTracks,
          spotify_track_count: trackCount,
          workout_session_id: item.workout_session_id
        });
      }
    });

    mentals.forEach(item => {
      const key = `mental_${item.id}`;
      const contentKey = `mental_${item.profile_id}_${item.completed_at}_${item.session_type}`;
      if (!seenActivities.has(key) && !duplicateCheck.has(contentKey)) {
        seenActivities.set(key, true);
        duplicateCheck.set(contentKey, true);
        feedItems.push({
          ...item,
          type: 'mental',
          date: item.completed_at,
          user_id: item.profile_id,
          kudos: kudosMap[item.id] || [],
          comments: commentsMap[item.id] || [],
        });
      }
    });

    prs.forEach(item => {
      const key = `pr_${item.id}`;
      const contentKey = `pr_${item.user_id}_${item.created_at}_${item.exercise_name}`;
      if (!seenActivities.has(key) && !duplicateCheck.has(contentKey)) {
        seenActivities.set(key, true);
        duplicateCheck.set(contentKey, true);
        feedItems.push({
          ...item,
          type: 'pr',
          date: item.created_at,
          user_id: item.user_id, // New PR table uses user_id directly
          kudos: [],
          comments: [],
        });
      }
    });

    runs.forEach(item => {
      const key = `run_${item.id}`;
      const timeKey = new Date(item.start_time).getTime();
      const roundedTime = Math.floor(timeKey / 10000) * 10000;
      const contentKey = `run_${item.user_id}_${roundedTime}_${item.activity_type}_${Math.round(item.distance_meters / 10) * 10}`;
      if (!seenActivities.has(key) && !duplicateCheck.has(contentKey)) {
        seenActivities.set(key, true);
        duplicateCheck.set(contentKey, true);
        feedItems.push({
          ...item,
          type: 'run',
          date: item.start_time,
          user_id: item.user_id,
          kudos: kudosMap[item.id] || [],
          comments: commentsMap[item.id] || [],
        });
      }
    });

    feedItems.sort((a, b) => new Date(b.date) - new Date(a.date));

    const ITEMS_PER_PAGE = 10;
    const firstPageItems = feedItems.slice(0, ITEMS_PER_PAGE);

    // Cache the feed data
    feedLoadedInSession = true;
    cachedFeedData = {
      feed: firstPageItems,
      allFeedItems: feedItems,
      profileMap: newProfileMap,
      feedPage: 0,
      hasMoreFeed: feedItems.length > ITEMS_PER_PAGE
    };

    console.log('✅ Feed preloaded successfully:', {
      totalItems: feedItems.length,
      itemsOnFirstPage: firstPageItems.length
    });
  } catch (error) {
    console.error('❌ Error preloading feed:', error);
    // Mark as loaded even on error to prevent retry loops
    feedLoadedInSession = true;
  }
};

