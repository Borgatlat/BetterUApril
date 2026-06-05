/**
 * Feed Preloader Utility
 *
 * Preloads the Community feed when the app opens (top page of all activity
 * types, including events) so the feed is ready on first visit.
 */

import { DeviceEventEmitter } from 'react-native';
import {
  fetchCommunityFeedFirstPage,
  COMMUNITY_FEED_ITEMS_PER_PAGE,
} from './communityFeedLoader';

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
  hasMoreFeed: true,
};

export const getFeedCache = () => ({
  feedLoadedInSession,
  cachedFeedData,
});

export const setFeedLoaded = (loaded) => {
  feedLoadedInSession = loaded;
};

export const setCachedFeedData = (data) => {
  cachedFeedData = data;
};

export const clearFeedCache = () => {
  feedLoadedInSession = false;
  cachedFeedData = {
    feed: [],
    allFeedItems: [],
    profileMap: {},
    feedPage: 0,
    hasMoreFeed: true,
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
 * Preload feed data for a user (same top-N merge as Community tab, including events).
 */
export const preloadFeed = async (userId) => {
  if (feedLoadedInSession) {
    console.log('📰 Feed already preloaded, skipping...');
    return;
  }

  console.log('📰 Preloading feed for user:', userId);

  try {
    const page = await fetchCommunityFeedFirstPage(userId);
    const firstPage = page.feedItems.slice(0, COMMUNITY_FEED_ITEMS_PER_PAGE);

    feedLoadedInSession = true;
    cachedFeedData = {
      feed: firstPage,
      allFeedItems: page.feedItems,
      profileMap: page.profileMap,
      feedPage: 0,
      hasMoreFeed: page.hasMoreFeed,
    };

    console.log('✅ Feed preloaded successfully:', {
      totalItems: page.feedItems.length,
      itemsOnFirstPage: firstPage.length,
      events: firstPage.filter((i) => i.type === 'event').length,
    });
  } catch (error) {
    console.error('❌ Error preloading feed:', error);
    feedLoadedInSession = true;
  }
};
