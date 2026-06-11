/**
 * Maps notification payloads (push tap or in-app row) to expo-router destinations.
 * Push data mirrors `createNotificationWithPush` — action_type/action_data may live
 * on the row or inside the JSON `data` column.
 */

function pickNavigateTarget(source) {
  if (!source) return null;

  if (source.action_type === 'navigate' && source.action_data?.screen) {
    return {
      pathname: source.action_data.screen,
      params: source.action_data.params,
    };
  }

  const nested = source.data || source;
  if (typeof nested === 'object' && nested.action_type === 'navigate' && nested.action_data?.screen) {
    return {
      pathname: nested.action_data.screen,
      params: nested.action_data.params,
    };
  }

  return null;
}

function targetFromType(type, data = {}) {
  switch (type) {
    case 'friend_request':
    case 'friend_request_accepted':
      return { pathname: '/(tabs)/community', params: { tab: 'friends' } };

    case 'like':
      if (data.item_id && !String(data.item_id).startsWith('test-')) {
        if (data.interaction === 'kudos') {
          return {
            pathname: '/(modals)/CommentsScreen',
            params: { activityId: data.item_id, activityType: data.item_type },
          };
        }
        return { pathname: `/activity/${data.item_id}` };
      }
      return { pathname: '/(tabs)/community', params: { tab: 'feed' } };

    case 'workout_share':
    case 'mental_session_share':
      return { pathname: '/(tabs)/community', params: { tab: 'feed' } };

    case 'group_invitation':
    case 'group_join_request':
    case 'group_activity':
      return { pathname: '/(tabs)/community', params: { tab: 'groups' } };

    case 'workout_reminder':
    case 'nudge_workout':
      return { pathname: '/(tabs)/workout', params: { tab: 'workout' } };

    case 'nudge_run':
      return { pathname: '/(tabs)/workout', params: { tab: 'run' } };

    case 'mental_reminder':
    case 'nudge_mental':
      return { pathname: '/(tabs)/mental' };

    case 'daily_reminder':
    case 'motivation_after_streak_failure':
      return { pathname: '/(tabs)/home', params: { showEasyMode: '1' } };

    case 'accountability_partner_request':
    case 'accountability_check_in_reminder':
    case 'accountability_check_in_received':
      return { pathname: '/accountability' };

    case 'team_join_request':
      if (data.team_id) {
        return { pathname: `/league/manage-team/${data.team_id}`, params: { tab: 'requests' } };
      }
      return { pathname: '/(tabs)/community', params: { tab: 'league' } };

    case 'team_join_request_accepted':
    case 'team_trophy_awarded':
      if (data.team_id) {
        return { pathname: `/league/team/${data.team_id}` };
      }
      return { pathname: '/(tabs)/community', params: { tab: 'league' } };

    case 'team_challenge_started':
    case 'challenge_invitation':
    case 'leaderboard_update':
    case 'community_challenge':
      return { pathname: '/(tabs)/community', params: { tab: 'league' } };

    case 'achievement':
    case 'personal_record':
    case 'streak_milestone':
      return { pathname: '/(tabs)/profile' };

    case 'app_message':
      return { pathname: '/(tabs)/home' };

    default:
      return null;
  }
}

/**
 * @param {object} payload Push content.data or a notifications table row
 */
export function resolveNotificationNavigation(payload) {
  const explicit = pickNavigateTarget(payload);
  if (explicit) return explicit;

  const type = payload?.type || payload?.data?.type;
  const data = typeof payload?.data === 'object' ? payload.data : payload;
  return targetFromType(type, data);
}

/** Navigate when a target exists; returns whether navigation ran. */
export function navigateFromNotification(router, payload) {
  const target = resolveNotificationNavigation(payload);
  if (!target?.pathname || !router?.push) return false;

  if (target.params && Object.keys(target.params).length > 0) {
    router.push({ pathname: target.pathname, params: target.params });
  } else {
    router.push(target.pathname);
  }
  return true;
}
