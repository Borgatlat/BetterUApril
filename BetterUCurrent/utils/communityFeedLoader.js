/**
 * Shared Community feed loader — fetches a small batch per activity type,
 * merges by date, and enriches the top N items (including events).
 * Used by feed preloader and Community tab initial load.
 */

import { supabase } from '../lib/supabase';

export const COMMUNITY_FEED_ITEMS_PER_PAGE = 10;
export const COMMUNITY_FEED_INITIAL_BATCH = 3;

/**
 * @param {string} userId - Current user's profile/auth id
 * @param {object} [options]
 * @param {number} [options.itemsPerPage=10]
 * @param {number} [options.itemsPerBatch=3]
 * @param {Date|null} [options.oldestDate] - For load-more: only items older than this
 */
export async function fetchCommunityFeedFirstPage(userId, options = {}) {
  const itemsPerPage = options.itemsPerPage ?? COMMUNITY_FEED_ITEMS_PER_PAGE;
  const itemsPerBatch = options.itemsPerBatch ?? COMMUNITY_FEED_INITIAL_BATCH;
  const oldestDate = options.oldestDate ?? null;

  const [friendsResult, blockedByMeResult, blockedMeResult] = await Promise.all([
    supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted'),
    supabase.from('blocks').select('blocked_id').eq('blocker_id', userId),
    supabase.from('blocks').select('blocker_id').eq('blocked_id', userId),
  ]);

  if (friendsResult.error) throw friendsResult.error;

  const friendIds = (friendsResult.data || []).map((f) =>
    f.user_id === userId ? f.friend_id : f.user_id
  );

  const blockedIds = new Set();
  blockedByMeResult.data?.forEach((block) => {
    if (block?.blocked_id) blockedIds.add(block.blocked_id);
  });
  blockedMeResult.data?.forEach((block) => {
    if (block?.blocker_id) blockedIds.add(block.blocker_id);
  });

  const nonBlockedFriendIds = friendIds.filter((id) => !blockedIds.has(id));
  const allUserIds = [...new Set([...nonBlockedFriendIds, userId])];

  if (allUserIds.length === 0) {
    return {
      feedItems: [],
      profileMap: {},
      hasMoreFeed: false,
      gotFullBatch: false,
      oldestFeedDate: null,
    };
  }

  const prBatchLimit = Math.floor(itemsPerBatch / 2);

  const queryWithDate = (table, column, userColumn, userIds) => {
    if (oldestDate) {
      return supabase
        .from(table)
        .select('*')
        .in(userColumn, userIds)
        .lt(column, oldestDate.toISOString())
        .order(column, { ascending: false })
        .limit(itemsPerBatch);
    }
    return supabase
      .from(table)
      .select('*')
      .in(userColumn, userIds)
      .order(column, { ascending: false })
      .limit(itemsPerBatch);
  };

  const bondPurchasesBase = supabase
    .from('user_bonds')
    .select('*')
    .in('user_id', allUserIds)
    .eq('status', 'active')
    .order('purchased_at', { ascending: false })
    .limit(itemsPerBatch);
  const bondPurchasesQuery = oldestDate
    ? bondPurchasesBase.lt('purchased_at', oldestDate.toISOString())
    : bondPurchasesBase;

  const bondWithdrawalsBase = supabase
    .from('user_bonds')
    .select('*')
    .in('user_id', allUserIds)
    .eq('status', 'withdrawn')
    .not('withdrawn_at', 'is', null)
    .order('withdrawn_at', { ascending: false })
    .limit(itemsPerBatch);
  const bondWithdrawalsQuery = oldestDate
    ? bondWithdrawalsBase.lt('withdrawn_at', oldestDate.toISOString())
    : bondWithdrawalsBase;

  const [profilesResult, workoutsResult, mentalsResult, prsResult, runsResult, eventsResult, bondsPurchasesResult, bondsWithdrawalsResult] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, ban_status')
        .in('id', allUserIds),
      queryWithDate('user_workout_logs', 'completed_at', 'user_id', allUserIds),
      queryWithDate('mental_session_logs', 'completed_at', 'profile_id', allUserIds),
      oldestDate
        ? supabase
            .from('personal_records')
            .select('*')
            .in('user_id', allUserIds)
            .lt('created_at', oldestDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(prBatchLimit)
        : supabase
            .from('personal_records')
            .select('*')
            .in('user_id', allUserIds)
            .order('created_at', { ascending: false })
            .limit(prBatchLimit),
      queryWithDate('runs', 'start_time', 'user_id', allUserIds),
      oldestDate
        ? supabase
            .from('events')
            .select('*')
            .in('creator_id', allUserIds)
            .lt('created_at', oldestDate.toISOString())
            .order('created_at', { ascending: false })
            .limit(itemsPerBatch)
        : supabase
            .from('events')
            .select('*')
            .in('creator_id', allUserIds)
            .order('created_at', { ascending: false })
            .limit(itemsPerBatch),
      bondPurchasesQuery,
      bondWithdrawalsQuery,
    ]);

  if (workoutsResult.error) throw workoutsResult.error;

  const profiles = profilesResult.data || [];
  const workouts = workoutsResult.data || [];
  const mentals = mentalsResult.data || [];
  const prs = prsResult.data || [];
  const runs = runsResult.data || [];
  const events = eventsResult?.data || [];
  const bondPurchases = bondsPurchasesResult?.data || [];
  const bondWithdrawals = bondsWithdrawalsResult?.data || [];

  const gotFullBatch =
    workouts.length === itemsPerBatch ||
    mentals.length === itemsPerBatch ||
    prs.length === prBatchLimit ||
    runs.length === itemsPerBatch ||
    events.length === itemsPerBatch ||
    bondPurchases.length === itemsPerBatch ||
    bondWithdrawals.length === itemsPerBatch;

  const profileMap = {};
  profiles.forEach((p) => {
    profileMap[p.id] = p;
  });

  const filteredWorkouts = workouts.filter((w) => !blockedIds.has(w.user_id));
  const filteredMentals = mentals.filter((m) => !blockedIds.has(m.profile_id));
  const filteredPRs = prs.filter((p) => !blockedIds.has(p.user_id));
  const filteredRuns = runs.filter((r) => !blockedIds.has(r.user_id));
  const filteredEvents = events.filter((e) => !blockedIds.has(e.creator_id));
  const filteredBondPurchases = bondPurchases.filter((b) => !blockedIds.has(b.user_id));
  const filteredBondWithdrawals = bondWithdrawals.filter((b) => !blockedIds.has(b.user_id));

  let allActivities = [];

  filteredWorkouts.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'workout',
      date: item.completed_at,
      user_id: item.user_id,
    });
  });

  filteredMentals.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'mental',
      date: item.completed_at,
      user_id: item.profile_id,
    });
  });

  filteredPRs.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'pr',
      date: item.created_at,
      user_id: item.user_id,
    });
  });

  filteredRuns.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'run',
      date: item.start_time,
      user_id: item.user_id,
    });
  });

  filteredEvents.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'event',
      date: item.created_at,
      user_id: item.creator_id,
    });
  });

  filteredBondPurchases.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'bond_purchased',
      date: item.purchased_at,
      user_id: item.user_id,
    });
  });

  filteredBondWithdrawals.forEach((item) => {
    allActivities.push({
      ...item,
      type: 'bond_withdrawn',
      date: item.withdrawn_at,
      user_id: item.user_id,
    });
  });

  allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
  const topActivities = allActivities.slice(0, itemsPerPage);

  const topWorkoutIds = topActivities.filter((a) => a.type === 'workout').map((a) => a.id);
  const topMentalIds = topActivities.filter((a) => a.type === 'mental').map((a) => a.id);
  const topRunIds = topActivities.filter((a) => a.type === 'run').map((a) => a.id);
  const topEventIds = topActivities.filter((a) => a.type === 'event').map((a) => a.id);
  const topWorkoutSessionIds = topActivities
    .filter((a) => a.type === 'workout' && a.workout_session_id)
    .map((a) => a.workout_session_id);

  let eventIdsUserJoined = new Set();
  const eventAttendeesByEvent = {};

  if (topEventIds.length > 0 && userId) {
    try {
      const { data: myAttendeeRows } = await supabase
        .from('event_attendees')
        .select('event_id')
        .in('event_id', topEventIds)
        .eq('user_id', userId);

      if (myAttendeeRows?.length > 0) {
        myAttendeeRows.forEach((row) => eventIdsUserJoined.add(row.event_id));
      }

      if (nonBlockedFriendIds.length > 0) {
        const { data: allAttendeeRows } = await supabase
          .from('event_attendees')
          .select('event_id, user_id')
          .in('event_id', topEventIds);

        if (allAttendeeRows?.length > 0) {
          const friendIdSet = new Set(nonBlockedFriendIds);
          const attendeeUserIds = [
            ...new Set(allAttendeeRows.map((r) => r.user_id).filter((id) => friendIdSet.has(id))),
          ];

          if (attendeeUserIds.length > 0) {
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('id, avatar_url')
              .in('id', attendeeUserIds);

            const avatarByUserId = {};
            (profilesData || []).forEach((p) => {
              avatarByUserId[p.id] = p.avatar_url;
            });

            allAttendeeRows.forEach((row) => {
              if (!friendIdSet.has(row.user_id)) return;
              if (!eventAttendeesByEvent[row.event_id]) eventAttendeesByEvent[row.event_id] = [];
              eventAttendeesByEvent[row.event_id].push({
                user_id: row.user_id,
                avatar_url: avatarByUserId[row.user_id] || null,
              });
            });
          }
        }
      }
    } catch {
      // event_attendees may not exist yet
    }
  }

  const extraDataPromises = [];

  if (topWorkoutSessionIds.length > 0) {
    extraDataPromises.push(
      supabase
        .from('workout_spotify_tracks')
        .select(
          'workout_session_id, track_name, artist_name, album_name, album_image_url, played_at, track_id'
        )
        .in('workout_session_id', topWorkoutSessionIds)
        .order('played_at', { ascending: true })
        .then((result) => ({ type: 'spotify', data: result.data || [] }))
    );
  } else {
    extraDataPromises.push(Promise.resolve({ type: 'spotify', data: [] }));
  }

  if (topWorkoutIds.length > 0) {
    extraDataPromises.push(
      supabase
        .from('workout_comments')
        .select('*')
        .in('workout_id', topWorkoutIds)
        .then((result) => ({ type: 'workout_comments', data: result.data || [] }))
    );
    extraDataPromises.push(
      supabase
        .from('workout_kudos')
        .select('workout_id, user_id, created_at')
        .in('workout_id', topWorkoutIds)
        .then((result) => ({ type: 'workout_kudos', data: result.data || [] }))
    );
  } else {
    extraDataPromises.push(
      Promise.resolve({ type: 'workout_comments', data: [] }),
      Promise.resolve({ type: 'workout_kudos', data: [] })
    );
  }

  if (topMentalIds.length > 0) {
    extraDataPromises.push(
      supabase
        .from('mental_session_comments')
        .select('*')
        .in('session_id', topMentalIds)
        .then((result) => ({ type: 'mental_comments', data: result.data || [] }))
    );
    extraDataPromises.push(
      supabase
        .from('mental_session_kudos')
        .select('session_id, user_id, created_at')
        .in('session_id', topMentalIds)
        .then((result) => ({ type: 'mental_kudos', data: result.data || [] }))
    );
  } else {
    extraDataPromises.push(
      Promise.resolve({ type: 'mental_comments', data: [] }),
      Promise.resolve({ type: 'mental_kudos', data: [] })
    );
  }

  if (topRunIds.length > 0) {
    extraDataPromises.push(
      supabase
        .from('run_comments')
        .select('*')
        .in('run_id', topRunIds)
        .then((result) => ({ type: 'run_comments', data: result.data || [] }))
    );
    extraDataPromises.push(
      supabase
        .from('run_kudos')
        .select('run_id, user_id, created_at')
        .in('run_id', topRunIds)
        .then((result) => ({ type: 'run_kudos', data: result.data || [] }))
    );
  } else {
    extraDataPromises.push(
      Promise.resolve({ type: 'run_comments', data: [] }),
      Promise.resolve({ type: 'run_kudos', data: [] })
    );
  }

  const extraDataResults = await Promise.all(extraDataPromises);

  const spotifyTrackMap = {};
  const commentsMap = {};
  const workoutKudosMap = {};
  const mentalKudosMap = {};
  const runKudosMap = {};

  extraDataResults.forEach((result) => {
    if (result.type === 'spotify' && result.data) {
      result.data.forEach((row) => {
        if (!spotifyTrackMap[row.workout_session_id]) spotifyTrackMap[row.workout_session_id] = [];
        spotifyTrackMap[row.workout_session_id].push({
          track_name: row.track_name,
          artist_name: row.artist_name,
          album_name: row.album_name,
          album_image_url: row.album_image_url,
          played_at: row.played_at,
          track_id: row.track_id,
        });
      });
    } else if (result.type === 'workout_comments' && result.data) {
      result.data.forEach((c) => {
        if (!commentsMap[c.workout_id]) commentsMap[c.workout_id] = [];
        commentsMap[c.workout_id].push(c);
      });
    } else if (result.type === 'mental_comments' && result.data) {
      result.data.forEach((c) => {
        if (!commentsMap[c.session_id]) commentsMap[c.session_id] = [];
        commentsMap[c.session_id].push(c);
      });
    } else if (result.type === 'run_comments' && result.data) {
      result.data.forEach((c) => {
        if (!commentsMap[c.run_id]) commentsMap[c.run_id] = [];
        commentsMap[c.run_id].push(c);
      });
    } else if (result.type === 'workout_kudos' && result.data) {
      result.data.forEach((k) => {
        if (!workoutKudosMap[k.workout_id]) workoutKudosMap[k.workout_id] = [];
        workoutKudosMap[k.workout_id].push(k);
      });
    } else if (result.type === 'mental_kudos' && result.data) {
      result.data.forEach((k) => {
        if (!mentalKudosMap[k.session_id]) mentalKudosMap[k.session_id] = [];
        mentalKudosMap[k.session_id].push(k);
      });
    } else if (result.type === 'run_kudos' && result.data) {
      result.data.forEach((k) => {
        if (!runKudosMap[k.run_id]) runKudosMap[k.run_id] = [];
        runKudosMap[k.run_id].push(k);
      });
    }
  });

  const feedItems = topActivities.map((activity) => {
    if (activity.type === 'workout') {
      return {
        ...activity,
        comments: commentsMap[activity.id] || [],
        kudos: workoutKudosMap[activity.id] || [],
        workout_session_id: activity.workout_session_id,
        spotify_tracks_preview:
          activity.workout_session_id && spotifyTrackMap[activity.workout_session_id]
            ? spotifyTrackMap[activity.workout_session_id].slice(-3)
            : [],
        spotify_track_count:
          activity.workout_session_id && spotifyTrackMap[activity.workout_session_id]
            ? spotifyTrackMap[activity.workout_session_id].length
            : 0,
      };
    }
    if (activity.type === 'mental') {
      return {
        ...activity,
        comments: commentsMap[activity.id] || [],
        kudos: mentalKudosMap[activity.id] || [],
      };
    }
    if (activity.type === 'run') {
      return {
        ...activity,
        comments: commentsMap[activity.id] || [],
        kudos: runKudosMap[activity.id] || [],
      };
    }
    if (activity.type === 'event') {
      return {
        ...activity,
        comments: [],
        isEventJoined: eventIdsUserJoined.has(activity.id),
        attendeesWhoAreFriends: eventAttendeesByEvent[activity.id] || [],
      };
    }
    if (activity.type === 'bond_purchased' || activity.type === 'bond_withdrawn') {
      return { ...activity, comments: [], kudos: [] };
    }
    return { ...activity, comments: [] };
  });

  let oldestFeedDate = null;
  if (feedItems.length > 0) {
    oldestFeedDate = feedItems.reduce((oldest, item) => {
      const itemDate = new Date(item.date);
      return itemDate < oldest ? itemDate : oldest;
    }, new Date());
  }

  const hasMoreFeed = feedItems.length > itemsPerPage || gotFullBatch;

  return {
    feedItems,
    profileMap,
    hasMoreFeed,
    gotFullBatch,
    oldestFeedDate,
  };
}
