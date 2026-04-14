import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, Alert, ScrollView, Share, Platform, DeviceEventEmitter } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { createFriendRequestAcceptedNotification, createLikeNotification } from '../../utils/notificationHelpers';
import { useUnits } from '../../context/UnitsContext';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import LeagueContent from '../../components/LeagueContent';
import { presentPremiumPaywall } from '../../lib/purchases';
import { Ionicons } from '@expo/vector-icons';
import FeedCard from '../components/FeedCard';
import * as ImagePicker from 'expo-image-picker';
import { PremiumAvatar } from '../components/PremiumAvatar';
import { GroupAvatar } from '../components/GroupAvatar';
import {
  getFeedCache,
  setFeedLoaded,
  setCachedFeedData,
  clearFeedCache,
  COMMUNITY_FEED_INVALIDATE_EVENT,
  consumeCommunityFeedNeedsRefresh,
} from '../../utils/feedPreloader';
import GroupList from '../../components/GroupList';
import AddEventModal from '../(modals)/AddEventModal';
import { COMMUNITY_THEME } from '../../config/communityTheme';

/** Design tokens for Community styles — same object everywhere so the screen matches Feed/League. */
const T = COMMUNITY_THEME;
const toNumeric = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveDurationSeconds = (secondsValue, fallbackValue, fallbackUnit = 'seconds') => {
  const seconds = toNumeric(secondsValue);
  if (seconds && seconds > 0) return seconds;

  const fallback = toNumeric(fallbackValue);
  if (fallback && fallback > 0) {
    return fallbackUnit === 'minutes' ? fallback * 60 : fallback;
  }

  return null;
};

const formatDurationSeconds = (value) => {
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
};

// Feed filter: post types for filterPostByType
const PostType = {
  ALL: 'all',
  WORKOUT: 'workout',
  MENTAL: 'mental',
  RUN: 'run',
  PR: 'pr',
  EVENT: 'event'
};

const CommunityScreen = () => {
  const { userProfile, isPremium } = useUser();
  const { useImperial } = useUnits();
  // Inner views: feed | friends (header) | groups | league (League pill — embeds LeagueContent)
  const [activeTab, setActiveTab] = useState('feed');
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);
  const [requesting, setRequesting] = useState({}); // { [userId]: true/false }
  const [friendships, setFriendships] = useState([]); // all friendships for current user
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [feed, setFeed] = useState([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [initialFeedLoading, setInitialFeedLoading] = useState(true); // Separate state for initial load only
  const [feedPage, setFeedPage] = useState(0); // Add pagination state
  const [hasMoreFeed, setHasMoreFeed] = useState(true); // Track if more data exists
  const [loadingMore, setLoadingMore] = useState(false); // Loading state for "Load More"
  const [allFeedItems, setAllFeedItems] = useState([]); // Store all items for pagination
  const oldestFeedDateRef = useRef(null); // Track the oldest date we've loaded for "Load More"
  const ITEMS_PER_PAGE = 10; // Number of items to show per page
  const [profileMap, setProfileMap] = useState({});
  const debounceRef = useRef();
  const feedLoadedRef = useRef(false); // Track if feed has been loaded in this session
  const router = useRouter();
  const params = useLocalSearchParams();
  const [refreshing, setRefreshing] = useState(false);
  // Add new state for groups
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [groupAvatar, setGroupAvatar] = useState(null);
  const [isPublic, setIsPublic] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [activeFeedFilter, setActiveFeedFilter] = useState(PostType.ALL);
  const [kudosGivenThisWeek, setKudosGivenThisWeek] = useState(0);
  // One-time dismissible nudge at top of feed: "Your friends are active — share a workout or run?"
  const [showParticipationNudge, setShowParticipationNudge] = useState(true);
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    is_public: true,
    avatar_url: null
  });
  const [searching, setSearching] = useState(false);
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [unifiedQuery, setUnifiedQuery] = useState('');
  const [unifiedResults, setUnifiedResults] = useState([]);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const unifiedDebounceRef = useRef();

  useEffect(() => {
    const requestedTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    if (requestedTab && ['feed', 'friends', 'groups', 'league'].includes(requestedTab)) {
      setActiveTab(requestedTab);
    }
  }, [params.tab]);

  // Home "Find friends" passes openSearch=1 to open the discover modal once
  useEffect(() => {
    const raw = params.openSearch;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v === '1' || v === 1) {
      setShowSearchModal(true);
      try {
        router.setParams({ openSearch: undefined });
      } catch (_) {}
    }
  }, [params.openSearch, router]);

  // Add effect to handle refresh parameter
  useEffect(() => {
    if (params.refresh === 'true' && activeTab === 'groups') {
      fetchGroups();
    }
  }, [params.refresh]);



  // Cache feed data whenever it changes (for persistence across unmounts)
  useEffect(() => {
    // Only cache if feed has data (not empty)
    if (feed.length > 0 || allFeedItems.length > 0) {
      setCachedFeedData({
        feed: [...feed],
        allFeedItems: [...allFeedItems],
        profileMap: { ...profileMap },
        feedPage: feedPage,
        hasMoreFeed: hasMoreFeed
      });
    }
  }, [feed, allFeedItems, profileMap, feedPage, hasMoreFeed]);

  // Initial load of feed data (only once per app session when userProfile is available)
  // Uses shared cache from feedPreloader to persist across component unmounts/remounts
  // This ensures the feed only loads once on app launch and stays loaded
  // until the user manually refreshes via pull-to-refresh
  useEffect(() => {
    // Get the latest cache state from the preloader
    const { feedLoadedInSession: cacheLoaded, cachedFeedData: cacheData } = getFeedCache();
    
    // If feed already has data, mark as loaded immediately to prevent auto-loads
    if (feed.length > 0) {
      setFeedLoaded(true);
      setInitialFeedLoading(false);
      feedLoadedRef.current = true;
      return; // Don't load if we already have data
    }
    
    // If we have cached data from preloader or previous mount, restore it immediately
    // This ensures feed is visible right away when switching tabs
    // Mark as not loading immediately so feed shows while filtering happens in background
    if (cacheLoaded && cacheData.feed.length > 0 && userProfile?.id) {
      // Set initial loading to false immediately so feed shows while we filter
      setInitialFeedLoading(false);
      
      // Restore cache data immediately (before filtering) so feed appears instantly
      setFeed(cacheData.feed);
      setAllFeedItems(cacheData.allFeedItems);
      setProfileMap(cacheData.profileMap);
      setFeedPage(cacheData.feedPage);
      setHasMoreFeed(cacheData.hasMoreFeed);
      feedLoadedRef.current = true;
      
      // Then filter out blocked users in background (this is fast, but we show feed first)
      filterCachedFeed(userProfile.id, cacheData).then(filteredData => {
        // Only update if data actually changed (to avoid unnecessary re-renders)
        if (filteredData.feed.length !== cacheData.feed.length) {
          setFeed(filteredData.feed);
          setAllFeedItems(filteredData.allFeedItems);
          setProfileMap(filteredData.profileMap);
        }
      }).catch(() => {
        // If filtering fails, that's okay - we already showed the cached feed
        console.log('Cache filtering failed, but feed is already shown');
      });
      return; // Don't continue to auto-load if we're restoring from cache
    }
    
    // Only load if: userProfile exists, cache says not loaded, AND feed is empty
    // The shared cache persists across component unmounts/remounts and app lifecycle
    // This prevents reloading even if component remounts (state resets but cache persists)
    if (userProfile?.id && !cacheLoaded && !feedLoadedRef.current) {
      // Prevent duplicate fetches
      feedLoadedRef.current = true;
      fetchFeed().then(() => {
        setFeedLoaded(true); // Mark as loaded in shared cache (persists across unmounts)
        setInitialFeedLoading(false); // Mark initial load as complete
      }).catch(() => {
        // Even on error, mark as loaded to prevent infinite retry loops
        // User can manually refresh if needed
        setFeedLoaded(true);
        setInitialFeedLoading(false);
        feedLoadedRef.current = false; // Reset on error so user can retry
      });
    } else if (userProfile?.id && cacheLoaded && cacheData.feed.length === 0) {
      // Cache says loaded but feed is empty - mark initial loading as complete
      setInitialFeedLoading(false);
    } else if (!userProfile?.id) {
      // No user profile yet - reset the ref so it can load when userProfile is available
      feedLoadedRef.current = false;
    }
  }, [userProfile?.id]); // Only depend on userProfile, shared cache persists across unmounts

  // Support summary: count kudos given by current user in the last 7 days (for "You've given kudos to X posts this week.")
  useEffect(() => {
    if (!userProfile?.id) return;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString();
    const fetchKudosGiven = async () => {
      const [wRes, mRes, rRes] = await Promise.all([
        supabase.from('workout_kudos').select('id').eq('user_id', userProfile.id).gte('created_at', since),
        supabase.from('mental_session_kudos').select('id').eq('user_id', userProfile.id).gte('created_at', since),
        supabase.from('run_kudos').select('id').eq('user_id', userProfile.id).gte('created_at', since),
      ]);
      const total = (wRes.data?.length ?? 0) + (mRes.data?.length ?? 0) + (rRes.data?.length ?? 0);
      setKudosGivenThisWeek(total);
    };
    fetchKudosGiven();
  }, [userProfile?.id]);

  // Fetch all friendships for current user (for Find Friends logic)
  const fetchAllFriendships = async () => {
    if (!userProfile?.id) return;
    const { data, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id})`);
    if (!error) setFriendships(data || []);
  };

  const inviteFriends = async () => {
    try {
      await Share.share({
        message: 'Join me on BetterU!',
        url: 'https://betteru.app/invite',
      })
    } catch (error) {
      console.error('Error inviting friends:', error);
      Alert.alert('Error', 'Failed to invite friends. Please try again.');
    }
  };
  const createEvent = async () => {
    setShowCreateEventModal(true);
  
  }
  // Fetch accepted friends and incoming/outgoing requests
  const fetchFriendsAndRequests = async () => {
    setFriendsLoading(true);
    try {
      // Get blocked users (both directions)
      const { data: blockedByMe, error: blockedError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userProfile.id);

      const { data: blockedMe, error: blockersError } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', userProfile.id);

      // Combine all blocked user IDs
      const blockedIds = new Set();
      blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
      blockedMe?.forEach(block => blockedIds.add(block.blocker_id));
      // Accepted friends (status = 'accepted', either direction)
      const { data: accepted, error: acceptedError } = await supabase
        .from('friends')
        .select(`
          *,
          friend:friend_id (
            id,
            username,
            avatar_url,
            is_premium
          ),
          user:user_id (
            id,
            username,
            avatar_url,
            is_premium
          )
        `)
        .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
        .eq('status', 'accepted');
      if (acceptedError) throw acceptedError;
      
      // Get the other user's id (show all accepted friendships regardless of direction)
      // Include friendship_id so we can remove friends
      const friendMap = new Map();
      (accepted || []).forEach(f => {
        const friendId = f.user_id === userProfile.id ? f.friend_id : f.user_id;
        if (!friendMap.has(friendId)) {
          friendMap.set(friendId, {
            friendship_id: f.id,
            friend_id: friendId
          });
        }
      });
      
    
      
      const friendIds = Array.from(friendMap.keys());
      const friendIdsSet = new Set(friendIds);
      // Filter out blocked users from friends list
      const nonBlockedFriendIds = friendIds.filter(id => !blockedIds.has(id));
      
      let profiles = [];
      if (nonBlockedFriendIds.length > 0) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_premium, full_name')
          .in('id', nonBlockedFriendIds);
        if (profileError) throw profileError;
        // Add friendship_id to each profile
        profiles = (profileData || []).map(profile => ({
          ...profile,
          friendship_id: friendMap.get(profile.id)?.friendship_id
        }));
      }
      setFriends(profiles);

      // Incoming requests (status = 'pending', friend_id = current user)
      const { data: requests, error: reqError } = await supabase
        .from('friends')
        .select(`
          id,
          user_id,
          user:user_id (
            id,
            username,
            avatar_url,
            is_premium
          )
        `)
        .eq('friend_id', userProfile.id)
        .eq('status', 'pending');

      if (reqError) throw reqError;

      // Transform the data to include profile info
      const requestProfiles = requests?.map(r => ({
        ...r.user,
        friendship_id: r.id
      })) || [];

      // Filter out any pending requests from users who are already friends
      // This prevents showing duplicate entries if someone is both a friend and has a pending request
      const filteredRequestProfiles = requestProfiles.filter(req => 
        !friendIdsSet.has(req.id)
      );

      setFriendRequests(filteredRequestProfiles);

      // Outgoing requests (status = 'pending', user_id = current user)
      const { data: outgoing, error: outError } = await supabase
        .from('friends')
        .select(`
          id,
          friend_id,
          friend:friend_id (
            id,
            username,
            avatar_url,
            is_premium
          )
        `)
        .eq('user_id', userProfile.id)
        .eq('status', 'pending');

      if (outError) throw outError;
 
      // Transform the data to include profile info
      const outgoingProfiles = outgoing?.map(r => ({
        ...r.friend,
        friendship_id: r.id
      })) || [];

      // Filter out any outgoing requests to users who are already friends (friendIds is an array — use the Set)
      const filteredOutgoingProfiles = outgoingProfiles.filter(req =>
        !friendIdsSet.has(req.id)
      );

      setOutgoingRequests(filteredOutgoingProfiles);
    } catch (e) {
      console.error('Error fetching friends and requests:', e);
      setFriends([]);
      setFriendRequests([]);
      setOutgoingRequests([]);
    } finally {
      setFriendsLoading(false);
    }
  };

  const sharePost = async (postId) => {
    try {
      await Share.share({
        message: 'Check out this post on BetterU',
        url: `https://betteru.app/post/${postId}`,
      });
    } catch (error) {
      console.error('Error sharing post:', error);
      Alert.alert('Error', 'Failed to share post. Please try again.');
    }
  };

  // Accept or decline a friend request
  const handleRequestAction = async (friendshipId, action) => {
    if (!friendshipId) return;
    
    try {
      if (action === 'accept') {
        // Get the friendship details to find who sent the request
        const { data: friendship, error: fetchError } = await supabase
          .from('friends')
          .select('user_id, friend_id')
          .eq('id', friendshipId)
          .single();

        if (fetchError) {
          console.error('Error fetching friendship:', fetchError);
        }

        await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendshipId);

        // Create notification for the person who sent the request
        if (friendship && friendship.user_id !== userProfile.id) {
          await createFriendRequestAcceptedNotification(
            friendship.user_id,
            userProfile.id,
            userProfile.full_name || userProfile.username
          );
        }
      } else if (action === 'decline') {
        await supabase.from('friends').update({ status: 'declined' }).eq('id', friendshipId);
      } else if (action === 'cancel') {
        await supabase.from('friends').delete().eq('id', friendshipId);
      }
      
      fetchFriendsAndRequests();
      fetchAllFriendships();
    } catch (error) {
      console.error('Error handling friend request:', error);
    }
  };

  // Add friend request
  const handleAddFriend = async (targetId) => {
    try {
      setRequesting(r => ({ ...r, [targetId]: true }));
      
      // Check if users are already friends (both directions)
      const { data: existingFriendships, error: checkError } = await supabase
        .from('friends')
        .select('*')
        .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`);

      if (checkError) throw checkError;

      // Find the friendship in either direction
      const existingFriendship = existingFriendships?.find(f => 
        (f.user_id === userProfile.id && f.friend_id === targetId) ||
        (f.user_id === targetId && f.friend_id === userProfile.id)
      );

      // Check if already friends
      if (existingFriendship?.status === 'accepted') {
        Alert.alert(
          "Already Friends",
          "You are already friends with this user."
        );
        setRequesting(r => ({ ...r, [targetId]: false }));
        return;
      }

      // Check if there's already a pending request
      if (existingFriendship?.status === 'pending') {
        Alert.alert(
          "Request Pending",
          existingFriendship.user_id === userProfile.id
            ? "You have already sent a friend request to this user."
            : "This user has already sent you a friend request. Please check your friend requests."
        );
        setRequesting(r => ({ ...r, [targetId]: false }));
        return;
      }

      // Create new friend request
      const { error } = await supabase
        .from('friends')
        .insert({ user_id: userProfile.id, friend_id: targetId, status: 'pending' });
      
      if (error) throw error;
      
      fetchAllFriendships();
    } catch (error) {
      console.error('Error sending friend request:', error);
      Alert.alert(
        "Error",
        error.message || "Failed to send friend request. Please try again."
      );
    } finally {
      setRequesting(r => ({ ...r, [targetId]: false }));
    }
  };

  // Check friendship status for a user (for Find Friends tab)
  const getFriendshipStatus = (targetId) => {
    const rel = friendships.find(f =>
      (f.user_id === userProfile.id && f.friend_id === targetId) ||
      (f.friend_id === userProfile.id && f.user_id === targetId)
    );
    if (!rel) return null;
    return rel.status;
  };

  // Get friendship_id for a friend
  const getFriendshipId = (targetId) => {
    const friend = friends.find(f => f.id === targetId);
    return friend?.friendship_id;
  };

  // Remove friend
  const handleRemoveFriend = async (friendId) => {
    const friendshipId = getFriendshipId(friendId);
    if (!friendshipId) {
      Alert.alert("Error", "Could not find friendship to remove.");
      return;
    }

    Alert.alert(
      "Remove Friend",
      "Are you sure you want to remove this friend?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('friends')
                .delete()
                .eq('id', friendshipId);

              if (error) throw error;

              // Refresh friends list
              fetchFriendsAndRequests();
              fetchAllFriendships();
            } catch (error) {
              console.error('Error removing friend:', error);
              Alert.alert(
                "Error",
                "Failed to remove friend. Please try again."
              );
            }
          }
        }
      ]
    );
  };

  const handleSearch = (text) => {
    setSearch(text);
    setSearchResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.length < 2) return;
    debounceRef.current = setTimeout(() => searchUsers(text), 400);
  };

  const searchUsers = async (text) => {
    setLoading(true);
    try {
      // First, get all blocked user IDs (both directions - users we blocked and users who blocked us)
      const { data: blockedByMe, error: blockedError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userProfile.id);

      const { data: blockedMe, error: blockersError } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', userProfile.id);

      // Combine all blocked user IDs
      const blockedIds = new Set();
      blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
      blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

      // Build the query
      let query = supabase
        .from('profiles')
        .select('id, username, avatar_url, is_premium')
        .ilike('username', `%${text}%`)
        .neq('id', userProfile.id);

      // Exclude blocked users from search results
      if (blockedIds.size > 0) {
        const blockedArray = Array.from(blockedIds);
        query = query.not('id', 'in', `(${blockedArray.map(id => `"${id}"`).join(',')})`);
      }

      const { data, error } = await query.limit(10);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const closeUnifiedSearchModal = () => {
    setShowSearchModal(false);
    setUnifiedQuery('');
    setUnifiedResults([]);
    setUnifiedLoading(false);
    if (unifiedDebounceRef.current) clearTimeout(unifiedDebounceRef.current);
  };

  /** Profiles + groups + teams for the full-screen Discover modal (query length >= 2). */
  const fetchUnifiedSearch = async (text) => {
    if (!userProfile?.id || !text || text.trim().length < 2) {
      setUnifiedResults([]);
      return;
    }
    const q = text.trim();
    setUnifiedLoading(true);
    try {
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', userProfile.id);
      const { data: blockedMe } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', userProfile.id);
      const blockedIds = new Set();
      blockedByMe?.forEach((b) => blockedIds.add(b.blocked_id));
      blockedMe?.forEach((b) => blockedIds.add(b.blocker_id));

      let profileQuery = supabase
        .from('profiles')
        .select('id, username, avatar_url, is_premium, full_name')
        .ilike('username', `%${q}%`)
        .neq('id', userProfile.id)
        .limit(8);
      if (blockedIds.size > 0) {
        const blockedArray = Array.from(blockedIds);
        profileQuery = profileQuery.not(
          'id',
          'in',
          `(${blockedArray.map((id) => `"${id}"`).join(',')})`
        );
      }
      const [profilesRes, groupsRes, teamsRes] = await Promise.all([
        profileQuery,
        supabase
          .from('groups')
          .select('id, name, avatar_url, description, is_public')
          .ilike('name', `%${q}%`)
          .limit(8),
        supabase
          .from('teams')
          .select('id, name, avatar_url, current_league, total_trophies')
          .ilike('name', `%${q}%`)
          .limit(8),
      ]);

      const profiles = (profilesRes.data || []).map((p) => ({ ...p, resultType: 'profile' }));
      const groups = (groupsRes.data || []).map((g) => ({ ...g, resultType: 'group' }));
      const teams = (teamsRes.data || []).map((t) => ({ ...t, resultType: 'team' }));
      setUnifiedResults([...teams, ...groups, ...profiles]);
    } catch (e) {
      console.error('Unified search error:', e);
      setUnifiedResults([]);
    } finally {
      setUnifiedLoading(false);
    }
  };

  const onUnifiedQueryChange = (text) => {
    setUnifiedQuery(text);
    if (unifiedDebounceRef.current) clearTimeout(unifiedDebounceRef.current);
    if (text.trim().length < 2) {
      setUnifiedResults([]);
      return;
    }
    unifiedDebounceRef.current = setTimeout(() => fetchUnifiedSearch(text), 400);
  };

  const renderResult = ({ item }) => {
    const displayName = item.full_name || item.username;
    const subtitle = `@${item.username}`;
    const isSelf = item.id === userProfile.id;
    const status = activeTab === 'friends' && !isSelf ? getFriendshipStatus(item.id) : null;

    const rightContent = (() => {
      if (activeTab === 'friends' && !isSelf) {
        if (status === 'accepted') {
          // Show remove button for friends in the "Your Friends" section
          const isInFriendsList = friends.some(f => f.id === item.id);
          if (isInFriendsList) {
            return (
              <TouchableOpacity
                style={styles.removeFriendButton}
                onPress={() => handleRemoveFriend(item.id)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={24} color="#ff0055" />
              </TouchableOpacity>
            );
          }
          return (
            <View style={[styles.statusPill, styles.statusPillSuccess]}>
              <Ionicons name="checkmark" size={12} color="#0f172a" />
              <Text style={styles.statusPillText}>Friends</Text>
            </View>
          );
        }
        if (status === 'pending') {
          return (
            <View style={[styles.statusPill, styles.statusPillPending, styles.requestActionsSpacing]}>
              <Ionicons name="time-outline" size={12} color="#fbbf24" />
              <Text style={[styles.statusPillText, { color: '#fbbf24' }]}>Awaiting</Text>
            </View>
          );
        }
        return (
          <TouchableOpacity
            style={styles.addFriendBtn}
            onPress={() => handleAddFriend(item.id)}
            disabled={!!requesting[item.id]}
          >
            <Ionicons name="person-add-outline" size={14} color="#0f172a" />
            <Text style={styles.addFriendBtnText}>
              {requesting[item.id] ? 'Requesting…' : 'Add Friend'}
            </Text>
          </TouchableOpacity>
        );
      }

      return <Ionicons name="chevron-forward" size={18} color="#94a3b8" />;
    })();

    return (
      <TouchableOpacity onPress={() => router.push(`/profile/${item.id}`)}>
        <View style={styles.resultRow}>
          <PremiumAvatar
            size={48}
            source={item.avatar_url ? { uri: item.avatar_url } : null}
            isPremium={item.is_premium}
            username={item.username}
            fullName={item.full_name}
            style={{ marginRight: 16 }}
          />
          <View style={styles.resultInfo}>
            <Text style={styles.resultName}>{displayName}</Text>
            <Text style={styles.resultSubtitle}>{subtitle}</Text>
          </View>
          {rightContent}
        </View>
      </TouchableOpacity>
    );
  };

  // Filter cached feed data to remove blocked users' activities
  const filterCachedFeed = async (currentUserId, cacheData) => {
    try {
      // Get blocked users (both directions)
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', currentUserId);

      const { data: blockedMe } = await supabase
        .from('blocks')
        .select('blocker_id')
        .eq('blocked_id', currentUserId);

      // Combine blocked user IDs
      const blockedIds = new Set();
      blockedByMe?.forEach(block => {
        if (block?.blocked_id) blockedIds.add(block.blocked_id);
      });
      blockedMe?.forEach(block => {
        if (block?.blocker_id) blockedIds.add(block.blocker_id);
      });

      console.log(`🔍 Filtering cached feed: ${blockedIds.size} blocked users`);

      // Filter out activities from blocked users
      const filteredItems = (cacheData.allFeedItems || []).filter(item => {
        const userId = item.user_id || item.profile_id;
        const isBlocked = blockedIds.has(userId);
        if (isBlocked) {
          console.log(`❌ Removing cached activity from blocked user: ${userId}`);
        }
        return !isBlocked;
      });

      // Update feed items to show (first page of filtered items)
      const ITEMS_PER_PAGE = 10;
      const filteredFeed = filteredItems.slice(0, ITEMS_PER_PAGE);

      return {
        ...cacheData,
        feed: filteredFeed,
        allFeedItems: filteredItems,
        hasMoreFeed: filteredItems.length > ITEMS_PER_PAGE
      };
    } catch (error) {
      console.error('Error filtering cached feed:', error);
      return cacheData; // Return original if filtering fails
    }
  };

  // Add Feed tab
  const fetchFeed = async (isLoadMore = false, isRefresh = false) => {
    // When refreshing, don't set feedLoading (which would hide the feed)
    // Only set feedLoading on initial load or load more
    if (isLoadMore) {
      setLoadingMore(true);
    } else if (!isRefresh) {
      // Only set feedLoading if not refreshing (refresh keeps feed visible)
      setFeedLoading(true);
      setFeedPage(0); // Reset to first page
    }
    
    try {
      const startTime = Date.now();
      
      // OPTIMIZATION: Run all initial queries in parallel for faster loading
      // Get friends, blocked users, and profiles all at once
      const [friendsResult, blockedByMeResult, blockedMeResult] = await Promise.all([
        // Get all accepted friends' IDs
        supabase
          .from('friends')
          .select('*')
          .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
          .eq('status', 'accepted'),
        
        // Users I have blocked
        supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', userProfile.id),
        
        // Users who blocked me
        supabase
          .from('blocks')
          .select('blocker_id')
          .eq('blocked_id', userProfile.id)
      ]);

      if (friendsResult.error) throw friendsResult.error;
      
      const friendIds = (friendsResult.data || []).map(f => f.user_id === userProfile.id ? f.friend_id : f.user_id);
      
      // Combine all blocked user IDs (both directions for mutual blocking)
      const blockedIds = new Set();
      blockedByMeResult.data?.forEach(block => {
        if (block?.blocked_id) blockedIds.add(block.blocked_id);
      });
      blockedMeResult.data?.forEach(block => {
        if (block?.blocker_id) blockedIds.add(block.blocker_id);
      });

      // Filter out blocked users from friend list
      const nonBlockedFriendIds = friendIds.filter(id => !blockedIds.has(id));
      
      // Include current user's ID in the list
      const allUserIds = [...new Set([...nonBlockedFriendIds, userProfile.id])];
    
      if (allUserIds.length === 0) {
        setFeed([]);
        setAllFeedItems([]);
        setHasMoreFeed(false);
        setFeedLoading(false);
        setLoadingMore(false);
        setProfileMap({});
        return;
      }

      // OPTIMIZATION: Fetch profiles and activities in parallel
      // Since activities are in separate tables, we fetch a small batch from each type,
      // combine them, sort by date, and take the first 10 total
      // For initial load: fetch just 3 items per type (3+3+3+2 = ~11 total, we take 10)
      // For "Load More": fetch 10 items per type (older than what we have)
      const ITEMS_PER_BATCH = isLoadMore ? 10 : 3; // Minimal initial batch (3 per type = ~11 total, we take exactly 10)
      
      // For "Load More", use the oldest date we've tracked
      // This ensures we fetch items older than what we've already loaded
      const oldestDate = isLoadMore && oldestFeedDateRef.current 
        ? oldestFeedDateRef.current 
        : null;

      const [profilesResult, workoutsResult, mentalsResult, prsResult, runsResult, eventsResult] = await Promise.all([
        // Fetch all profiles (including current user)
        supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, ban_status')
          .in('id', allUserIds),
        
        // Fetch workouts - if loading more, get items older than oldestDate
        oldestDate 
          ? supabase
              .from('user_workout_logs')
              .select('*')
              .in('user_id', allUserIds)
              .lt('completed_at', oldestDate.toISOString()) // Items older than oldest
              .order('completed_at', { ascending: false })
              .limit(ITEMS_PER_BATCH)
          : supabase
              .from('user_workout_logs')
              .select('*')
              .in('user_id', allUserIds)
              .order('completed_at', { ascending: false })
              .limit(ITEMS_PER_BATCH),
        
        // Fetch mental sessions
        oldestDate
          ? supabase
              .from('mental_session_logs')
              .select('*')
              .in('profile_id', allUserIds)
              .lt('completed_at', oldestDate.toISOString())
              .order('completed_at', { ascending: false })
              .limit(ITEMS_PER_BATCH)
          : supabase
              .from('mental_session_logs')
              .select('*')
              .in('profile_id', allUserIds)
              .order('completed_at', { ascending: false })
              .limit(ITEMS_PER_BATCH),
        
        // Fetch PRs
        oldestDate
          ? supabase
              .from('personal_records')
              .select('*')
              .in('user_id', allUserIds)
              .lt('created_at', oldestDate.toISOString())
              .order('created_at', { ascending: false })
              .limit(Math.floor(ITEMS_PER_BATCH / 2)) // Half for PRs
          : supabase
              .from('personal_records')
              .select('*')
              .in('user_id', allUserIds)
              .order('created_at', { ascending: false })
              .limit(Math.floor(ITEMS_PER_BATCH / 2)),
        
        // Fetch runs
        oldestDate
          ? supabase
              .from('runs')
              .select('*')
              .in('user_id', allUserIds)
              .lt('start_time', oldestDate.toISOString())
              .order('start_time', { ascending: false })
              .limit(ITEMS_PER_BATCH)
          : supabase
              .from('runs')
              .select('*')
              .in('user_id', allUserIds)
              .order('start_time', { ascending: false })
              .limit(ITEMS_PER_BATCH),
        
        // Fetch events (community feed events table)
        oldestDate
          ? supabase
              .from('events')
              .select('*')
              .in('creator_id', allUserIds)
              .lt('created_at', oldestDate.toISOString())
              .order('created_at', { ascending: false })
              .limit(ITEMS_PER_BATCH)
          : supabase
              .from('events')
              .select('*')
              .in('creator_id', allUserIds)
              .order('created_at', { ascending: false })
              .limit(ITEMS_PER_BATCH)
      ]);

      if (workoutsResult.error) throw workoutsResult.error;
      
      const profiles = profilesResult.data || [];
      const workouts = workoutsResult.data || [];
      const mentals = mentalsResult.data || [];
      const prs = prsResult.data || [];
      const runs = runsResult.data || [];
      const events = eventsResult?.data || [];
      
      // Track if we got the full batch (indicating there might be more data)
      // This helps us know if there are likely more items to load
      // Use the ITEMS_PER_BATCH that was already declared above
      const gotFullBatch = workouts.length === ITEMS_PER_BATCH || 
                          mentals.length === ITEMS_PER_BATCH || 
                          prs.length === Math.floor(ITEMS_PER_BATCH / 2) ||
                          runs.length === ITEMS_PER_BATCH ||
                          events.length === ITEMS_PER_BATCH;
      
      // Build profile map and filter out banned users
      const newProfileMap = {};
      profiles.forEach(p => { newProfileMap[p.id] = p; });
      setProfileMap(newProfileMap);
    
      // Filter out banned users
      const nonBannedUserIds = allUserIds.filter(userId => {
        const profile = newProfileMap[userId];
        return profile && !profile.ban_status;
      });

      // OPTIMIZATION: Filter out blocked users from activities immediately (use the blockedIds we already have)
      // No need to re-query blocks - we already have the data
      const filteredWorkouts = (workouts || []).filter(w => !blockedIds.has(w.user_id));
      const filteredMentals = (mentals || []).filter(m => !blockedIds.has(m.profile_id));
      const filteredPRs = (prs || []).filter(p => !blockedIds.has(p.user_id));
      const filteredRuns = (runs || []).filter(r => !blockedIds.has(r.user_id));
      const filteredEvents = (events || []).filter(e => !blockedIds.has(e.creator_id));
      
      // OPTIMIZATION: First, combine and sort all activities to find the top 10
      // Then fetch kudos/comments ONLY for those 10 (much faster!)
      let allActivities = [];
      
      filteredWorkouts.forEach(item => {
        allActivities.push({
          ...item, // Keep all original fields
          type: 'workout',
          date: item.completed_at,
          user_id: item.user_id,
        });
      });
      
      filteredMentals.forEach(item => {
        allActivities.push({
          ...item, // Keep all original fields
          type: 'mental',
          date: item.completed_at,
          user_id: item.profile_id,
        });
      });
      
      filteredPRs.forEach(item => {
        allActivities.push({
          ...item, // Keep all original fields
          type: 'pr',
          date: item.created_at,
          user_id: item.user_id,
        });
      });
      
      filteredRuns.forEach(item => {
        allActivities.push({
          ...item, // Keep all original fields
          type: 'run',
          date: item.start_time,
          user_id: item.user_id,
        });
      });
      
      filteredEvents.forEach(item => {
        allActivities.push({
          ...item,
          type: 'event',
          date: item.date ? new Date(item.date).toISOString() : item.created_at,
          user_id: item.creator_id,
        });
      });
      
      // Sort by date and get only the first 10 (or all if less than 10)
      allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
      const topActivities = allActivities.slice(0, ITEMS_PER_PAGE);
      
      // Now fetch kudos/comments/Spotify ONLY for the top 10 activities
      const topWorkoutIds = topActivities.filter(a => a.type === 'workout').map(a => a.id);
      const topMentalIds = topActivities.filter(a => a.type === 'mental').map(a => a.id);
      const topRunIds = topActivities.filter(a => a.type === 'run').map(a => a.id);
      const topEventIds = topActivities.filter(a => a.type === 'event').map(a => a.id);
      const topWorkoutSessionIds = topActivities
        .filter(a => a.type === 'workout' && a.workout_session_id)
        .map(a => a.workout_session_id);

      const kudosAndCommentsPromises = [];
      
      // Event attendees: (1) which events the current user joined (Join/Leave button), (2) which attendees are friends (show their avatars on the card).
      // We run two queries: first for current user's events, then for ALL attendees of those events; we filter attendees to nonBlockedFriendIds and fetch profiles to get avatar_url.
      let eventIdsUserJoined = new Set();
      const eventAttendeesByEvent = {}; // eventId -> [{ user_id, avatar_url }, ...], only friends
      if (topEventIds.length > 0 && userProfile?.id) {
        try {
          const { data: myAttendeeRows } = await supabase
            .from('event_attendees')
            .select('event_id')
            .in('event_id', topEventIds)
            .eq('user_id', userProfile.id);
          if (myAttendeeRows?.length > 0) {
            myAttendeeRows.forEach(row => eventIdsUserJoined.add(row.event_id));
          }
          if (nonBlockedFriendIds.length > 0) {
            const { data: allAttendeeRows } = await supabase
              .from('event_attendees')
              .select('event_id, user_id')
              .in('event_id', topEventIds);
            if (allAttendeeRows?.length > 0) {
              const friendIdSet = new Set(nonBlockedFriendIds);
              const attendeeUserIds = [...new Set(allAttendeeRows.map(r => r.user_id).filter(id => friendIdSet.has(id)))];
              if (attendeeUserIds.length > 0) {
                const { data: profilesData } = await supabase
                  .from('profiles')
                  .select('id, avatar_url')
                  .in('id', attendeeUserIds);
                const avatarByUserId = {};
                (profilesData || []).forEach(p => { avatarByUserId[p.id] = p.avatar_url; });
                allAttendeeRows.forEach(row => {
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
        } catch (_) {
          // event_attendees table may not exist yet
        }
      }
      
      // Spotify tracks (only for top 10 workouts)
      if (topWorkoutSessionIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('workout_spotify_tracks')
            .select('workout_session_id, track_name, artist_name, album_name, album_image_url, played_at, track_id')
            .in('workout_session_id', topWorkoutSessionIds)
            .order('played_at', { ascending: true })
            .then(result => ({ type: 'spotify', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'spotify', data: [] }));
      }

      // Fetch kudos ONLY for top 10
      if (topWorkoutIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('workout_kudos')
            .select('*')
            .in('workout_id', topWorkoutIds)
            .then(result => ({ type: 'workout_kudos', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'workout_kudos', data: [] }));
      }

      if (topMentalIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('mental_session_kudos')
            .select('*')
            .in('session_id', topMentalIds)
            .then(result => ({ type: 'mental_kudos', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'mental_kudos', data: [] }));
      }

      if (topRunIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('run_kudos')
            .select('*')
            .in('run_id', topRunIds)
            .then(result => ({ type: 'run_kudos', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'run_kudos', data: [] }));
      }

      // Fetch comments ONLY for top 10
      if (topWorkoutIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('workout_comments')
            .select('*')
            .in('workout_id', topWorkoutIds)
            .then(result => ({ type: 'workout_comments', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'workout_comments', data: [] }));
      }

      if (topMentalIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('mental_session_comments')
            .select('*')
            .in('session_id', topMentalIds)
            .then(result => ({ type: 'mental_comments', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'mental_comments', data: [] }));
      }

      if (topRunIds.length > 0) {
        kudosAndCommentsPromises.push(
          supabase
            .from('run_comments')
            .select('*')
            .in('run_id', topRunIds)
            .then(result => ({ type: 'run_comments', data: result.data || [], error: result.error }))
        );
      } else {
        kudosAndCommentsPromises.push(Promise.resolve({ type: 'run_comments', data: [] }));
      }

      // Wait for all kudos, comments, and Spotify tracks to load in parallel
      const kudosCommentsResults = await Promise.all(kudosAndCommentsPromises);
      
      // Process results
      let spotifyTrackMap = {};
      const kudosMap = {};
      const commentsMap = {};

      kudosCommentsResults.forEach(result => {
        if (result.type === 'spotify' && result.data) {
          result.data.forEach(row => {
            if (!spotifyTrackMap[row.workout_session_id]) {
              spotifyTrackMap[row.workout_session_id] = [];
            }
            spotifyTrackMap[row.workout_session_id].push({
              track_name: row.track_name,
              artist_name: row.artist_name,
              album_name: row.album_name,
              album_image_url: row.album_image_url,
              played_at: row.played_at
            });
          });
        } else if (result.type === 'workout_kudos' && result.data) {
          result.data.forEach(k => {
            if (!kudosMap[k.workout_id]) kudosMap[k.workout_id] = [];
            kudosMap[k.workout_id].push(k);
          });
        } else if (result.type === 'mental_kudos' && result.data) {
          result.data.forEach(k => {
            if (!kudosMap[k.session_id]) kudosMap[k.session_id] = [];
            kudosMap[k.session_id].push(k);
          });
        } else if (result.type === 'run_kudos' && result.data) {
          result.data.forEach(k => {
            if (!kudosMap[k.run_id]) kudosMap[k.run_id] = [];
            kudosMap[k.run_id].push(k);
          });
        } else if (result.type === 'workout_comments' && result.data) {
          result.data.forEach(c => {
            if (!commentsMap[c.workout_id]) commentsMap[c.workout_id] = [];
            commentsMap[c.workout_id].push(c);
          });
        } else if (result.type === 'mental_comments' && result.data) {
          result.data.forEach(c => {
            if (!commentsMap[c.session_id]) commentsMap[c.session_id] = [];
            commentsMap[c.session_id].push(c);
          });
        } else if (result.type === 'run_comments' && result.data) {
          result.data.forEach(c => {
            if (!commentsMap[c.run_id]) commentsMap[c.run_id] = [];
            commentsMap[c.run_id].push(c);
          });
        }
      });
      
      // Now attach kudos/comments/Spotify to the top 10 activities
      const feedItems = topActivities.map(activity => {
        if (activity.type === 'workout') {
          return {
            ...activity,
            kudos: kudosMap[activity.id] || [],
            comments: commentsMap[activity.id] || [],
            workout_session_id: activity.workout_session_id,
            spotify_tracks_preview: (activity.workout_session_id && spotifyTrackMap[activity.workout_session_id])
              ? spotifyTrackMap[activity.workout_session_id].slice(-3)
              : [],
            spotify_track_count: activity.workout_session_id && spotifyTrackMap[activity.workout_session_id]
              ? spotifyTrackMap[activity.workout_session_id].length
              : 0
          };
        } else if (activity.type === 'mental') {
          return {
            ...activity,
            kudos: kudosMap[activity.id] || [],
            comments: commentsMap[activity.id] || [],
          };
        } else if (activity.type === 'run') {
          return {
            ...activity,
            kudos: kudosMap[activity.id] || [],
            comments: commentsMap[activity.id] || [],
          };
        } else if (activity.type === 'event') {
          return {
            ...activity,
            kudos: [],
            comments: [],
            isEventJoined: eventIdsUserJoined.has(activity.id),
            attendeesWhoAreFriends: eventAttendeesByEvent[activity.id] || [],
          };
        } else { // PR
          return {
            ...activity,
            kudos: [],
            comments: [],
          };
        }
      });
      
      // Log performance timing
      const queryTime = Date.now() - startTime;
      console.log(`⚡ Feed loaded ${feedItems.length} activities in ${queryTime}ms`);
      
      // Update the oldest date we've loaded (for "Load More" to fetch older items)
      if (feedItems.length > 0) {
        const oldestItemDate = feedItems.reduce((oldest, item) => {
          const itemDate = new Date(item.date);
          return itemDate < oldest ? itemDate : oldest;
        }, new Date());
        oldestFeedDateRef.current = oldestItemDate;
      }
      
      // Log performance and stats
      const totalTime = Date.now() - startTime;
      console.log(`⚡ Feed loaded in ${totalTime}ms - ${feedItems.length} items (${filteredWorkouts.length} workouts, ${filteredMentals.length} mentals, ${filteredRuns.length} runs, ${filteredPRs.length} PRs, ${filteredEvents.length} events)`);
      
      // Store all items and update pagination
      if (isLoadMore) {
        // Append new items to existing ones, filtering out duplicates
        setAllFeedItems(prevItems => {
          // Create a Set of existing item IDs to quickly check for duplicates
          const existingIds = new Set(prevItems.map(item => {
            if (item.type === 'workout') return `workout_${item.id}`;
            if (item.type === 'mental') return `mental_${item.id}`;
            if (item.type === 'pr') return `pr_${item.id}`;
            if (item.type === 'run') return `run_${item.id}`;
            if (item.type === 'event') return `event_${item.id}`;
            return null;
          }).filter(Boolean));
          
          // Filter out items that already exist
          const newItems = feedItems.filter(item => {
            const itemId = item.type === 'workout' ? `workout_${item.id}` :
                          item.type === 'mental' ? `mental_${item.id}` :
                          item.type === 'pr' ? `pr_${item.id}` :
                          item.type === 'run' ? `run_${item.id}` :
                          item.type === 'event' ? `event_${item.id}` : null;
            return itemId && !existingIds.has(itemId);
          });
          
          const updatedItems = [...prevItems, ...newItems];
          // Re-sort by date after adding new items
          updatedItems.sort((a, b) => new Date(b.date) - new Date(a.date));
          
          // Show 10 more items (increment by ITEMS_PER_PAGE)
          const currentDisplayCount = feed.length;
          const newDisplayCount = currentDisplayCount + ITEMS_PER_PAGE;
          const itemsToShow = updatedItems.slice(0, newDisplayCount);
          setFeed(itemsToShow);
          
          // Show "Load More" if we got a full batch (indicating more might exist) or if we have more items
          setHasMoreFeed(gotFullBatch || newDisplayCount < updatedItems.length);
          return updatedItems;
        });
      } else {
        // Initial load: Store all fetched items, but show ONLY the first 10
        // We fetched a small batch (5 per type) to get exactly 10 activities
        setAllFeedItems(feedItems);
        const firstPageItems = feedItems.slice(0, ITEMS_PER_PAGE); // Only first 10
        setFeed(firstPageItems);
        
        // Show "Load More" if we have more than 10 items OR if we got a full batch (indicating more might exist)
        // Since we only fetch 5 per type initially, if we got 5 in any category, there's likely more
        setHasMoreFeed(feedItems.length > ITEMS_PER_PAGE || gotFullBatch);
      }
      
      // Update pagination state
      const newPage = isLoadMore ? feedPage + 1 : 0;
      setFeedPage(newPage);
      
    } catch (e) {
      console.error('Error fetching feed:', e);
      setFeed([]);
      setAllFeedItems([]);
      setHasMoreFeed(false);
      setProfileMap({});
    } finally {
      setFeedLoading(false);
      setLoadingMore(false);
    }
  };

  // Always points at latest fetchFeed (used by invalidation listeners below).
  const fetchFeedRef = useRef(fetchFeed);
  fetchFeedRef.current = fetchFeed;

  // Preload friends when Community is focused; refetch feed after volunteer / Add Event creates a row.
  useFocusEffect(
    React.useCallback(() => {
      if (userProfile?.id) {
        fetchFriendsAndRequests();
        fetchAllFriendships();
        if (consumeCommunityFeedNeedsRefresh()) {
          feedLoadedRef.current = false;
          setFeedLoaded(false);
          clearFeedCache();
          fetchFeedRef.current(false, true);
        }
      }
    }, [userProfile?.id])
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(COMMUNITY_FEED_INVALIDATE_EVENT, () => {
      if (!userProfile?.id) return;
      setFeedLoaded(false);
      feedLoadedRef.current = false;
      fetchFeedRef.current(false, true);
    });
    return () => sub.remove();
  }, [userProfile?.id]);

  // Add function to load more items
  const loadMoreFeed = async () => {
    if (!hasMoreFeed || loadingMore) return;
    
    // Check if we have more items in the already-loaded data (show next 10)
    const currentDisplayCount = feed.length;
    const nextDisplayCount = currentDisplayCount + ITEMS_PER_PAGE;
    
    if (nextDisplayCount <= allFeedItems.length) {
      // We have more items already loaded, just show the next 10
      const nextItems = allFeedItems.slice(0, nextDisplayCount);
      setFeed(nextItems);
      setHasMoreFeed(nextDisplayCount < allFeedItems.length);
    } else {
      // We've shown all loaded items, fetch more from database
      setLoadingMore(true);
      try {
        await fetchFeed(true, false); // isLoadMore=true, isRefresh=false
      } catch (error) {
        console.error('Error loading more feed:', error);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  // Add edit handlers
  const handleEditWorkout = (workoutId) => {
    router.push(`/edit-workout/${workoutId}`);
  };

  const handleEditMental = (sessionId) => {
    router.push(`/edit-mental/${sessionId}`);
  };

  const handleEditRun = (runId) => {
    router.push(`/edit-run/${runId}`);
  };

  // Event card: join/leave and update feed state so the button toggles
  const handleJoinEvent = async (eventId) => {
    if (!userProfile?.id) return;
    try {
      const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userProfile.id });
      if (error) throw error;
      setFeed(prev => prev.map(it => it.type === 'event' && it.id === eventId ? { ...it, isEventJoined: true } : it));
      setAllFeedItems(prev => prev.map(it => it.type === 'event' && it.id === eventId ? { ...it, isEventJoined: true } : it));
    } catch (e) {
      console.error('Error joining event:', e);
      Alert.alert('Error', 'Could not join event. Please try again.');
    }
  };
  const handleLeaveEvent = async (eventId) => {
    if (!userProfile?.id) return;
    try {
      const { error } = await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userProfile.id);
      if (error) throw error;
      setFeed(prev => prev.map(it => it.type === 'event' && it.id === eventId ? { ...it, isEventJoined: false } : it));
      setAllFeedItems(prev => prev.map(it => it.type === 'event' && it.id === eventId ? { ...it, isEventJoined: false } : it));
    } catch (e) {
      console.error('Error leaving event:', e);
      Alert.alert('Error', 'Could not leave event. Please try again.');
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    if (activeTab === 'feed') {
      // Occasionally run cleanup to prevent duplicates (every 10th refresh)
      const shouldCleanup = Math.random() < 0.1; // 10% chance
      if (shouldCleanup) {
        console.log('Running duplicate cleanup on refresh...');
        cleanupDuplicates();
      }
      // Pass isRefresh=true to keep feed visible during refresh
      fetchFeed(false, true).finally(() => setRefreshing(false));
    } else if (activeTab === 'friends') {
      fetchFriendsAndRequests().finally(() => setRefreshing(false));
    }
  }, [activeTab]);

  // Fetch user's groups
  const fetchGroups = async () => {
    setGroupsLoading(true);
    try {
      if (!userProfile?.id) return;

      // Get groups where user is a member
      const { data: memberGroups, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', userProfile.id);

      if (memberError) throw memberError;

      if (memberGroups && memberGroups.length > 0) {
        const groupIds = memberGroups.map(mg => mg.group_id);
      
        // Get groups with member counts
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select(`
            *,
            member_count:group_members(count)
          `)
          .in('id', groupIds)
          .order('created_at', { ascending: false });

        if (groupsError) throw groupsError;

        // Transform the data to get the actual count number
        const transformedGroups = groupsData?.map(group => ({
          ...group,
          member_count: group.member_count[0]?.count || 0
        })) || [];

        setGroups(transformedGroups);
      } else {
        setGroups([]);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
      setGroups([]);
    } finally {
      setGroupsLoading(false);
    }
  };

  // Create new group
  const handleCreateGroup = async () => {
    try {
      if (!userProfile?.id) {
        Alert.alert('Error', 'Please log in to create a group');
        return;
      }

      if (!newGroup.name || newGroup.name.length < 3) {
        Alert.alert('Error', 'Group name must be at least 3 characters long');
        return;
      }

      // Create the group - the trigger will automatically add the creator as owner
      const { data: group, error: groupError } = await supabase
        .from('groups')
        .insert({
          name: newGroup.name,
          description: newGroup.description,
          is_public: newGroup.is_public,
          avatar_url: newGroup.avatar_url,
          created_by: userProfile.id
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Refresh groups list
      await fetchGroups();
    
      // Close modal and reset form
      setShowCreateGroupModal(false);
      setNewGroup({
        name: '',
        description: '',
        is_public: true,
        avatar_url: null
      });

      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'View Group',
          onPress: () => router.push(`/group/${group.id}`)
        }
      ]);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group. Please try again.');
    }
  };

  // Join group
  const handleJoinGroup = async (groupId) => {
    try {
      if (!userProfile?.id) {
        Alert.alert('Error', 'Please log in to join a group');
        return;
      }

      // Check for blocked users in the group before joining
      const { data: groupMembers, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', groupId);

      if (membersError) {
        console.error('Error fetching group members:', membersError);
      } else if (groupMembers && groupMembers.length > 0) {
        // Get blocked users (both directions)
        const { data: blockedByMe, error: blockedError } = await supabase
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', userProfile.id);

        const { data: blockedMe, error: blockersError } = await supabase
          .from('blocks')
          .select('blocker_id')
          .eq('blocked_id', userProfile.id);

        // Combine all blocked user IDs
        const blockedIds = new Set();
        blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
        blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

        // Check if any group members are blocked
        const blockedMembers = groupMembers.filter(member => blockedIds.has(member.user_id));
        
        if (blockedMembers.length > 0) {
          // Get usernames of blocked members for the warning
          const { data: blockedProfiles } = await supabase
            .from('profiles')
            .select('username, full_name')
            .in('id', blockedMembers.map(m => m.user_id));

          const blockedNames = blockedProfiles?.map(p => p.full_name || p.username || 'a user').join(', ') || 'blocked users';
          
          Alert.alert(
            'Blocked Users in Group',
            `This group contains ${blockedMembers.length} ${blockedMembers.length === 1 ? 'user you have blocked' : 'users you have blocked'}: ${blockedNames}.\n\nYou won't be able to see their activities, but they will still be in the group. Do you want to proceed?`,
            [
              {
                text: 'Cancel',
                style: 'cancel'
              },
              {
                text: 'Join Anyway',
                onPress: async () => {
                  await performJoinGroup(groupId);
                }
              }
            ]
          );
          return;
        }
      }

      // No blocked users, proceed with join
      await performJoinGroup(groupId);
    } catch (error) {
      console.error('Error joining group:', error);
      Alert.alert('Error', 'Failed to join group. Please try again.');
    }
  };

  // Separate function to perform the actual join operation
  const performJoinGroup = async (groupId) => {
    try {
      const { error } = await supabase
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: userProfile.id,
          role: 'member'
        });

      if (error) throw error;

      // Refresh groups list
      fetchGroups();
      Alert.alert('Success', 'Joined group successfully!');
    } catch (error) {
      console.error('Error performing join:', error);
      throw error;
    }
  };

  // Leave group
  const handleLeaveGroup = async (groupId) => {
    try {
      if (!userProfile?.id) {
        Alert.alert('Error', 'Please log in to leave a group');
        return;
      }

      const { error } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userProfile.id);

      if (error) throw error;

      // Refresh groups list
      fetchGroups();
      Alert.alert('Success', 'Left group successfully!');
    } catch (error) {
      console.error('Error leaving group:', error);
      Alert.alert('Error', 'Failed to leave group. Please try again.');
    }
  };

  // Upload group avatar
  const handleUploadAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        const file = result.assets[0];
      
        // Create form data for Cloudinary upload
        const formData = new FormData();
        formData.append('file', {
          uri: file.uri,
          type: 'image/jpeg',
          name: 'upload.jpg',
        });
        formData.append('upload_preset', 'profilepics');
        const cloudinaryUrl = 'https://api.cloudinary.com/v1_1/derqwaq9h/image/upload';
      
        const response = await fetch(cloudinaryUrl, {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
          },
        });

        const data = await response.json();
      
        if (!data.secure_url) {
          throw new Error('Upload failed');
        }

        setNewGroup(prev => ({ ...prev, avatar_url: data.secure_url }));
      }
    } catch (error) {
      console.error('Error uploading avatar:', error);
      Alert.alert(
        'Upload Failed',
        error.message || 'Failed to upload avatar. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  // Add function to search all groups
  const searchGroups = async (text) => {
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('groups')
        .select(`
          *,
          member_count:group_members(count)
        `)
        .ilike('name', `%${text}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to get the actual count number
      const transformedGroups = data?.map(group => ({
        ...group,
        member_count: group.member_count[0]?.count || 0
      })) || [];

      setSearchResults(transformedGroups);
    } catch (error) {
      console.error('Error searching groups:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Add function to fetch invitations
  const fetchInvitations = async () => {
    try {
      setInvitationsLoading(true);
      const { data, error } = await supabase
        .from('group_invitations')
        .select(`
          *,
          group:group_id (
            id,
            name,
            avatar_url,
            description,
            is_public
          ),
          inviter:invited_by_id (
            id,
            username,
            avatar_url,
            full_name
          )
        `)
        .eq('invited_user_id', userProfile.id)
        .eq('status', 'pending');

      if (error) throw error;
      setInvitations(data || []);
    } catch (error) {
      console.error('Error fetching invitations:', error);
    } finally {
      setInvitationsLoading(false);
    }
  };

  // Update useEffect to fetch invitations
  useEffect(() => {
    fetchGroups();
    fetchInvitations();
  }, []);

  // Add function to handle invitation response
  const handleInvitationResponse = async (invitationId, accept) => {
    try {
      if (accept) {
        // Get the invitation details
        const { data: invitation, error: invitationError } = await supabase
          .from('group_invitations')
          .select('*')
          .eq('id', invitationId)
          .single();

        if (invitationError) throw invitationError;

        // Check for blocked users in the group before accepting invitation
        const { data: groupMembers, error: membersError } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', invitation.group_id);

        if (membersError) {
          console.error('Error fetching group members:', membersError);
        } else if (groupMembers && groupMembers.length > 0) {
          // Get blocked users (both directions)
          const { data: blockedByMe, error: blockedError } = await supabase
            .from('blocks')
            .select('blocked_id')
            .eq('blocker_id', userProfile.id);

          const { data: blockedMe, error: blockersError } = await supabase
            .from('blocks')
            .select('blocker_id')
            .eq('blocked_id', userProfile.id);

          // Combine all blocked user IDs
          const blockedIds = new Set();
          blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
          blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

          // Check if any group members are blocked
          const blockedMembers = groupMembers.filter(member => blockedIds.has(member.user_id));
          
          if (blockedMembers.length > 0) {
            // Get usernames of blocked members for the warning
            const { data: blockedProfiles } = await supabase
              .from('profiles')
              .select('username, full_name')
              .in('id', blockedMembers.map(m => m.user_id));

            const blockedNames = blockedProfiles?.map(p => p.full_name || p.username || 'a user').join(', ') || 'blocked users';
            
            Alert.alert(
              'Blocked Users in Group',
              `This group contains ${blockedMembers.length} ${blockedMembers.length === 1 ? 'user you have blocked' : 'users you have blocked'}: ${blockedNames}.\n\nYou won't be able to see their activities, but they will still be in the group. Do you want to proceed?`,
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: async () => {
                    // Reject the invitation if user cancels
                    await supabase
                      .from('group_invitations')
                      .update({ status: 'rejected' })
                      .eq('id', invitationId);
                    fetchInvitations();
                  }
                },
                {
                  text: 'Accept Anyway',
                  onPress: async () => {
                    await performAcceptInvitation(invitation);
                  }
                }
              ]
            );
            return;
          }
        }

        // No blocked users, proceed with accepting invitation
        await performAcceptInvitation(invitation);
      } else {
        // Reject invitation
        const { error: updateError } = await supabase
          .from('group_invitations')
          .update({ status: 'rejected' })
          .eq('id', invitationId);

        if (updateError) throw updateError;

        // Refresh data
        fetchInvitations();
      }
    } catch (error) {
      console.error('Error handling invitation:', error);
      Alert.alert('Error', 'Failed to process invitation. Please try again.');
    }
  };

  // Separate function to perform the actual accept invitation operation
  const performAcceptInvitation = async (invitation) => {
    try {
      // Add user to group members
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: invitation.group_id,
          user_id: userProfile.id,
          role: 'member'
        });

      if (memberError) throw memberError;

      // Update invitation status
      const { error: updateError } = await supabase
        .from('group_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitation.id);

      if (updateError) throw updateError;

      // Refresh data
      fetchInvitations();
      fetchGroups();
    } catch (error) {
      console.error('Error performing accept invitation:', error);
      throw error;
    }
  };

  // Filter feed by post type. Uses allFeedItems so the filter applies to all loaded items.
  // Pass PostType.ALL or null to show everything again.
  const filterPostByType = (type) => {
    setActiveFeedFilter(type || PostType.ALL);
    const source = allFeedItems.length > 0 ? allFeedItems : feed;
    if (!type || type === PostType.ALL) {
      const restored = source.length > 0 ? source.slice(0, ITEMS_PER_PAGE) : [];
      setFeed(restored);
      return;
    }
    const filtered = source.filter((post) => post.type === type);
    setFeed(filtered);
  };

  // Helper function to create kudos notifications
  const createKudosNotification = async (type, targetId) => {
    try {
      // Get the post owner's info
      let postOwnerId = null;
      
      if (type === 'run') {
        const { data: run, error: runError } = await supabase
          .from('runs')
          .select('user_id')
          .eq('id', targetId)
          .single();
        
        if (!runError && run) {
          postOwnerId = run.user_id;
        }
      } else {
        const { data: post, error: postError } = await supabase
          .from(`${type === 'workout' ? 'user_workout_logs' : 'mental_session_logs'}`)
          .select('user_id')
          .eq('id', targetId)
          .single();
        
        if (!postError && post) {
          postOwnerId = post.user_id;
        }
      }

      // Send notification to the post owner
      if (postOwnerId && postOwnerId !== userProfile.id) {
        await createLikeNotification(
          userProfile.id,
          postOwnerId,
          userProfile.full_name || userProfile.username,
          type,
          targetId
        );
      }
    } catch (error) {
      console.error('Error creating kudos notification:', error);
    }
  };

  const handleToggleKudos = async (type, targetId) => {
    try {
      // Special handling for runs
      if (type === 'run') {
        const { data: existingKudos, error: fetchError } = await supabase
          .from('run_kudos')
          .select('*')
          .eq('run_id', targetId)
          .eq('user_id', userProfile.id);

        if (fetchError) {
          console.error('Error checking run kudos:', fetchError);
          return;
        }

        if (existingKudos && existingKudos.length > 0) {
          // If kudos exists, remove it
          const { error: deleteError } = await supabase
            .from('run_kudos')
            .delete()
            .eq('run_id', targetId)
            .eq('user_id', userProfile.id);

          if (deleteError) {
            console.error('Error removing run kudos:', deleteError);
            return;
          }
        } else {
          // If no kudos exists, add it
          const { error: insertError } = await supabase
            .from('run_kudos')
            .insert([
              {
                run_id: targetId,
                user_id: userProfile.id,
              },
            ]);

          if (insertError) {
            console.error('Error adding run kudos:', insertError);
            return;
          }

          // Create notification for run kudos
          await createKudosNotification('run', targetId);
        }
      } else {
        // Handle other types (workout, mental) as before
        const { data: existingKudos, error: fetchError } = await supabase
          .from(`${type}_kudos`)
          .select('*')
          .eq(`${type}_id`, targetId)
          .eq('user_id', userProfile.id)
          .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error checking existing kudos:', fetchError);
          return;
        }

        if (existingKudos) {
          // If kudos exists, remove it
          const { error: deleteError } = await supabase
            .from(`${type}_kudos`)
            .delete()
            .eq(`${type}_id`, targetId)
            .eq('user_id', userProfile.id);

          if (deleteError) {
            console.error('Error removing kudos:', deleteError);
            return;
          }
        } else {
          // If no kudos exists, add it
          const { error: insertError } = await supabase
            .from(`${type}_kudos`)
            .insert([
              {
                [`${type}_id`]: targetId,
                user_id: userProfile.id,
              },
            ]);

          if (insertError) {
            console.error('Error adding kudos:', insertError);
            return;
          }

          // Create notification for kudos
          await createKudosNotification(type, targetId);
        }
      }

      // Refresh the feed to update kudos count
      fetchFeed();
    } catch (error) {
      console.error('Error toggling kudos:', error);
    }
  };



  // Clean up duplicate activities (call this occasionally to prevent duplicates)
  const cleanupDuplicates = async () => {
    try {
      console.log('Starting duplicate cleanup...');
      
      // Clean up duplicate runs (same user, same start time, same distance)
      const { data: duplicateRuns, error: runsError } = await supabase
        .from('runs')
        .select('*')
        .order('start_time', { ascending: false });
      
      if (!runsError && duplicateRuns) {
        const seenRuns = new Map();
        const duplicatesToDelete = [];
        
        duplicateRuns.forEach(run => {
          // More sophisticated duplicate detection for runs
          const timeKey = new Date(run.start_time).getTime();
          const roundedTime = Math.floor(timeKey / 10000) * 10000; // Round to 10 seconds
          const key = `${run.user_id}_${roundedTime}_${run.activity_type}_${Math.round(run.distance_meters / 10) * 10}`;
          
          if (seenRuns.has(key)) {
            // Keep the one with more locations (better path data)
            const existingRun = seenRuns.get(key);
            if (run.path && existingRun.path && run.path.length > existingRun.path.length) {
              duplicatesToDelete.push(existingRun.id);
              seenRuns.set(key, run);
            } else {
              duplicatesToDelete.push(run.id);
            }
          } else {
            seenRuns.set(key, run);
          }
        });
        
        if (duplicatesToDelete.length > 0) {
          console.log(`Found ${duplicatesToDelete.length} duplicate runs, cleaning up...`);
          const { error: deleteError } = await supabase
            .from('runs')
            .delete()
            .in('id', duplicatesToDelete);
          
          if (!deleteError) {
            console.log('Successfully cleaned up duplicate runs');
          }
        }
      }
      
      // Clean up duplicate workouts (same user, same completed time, same workout name)
      const { data: duplicateWorkouts, error: workoutsError } = await supabase
        .from('user_workout_logs')
        .select('*')
        .order('completed_at', { ascending: false });
      
      if (!workoutsError && duplicateWorkouts) {
        const seenWorkouts = new Map();
        const duplicatesToDelete = [];
        
        duplicateWorkouts.forEach(workout => {
          const key = `${workout.user_id}_${workout.completed_at}_${workout.workout_name}`;
          if (seenWorkouts.has(key)) {
            duplicatesToDelete.push(workout.id);
          } else {
            seenWorkouts.set(key, workout.id);
          }
        });
        
        if (duplicatesToDelete.length > 0) {
          console.log(`Found ${duplicatesToDelete.length} duplicate workouts, cleaning up...`);
          const { error: deleteError } = await supabase
            .from('user_workout_logs')
            .delete()
            .in('id', duplicatesToDelete);
          
          if (!deleteError) {
            console.log('Successfully cleaned up duplicate workouts');
          }
        }
      }
      
      console.log('Duplicate cleanup completed');
    } catch (error) {
      console.error('Error during duplicate cleanup:', error);
    }
  };

    return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        {/* Same width as search button so the title stays visually centered */}
        <View style={styles.headerSideSpacer} />

        <Text style={styles.header}>Community</Text>

        <TouchableOpacity
          style={styles.searchIconButton}
          onPress={() => setShowSearchModal(true)}
          accessibilityLabel="Search community"
        >
          <Ionicons name="search-outline" size={24} color={T.communityAccent} />
        </TouchableOpacity>
      </View>

      {/* Row 1: Feed only — primary “social feed” surface */}
      <View style={styles.tabStripRowPrimary}>
        <TouchableOpacity
          style={[styles.tabPillFeedFull, activeTab === 'feed' && styles.tabPillActive]}
          onPress={() => setActiveTab('feed')}
          activeOpacity={0.7}
        >
          <View style={styles.tabPillIconWrap}>
            <Ionicons
              name={activeTab === 'feed' ? 'newspaper' : 'newspaper-outline'}
              size={18}
              color={activeTab === 'feed' ? T.communityAccent : T.communityTextMuted}
            />
          </View>
          <Text
            style={[styles.tabPillLabel, activeTab === 'feed' && styles.tabPillLabelActive]}
            numberOfLines={1}
          >
            Feed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Row 2: Friends | Groups | League */}
      <View style={styles.tabStripRow}>
        {[
          { id: 'friends', icon: 'people', label: 'Friends', badge: friendRequests.length },
          { id: 'groups', icon: 'people-circle', label: 'Groups', badge: invitations.length },
          { id: 'league', icon: 'trophy', label: 'League', badge: 0 },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tabPill, activeTab === t.id && styles.tabPillActive]}
            onPress={() => setActiveTab(t.id)}
            activeOpacity={0.7}
          >
            <View style={styles.tabPillIconWrap}>
              <Ionicons
                name={activeTab === t.id ? t.icon : `${t.icon}-outline`}
                size={18}
                color={activeTab === t.id ? T.communityAccent : T.communityTextMuted}
              />
              {t.badge > 0 && (
                <View style={styles.tabPillBadge}>
                  <Text style={styles.tabPillBadgeText}>{t.badge > 9 ? '9+' : t.badge}</Text>
                </View>
              )}
            </View>
            <Text
              style={[styles.tabPillLabel, activeTab === t.id && styles.tabPillLabelActive]}
              numberOfLines={1}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.contentArea}>
      {activeTab === 'league' ? (
        <View style={styles.leagueEmbed}>
          <LeagueContent embedded />
        </View>
      ) : (
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollViewContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#00ffff"
            colors={['#00ffff']}
          />
        }
      >
        {activeTab === 'feed' ? (
          <>
            {/* Filter bar and chips: show for feed tab even when feed is empty */}
            <View style={styles.filterContainer}>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
                <Ionicons name="filter-outline" size={24} color="#00ffff" />
                <Text style={styles.filterButtonText}>Filter</Text>
              </TouchableOpacity>
              {/* Add event moved here so the header stays Feed | Groups | League + search only */}
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowCreateEventModal(true)}>
                <Ionicons name="add-circle-outline" size={24} color="#00ffff" />
                <Text style={styles.filterButtonText}>Event</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.filterChipsScroll}
              contentContainerStyle={styles.filterChipsContent}
            >
              {Object.values(PostType).map((value) => {
                const label = value === PostType.ALL ? 'All' : value.charAt(0).toUpperCase() + value.slice(1);
                const isActive = activeFeedFilter === value;
                return (
                  <TouchableOpacity
                    key={value}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => filterPostByType(value)}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Modal visible={showFilterModal} animationType="slide" transparent={true} onRequestClose={() => setShowFilterModal(false)}>
              <View style={styles.filterModalOverlay}>
                <View style={styles.filterModalContent}>
                  <Text style={styles.filterModalTitle}>Filter Posts</Text>
                  <FlatList
                    data={Object.values(PostType)}
                    keyExtractor={(item) => item}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.filterModalItem}
                        onPress={() => {
                          filterPostByType(item);
                          setShowFilterModal(false);
                        }}
                      >
                        <Text style={styles.filterModalItemText}>
                          {item === PostType.ALL ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                  <TouchableOpacity style={styles.filterModalCloseButton} onPress={() => setShowFilterModal(false)}>
                    <Ionicons name="close" size={24} color="#00ffff" />
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
            {/* Show initial loading only on first load when feed is empty */}
            {/* Note: RefreshControl already shows its own loading indicator, so we don't need another one */}
            {initialFeedLoading && feed.length === 0 ? (
              <View style={{ marginTop: 32, alignItems: 'center' }}>
                <ActivityIndicator color="#00ffff" />
              </View>
            ) : feed.length === 0 && !initialFeedLoading ? (
              // Empty feed state with CTAs: invite friends (primary) and share progress / log activity (secondary)
              <View style={styles.feedEmptyState}>
                <Ionicons name="people-outline" size={56} color="rgba(0, 255, 255, 0.5)" style={styles.feedEmptyStateIcon} />
                <Text style={styles.feedEmptyStateTitle}>No activity in your feed yet</Text>
                <Text style={styles.feedEmptyStateText}>
                  Invite friends to see their workouts, runs, and mental sessions here.
                </Text>
                <Text style={styles.feedEmptyStateText}>
                  Or share your first workout or run to get started.
                </Text>
                <TouchableOpacity
                  style={styles.feedEmptyStateButton}
                  onPress={() => setActiveTab('friends')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="person-add-outline" size={20} color="#000" />
                  <Text style={[styles.feedEmptyStateButtonText, { marginLeft: 8 }]}>Invite friends</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.feedEmptyStateSecondaryButton}
                  onPress={() => router.push('/(tabs)/workout')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="barbell-outline" size={20} color="#00ffff" />
                  <Text style={styles.feedEmptyStateSecondaryButtonText}>Log activity</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
              {/* Dismissible nudge when feed has posts: encourages user to share a workout or run */}
              {showParticipationNudge && (
                <View style={styles.participationNudgeCard}>
                  <TouchableOpacity
                    style={styles.participationNudgeDismiss}
                    onPress={() => setShowParticipationNudge(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Ionicons name="close" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                  <Text style={styles.participationNudgeText}>Your friends are active. Share a workout or run?</Text>
                  <TouchableOpacity
                    style={styles.participationNudgeButton}
                    onPress={() => router.push('/(tabs)/workout')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.participationNudgeButtonText}>Share</Text>
                  </TouchableOpacity>
                </View>
              )}
             
              {kudosGivenThisWeek > 0 && (
                <Text style={styles.feedSupportSummary}>You have given kudos to {kudosGivenThisWeek} post{kudosGivenThisWeek === 1 ? '' : 's'} this week.</Text>
              )}
                <FlatList
                data={feed}
                keyExtractor={item => `${item.type}_${item.id}`}
                renderItem={({ item }) => {
                  const profile = profileMap[item.user_id] || {};
                  const isOwnActivity = item.user_id === userProfile.id;
                  const kudosCount = item.kudos.length;
                  const hasKudoed = item.kudos.some(k => k.user_id === userProfile.id);
                  const commentCount = item.comments.length;
                
                  if (item.type === 'workout') {
                    const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration, 'seconds');
                    const description = [item.description, item.workout_focus, item.notes]
                      .map(part => (part ?? '').trim())
                      .filter(Boolean)
                      .join(' • ');
                    return (
                      <FeedCard
                        avatarUrl={profile.avatar_url}
                        name={profile.full_name || profile.username || 'User'}
                        date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
                        title={item.workout_name || 'Workout'}
                        description={description || undefined}
                        stats={[
                          { value: formatDurationSeconds(durationSeconds), label: 'Duration', highlight: true },
                          { value: item.exercise_count || '-', label: 'Exercises' },
                        ]}
                        type="workout"
                        targetId={item.id}
                        isOwner={isOwnActivity}
                        onEdit={isOwnActivity ? () => handleEditWorkout(item.id) : undefined}
                        userId={item.user_id}
                        photoUrl={item.photo_url}
                        initialKudosCount={kudosCount}
                        initialHasKudoed={hasKudoed}
                        initialCommentCount={commentCount}
                        borderColor={item.border_color || undefined}
                        kudosUsers={item.kudos || []}
                        profileMap={profileMap}
                        // TEMPORARILY DISABLED: Music visibility on feed cards
                        // spotifyTracksPreview={item.spotify_tracks_preview || []}
                        // spotifyTrackCount={item.spotify_track_count || 0}
                        // workoutSessionId={item.workout_session_id}
                      />
                    );
                  } else if (item.type === 'mental') {
                    const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration_minutes ?? item.duration, 'minutes');
                    const description = [item.session_type, item.session_name, item.notes]
                      .map(part => (part ?? '').trim())
                      .filter(Boolean)
                      .join(' • ');
                    return (
                      <FeedCard
                        avatarUrl={profile.avatar_url}
                        name={profile.full_name || profile.username || 'User'}
                        date={item.completed_at ? new Date(item.completed_at).toLocaleDateString() : '-'}
                        title={item.session_name || item.session_type || item.type || 'Session'}
                        description={description || undefined}
                        stats={[
                          { value: formatDurationSeconds(durationSeconds), label: 'Duration', highlight: true },
                          { value: item.calmness_level || '-', label: 'Calmness' },
                          { value: item.session_type || '-', label: 'Type', highlight: true },
                        ]}
                        type="mental"
                        targetId={item.id}
                        isOwner={isOwnActivity}
                        onEdit={isOwnActivity ? () => handleEditMental(item.id) : undefined}
                        userId={item.user_id}
                        photoUrl={item.photo_url}
                        initialKudosCount={kudosCount}
                        initialHasKudoed={hasKudoed}
                        initialCommentCount={commentCount}
                        borderColor={item.border_color || undefined}
                        kudosUsers={item.kudos || []}
                        profileMap={profileMap}
                      />
                    );
                  } else if (item.type === 'pr') {
                    // Handle new PR table structure with exercise_type
                    let stats = [];
                    let title = item.exercise_name || 'Personal Record';
                    
                    if (item.exercise_type === 'weight') {
                      // Weight-based PRs - convert kg to lbs if using imperial
                      const currentWeight = item.current_weight_kg;
                      const targetWeight = item.target_weight_kg;
                      
                      if (currentWeight !== null && currentWeight !== undefined) {
                        const displayCurrent = useImperial ? (currentWeight * 2.20462).toFixed(1) : currentWeight.toFixed(1);
                        const currentUnit = useImperial ? 'lbs' : 'kg';
                        stats.push({ value: `${displayCurrent} ${currentUnit}`, label: 'Current', highlight: true });
                      } else {
                        stats.push({ value: '-', label: 'Current', highlight: true });
                      }
                      
                      if (targetWeight !== null && targetWeight !== undefined) {
                        const displayTarget = useImperial ? (targetWeight * 2.20462).toFixed(1) : targetWeight.toFixed(1);
                        const targetUnit = useImperial ? 'lbs' : 'kg';
                        stats.push({ value: `${displayTarget} ${targetUnit}`, label: 'Target' });
                      } else {
                        stats.push({ value: '-', label: 'Target' });
                      }
                    } else if (item.exercise_type === 'running' || item.exercise_type === 'biking') {
                      // Time-based PRs for running/biking
                      const currentTime = item.current_time_minutes;
                      const targetTime = item.target_time_minutes;
                      
                      if (currentTime !== null && currentTime !== undefined) {
                        const minutes = Math.floor(currentTime);
                        const seconds = Math.floor((currentTime % 1) * 60);
                        stats.push({ value: `${minutes}:${seconds.toString().padStart(2, '0')}`, label: 'Current', highlight: true });
                      } else {
                        stats.push({ value: '-', label: 'Current', highlight: true });
                      }
                      
                      if (targetTime !== null && targetTime !== undefined) {
                        const minutes = Math.floor(targetTime);
                        const seconds = Math.floor((targetTime % 1) * 60);
                        stats.push({ value: `${minutes}:${seconds.toString().padStart(2, '0')}`, label: 'Target' });
                      } else {
                        stats.push({ value: '-', label: 'Target' });
                      }
                      
                      // Add distance if available
                      if (item.distance_meters) {
                        const distanceKm = item.distance_meters / 1000;
                        const distanceMiles = distanceKm * 0.621371;
                        const displayDistance = useImperial ? distanceMiles.toFixed(2) : distanceKm.toFixed(2);
                        const distanceUnit = useImperial ? 'mi' : 'km';
                        title = `${item.exercise_name} (${displayDistance} ${distanceUnit})`;
                      }
                    }
                    
                    return (
                      <FeedCard
                        avatarUrl={profile.avatar_url}
                        name={profile.full_name || profile.username || 'User'}
                        date={item.created_at ? new Date(item.created_at).toLocaleDateString() : '-'}
                        title={title}
                        stats={stats.length > 0 ? stats : [{ value: '-', label: 'Current', highlight: true }, { value: '-', label: 'Target' }]}
                        type="pr"
                        targetId={item.id}
                        isOwner={isOwnActivity}
                        userId={item.user_id}
                        kudosUsers={item.kudos || []}
                        profileMap={profileMap}
                      />
                    );
                  } else if (item.type === 'run') {
                    const distanceKmRaw = toNumeric(item.distance_meters);
                    const distanceKm = distanceKmRaw && distanceKmRaw > 0 ? distanceKmRaw / 1000 : null;
                    const distanceMiles = distanceKm ? distanceKm * 0.621371 : null;
                    const displayDistance = useImperial ? distanceMiles : distanceKm;
                    const distanceUnit = useImperial ? 'mi' : 'km';
                     const durationSeconds = resolveDurationSeconds(item.duration_seconds, item.duration_minutes, 'minutes');
                    
                    // Get the activity type (run, walk, bike) - defaults to 'run'
                    const activityType = item.activity_type || 'run';
                    const isBike = activityType === 'bike';
                    
                    // Get title based on activity type
                    const activityTitle = {
                      run: 'Run',
                      walk: 'Walk', 
                      bike: 'Bike Ride'
                    }[activityType] || 'Run';
                    
                    const stats = [];
                    if (displayDistance) {
                      stats.push({ value: `${displayDistance >= 10 ? displayDistance.toFixed(1) : displayDistance.toFixed(2)} ${distanceUnit}`, label: 'Distance', highlight: true });
                    }
                    
                    // For biking, show speed (kph/mph). For running/walking, show pace (min/km)
                    if (isBike) {
                      // Calculate speed from distance and duration
                      const durationHours = (durationSeconds || 1) / 3600;
                      const speedKph = distanceKm && durationHours > 0 ? distanceKm / durationHours : 0;
                      const speedMph = speedKph * 0.621371;
                      const displaySpeed = useImperial ? speedMph : speedKph;
                      const speedUnit = useImperial ? 'mph' : 'kph';
                      if (displaySpeed > 0) {
                        stats.push({ value: `${displaySpeed.toFixed(1)} ${speedUnit}`, label: 'Speed' });
                      }
                    } else {
                      // Show pace for run/walk
                      // Pace is stored as minutes per km - convert to min/mi if imperial
                      const pacePerKm = item.average_pace_minutes_per_km;
                      // Only show pace if we have valid data
                      if (pacePerKm && pacePerKm > 0 && !isNaN(pacePerKm)) {
                        // 1 mile = 1.60934 km, so min/mi = min/km × 1.60934
                        const paceMinutes = useImperial ? (pacePerKm * 1.60934) : pacePerKm;
                        const paceFormatted = `${Math.floor(paceMinutes)}:${Math.floor((paceMinutes % 1) * 60).toString().padStart(2, '0')}`;
                        const paceUnit = useImperial ? '/mi' : '/km';
                      stats.push({ value: `${paceFormatted} ${paceUnit}`, label: 'Pace' });
                    }
                    }
                    
                    stats.push({ value: formatDurationSeconds(durationSeconds), label: 'Duration' });
                    
                    // Add calories if available
                    if (item.calories_burned && item.calories_burned > 0) {
                      stats.push({ value: `${item.calories_burned}`, label: 'Calories' });
                    }
                    
                    // Add heart rate if available
                    if (item.average_heart_rate && item.average_heart_rate > 0) {
                      stats.push({ value: `${item.average_heart_rate} bpm`, label: 'Avg HR' });
                    }
                    
                     return (
                       <FeedCard
                         avatarUrl={profile.avatar_url}
                         name={profile.full_name || profile.username || 'User'}
                         date={item.start_time ? new Date(item.start_time).toLocaleDateString() : '-'}
                         title={item.name || activityTitle}
                         description={item.notes || ""}
                         stats={stats}
                         type="run"
                         targetId={item.id}
                         isOwner={isOwnActivity}
                         onEdit={isOwnActivity ? () => handleEditRun(item.id) : undefined}
                         userId={item.user_id}
                         photoUrl={item.photo_url}
                         initialKudosCount={item.kudos.length}
                         initialHasKudoed={item.kudos.some(k => k.user_id === userProfile.id)}
                         initialCommentCount={item.comments.length}
                         runData={{
                           path: item.path,
                           distance_meters: item.distance_meters,
                           duration_seconds: item.duration_seconds,
                           start_time: item.start_time,
                           end_time: item.end_time
                         }}
                         showMapToOthers={item.show_map_to_others !== false}
                         borderColor={item.border_color || undefined}
                         kudosUsers={item.kudos || []}
                         profileMap={profileMap}
                       />
                     );
                  } else if (item.type === 'event') {
                    const eventProfile = profileMap[item.creator_id] || {};
                    const eventDateDisplay = item.date ? new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : (item.created_at ? new Date(item.created_at).toLocaleDateString() : '—');
                    return (
                      <FeedCard
                        avatarUrl={eventProfile.avatar_url}
                        name={eventProfile.full_name || eventProfile.username || 'User'}
                        date={eventDateDisplay}
                        title={item.title || 'Event'}
                        description={item.description || undefined}
                        type="event"
                        targetId={item.id}
                        userId={item.creator_id}
                        eventData={{
                          id: item.id,
                          title: item.title,
                          description: item.description,
                          date: item.date,
                          event_date: item.date,
                          time: item.time,
                          event_time: item.time,
                          location: item.location,
                          attendeesWhoAreFriends: item.attendeesWhoAreFriends || [],
                        }}
                        isEventJoined={item.isEventJoined === true}
                        onJoinEvent={() => handleJoinEvent(item.id)}
                        onLeaveEvent={() => handleLeaveEvent(item.id)}
                        stats={[]}
                      />
                    );
                  }
                  return null;
                }}
                style={{ marginTop: 16 }}
                scrollEnabled={false}
              />
              
              {/* Load More Button */}
              {hasMoreFeed && (
                <TouchableOpacity
                  style={styles.loadMoreButton}
                  onPress={loadMoreFeed}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#00ffff" />
                  ) : (
                    <>
                      <Ionicons name="chevron-down" size={20} color="#00ffff" />
                      <Text style={styles.loadMoreText}>Load More</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
              </>
            )}
          </>
        ) : activeTab === 'groups' ? (
          <View style={styles.groupsContainer}>
            <View style={styles.groupsHeader}>
              <Text style={styles.sectionTitle}>Groups</Text>
              {isPremium ? (
                <TouchableOpacity onPress={() => setShowCreateGroupModal(true)}>
                  <Ionicons name="add-circle" size={28} color="#00ffff" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setShowPremiumModal(true)}>
                  <Ionicons name="add-circle" size={28} color="#666" />
                </TouchableOpacity>
              )}
            </View>

            <TextInput
              style={styles.searchInput}
              placeholder="Search groups..."
              placeholderTextColor="#888"
              value={groupSearch}
              onChangeText={(text) => {
                setGroupSearch(text);
                searchGroups(text);
              }}
            />

            {invitations.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Group Invitations</Text>
                {invitations.map((invitation) => (
                  <View key={invitation.id} style={styles.invitationCard}>
                    <GroupAvatar
                      groupName={invitation.group?.name}
                      size={50}
                      source={invitation.group?.avatar_url ? { uri: invitation.group.avatar_url } : null}
                      style={styles.invitationAvatar}
                    />
                    <View style={styles.invitationInfo}>
                      <Text style={styles.invitationName}>
                        {invitation.group?.name}
                      </Text>
                      <Text style={styles.invitationInviter}>
                        Invited by {invitation.inviter?.full_name || invitation.inviter?.username}
                      </Text>
                      <Text style={styles.invitationDescription}>
                        {invitation.group?.description || 'No description available'}
                      </Text>
                    </View>
                    <View style={styles.invitationActions}>
                      <TouchableOpacity
                        style={[styles.invitationButton, styles.acceptButton]}
                        onPress={() => handleInvitationResponse(invitation.id, true)}
                      >
                        <Text style={styles.acceptButtonText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.invitationButton, styles.rejectButton]}
                        onPress={() => handleInvitationResponse(invitation.id, false)}
                      >
                        <Text style={styles.rejectButtonText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {searching ? (
              <ActivityIndicator color="#00ffff" style={{ marginTop: 32 }} />
            ) : groupSearch ? (
              <GroupList
                groups={searchResults}
                loading={searching}
                onGroupPress={(group) => router.push(`/group/${group.id}`)}
                onJoinGroup={(group) => handleJoinGroup(group.id)}
                onLeaveGroup={(group) => handleLeaveGroup(group.id)}
                userGroups={groups}
                showActions={true}
                emptyStateText="No groups found"
                emptyStateIcon="search-outline"
              />
            ) : (
              <>
                <Text style={styles.sectionSubtitle}>Your Groups</Text>
                {groupsLoading ? (
                  <ActivityIndicator color="#00ffff" style={{ marginTop: 32 }} />
                ) : groups.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>You have not joined any groups yet</Text>
                    {isPremium ? (
                      <TouchableOpacity
                        style={styles.createGroupButton}
                        onPress={() => setShowCreateGroupModal(true)}
                      >
                        <Text style={styles.createGroupButtonText}>Create Your First Group</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.createGroupButton, styles.premiumButton]}
                        onPress={() => setShowPremiumModal(true)}
                      >
                        <Text style={styles.createGroupButtonText}>Upgrade to Create Groups</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.feedEmptyStateButton, { marginTop: 16 }]}
                      onPress={() => router.push('/suggested-groups')}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="people-circle-outline" size={20} color="#000" />
                      <Text style={[styles.feedEmptyStateButtonText, { marginLeft: 8 }]}>Browse suggested groups</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <GroupList
                    groups={groups}
                    loading={groupsLoading}
                    onGroupPress={(group) => router.push(`/group/${group.id}`)}
                    onJoinGroup={(group) => handleJoinGroup(group.id)}
                    onLeaveGroup={(group) => handleLeaveGroup(group.id)}
                    userGroups={groups}
                    showActions={false}
                    emptyStateText="You haven't joined any groups yet"
                    emptyStateIcon="people-outline"
                  />
                )}
              </>
            )}
          </View>
        ) : (
          <>
            <View style={styles.searchSection}>
              <Text style={styles.searchHeader}>Add Friends</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search users..."
                placeholderTextColor="#888"
                value={search}
                onChangeText={handleSearch}
              />
            </View>
            {loading && <ActivityIndicator color="#00ffff" style={{ marginTop: 16 }} />}
          
            {search.length > 1 ? (
              <>
                {searchResults.length === 0 && !loading && (
                  <Text style={{ color: '#fff', marginTop: 16 }}>No users found.</Text>
                )}
                <FlatList
                  data={searchResults}
                  renderItem={renderResult}
                  keyExtractor={(item) => item.id}
                  style={{ marginTop: 16 }}
                  scrollEnabled={false}
                />
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.sectionCard, { marginBottom: 16, flexDirection: 'row', alignItems: 'center', padding: 14 }]}
                  onPress={() => router.push('/accountability')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="hand-left-outline" size={24} color="#00ffff" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.sectionTitleText}>Accountability partners</Text>
                    <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Weekly check-ins with friends</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
                {friendRequests.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="person-add-outline" size={18} color="#38bdf8" />
                      <Text style={styles.sectionTitleText}>Friend Requests ({friendRequests.length})</Text>
                    </View>
                    <FlatList
                      data={friendRequests}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <View style={styles.requestRow}>
                          <PremiumAvatar
                            size={44}
                            source={item.avatar_url ? { uri: item.avatar_url } : null}
                            isPremium={item.is_premium}
                            username={item.username}
                            fullName={item.full_name}
                            style={{ marginRight: 16 }}
                          />
                          <View style={styles.requestInfo}>
                            <Text style={styles.resultName}>{item.full_name || item.username}</Text>
                            <Text style={styles.resultSubtitle}>@{item.username}</Text>
                          </View>
                          <View style={[styles.requestActions, styles.requestActionsStacked]}>
                            <TouchableOpacity
                              style={[styles.statusPill, styles.statusPillSuccess]}
                              onPress={() => handleRequestAction(item.friendship_id, 'accept')}
                            >
                              <Ionicons name="checkmark" size={12} color="#0f172a" />
                              <Text style={styles.statusPillText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.statusPill, styles.statusPillDanger, styles.requestActionsSpacing]}
                              onPress={() => handleRequestAction(item.friendship_id, 'decline')}
                            >
                              <Ionicons name="close" size={12} color="#f87171" />
                              <Text style={[styles.statusPillText, { color: '#f87171' }]}>Decline</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      scrollEnabled={false}
                    />
                  </View>
                )}

                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeaderRow}>
                    <Ionicons name="people-outline" size={18} color="#38bdf8" />
                    <Text style={styles.sectionTitleText}>Your Friends ({friends.length})</Text>
                  </View>
                  {friends.length === 0 ? (
                    <View style={styles.emptyStateCard}>
                      <Ionicons name="sparkles-outline" size={20} color="#94a3b8" />
                      <Text style={styles.emptyStateText}>You have no friends yet. Use the search above to connect.</Text>
                      <Text style={[styles.emptyStateText, { marginTop: 10 }]}>Search by username to find and add friends.</Text>
                      <TouchableOpacity
                        style={styles.feedEmptyStateSecondaryButton}
                        onPress={() => router.push('/suggested-groups')}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="people-circle-outline" size={20} color="#00ffff" />
                        <Text style={styles.feedEmptyStateSecondaryButtonText}>Discover groups</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <FlatList
                      data={friends}
                      renderItem={renderResult}
                      keyExtractor={(item) => item.id}
                      contentContainerStyle={styles.sectionList}
                      scrollEnabled={false}
                    />
                  )}
                </View>

                {outgoingRequests.length > 0 && (
                  <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                      <Ionicons name="paper-plane-outline" size={18} color="#38bdf8" />
                      <Text style={styles.sectionTitleText}>Outgoing Requests ({outgoingRequests.length})</Text>
                    </View>
                    <FlatList
                      data={outgoingRequests}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <View style={styles.requestRow}>
                          <TouchableOpacity onPress={() => router.push(`/profile/${item.id}`)}>
                            <PremiumAvatar
                              size={44}
                              source={item.avatar_url ? { uri: item.avatar_url } : null}
                              isPremium={item.is_premium}
                              username={item.username}
                              fullName={item.full_name}
                              style={{ marginRight: 16 }}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={styles.requestInfo}
                            onPress={() => router.push(`/profile/${item.id}`)}
                          >
                            <Text style={styles.resultName}>{item.full_name || item.username}</Text>
                            <Text style={styles.resultSubtitle}>@{item.username}</Text>
                          </TouchableOpacity>
                          <View style={[styles.requestActions, styles.requestActionsStacked]}>
                            <View style={[styles.statusPill, styles.statusPillPending, styles.requestActionsSpacing]}>
                              <Ionicons name="time-outline" size={12} color="#fbbf24" />
                              <Text style={[styles.statusPillText, { color: '#fbbf24' }]}>Awaiting</Text>
                            </View>
                            <TouchableOpacity
                              style={[styles.statusPill, styles.statusPillDanger, styles.requestActionsSpacing]}
                              onPress={() => handleRequestAction(item.friendship_id, 'cancel')}
                            >
                              <Ionicons name="close" size={12} color="#f87171" />
                              <Text style={[styles.statusPillText, { color: '#f87171' }]}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                      scrollEnabled={false}
                    />
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      )}
      </View>

      <Modal
        visible={showSearchModal}
        animationType="slide"
        onRequestClose={closeUnifiedSearchModal}
      >
        <View style={styles.unifiedSearchModal}>
          <View style={styles.unifiedSearchHeader}>
            <Text style={styles.unifiedSearchTitle}>Discover</Text>
            <TouchableOpacity onPress={closeUnifiedSearchModal} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={28} color="#00ffff" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.unifiedSearchInput}
            placeholder="Search people, groups, teams..."
            placeholderTextColor="#64748b"
            value={unifiedQuery}
            onChangeText={onUnifiedQueryChange}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {unifiedQuery.trim().length < 2 ? (
            <ScrollView style={styles.discoverScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.discoverSectionLabel}>Suggestions</Text>
              <TouchableOpacity
                style={styles.discoverTile}
                onPress={() => {
                  closeUnifiedSearchModal();
                  router.push('/suggested-friends');
                }}
              >
                <Ionicons name="person-add-outline" size={22} color="#00ffff" />
                <Text style={styles.discoverTileText}>Discover friends</Text>
                <Ionicons name="chevron-forward" size={20} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discoverTile}
                onPress={() => {
                  closeUnifiedSearchModal();
                  router.push('/suggested-groups');
                }}
              >
                <Ionicons name="people-circle-outline" size={22} color="#00ffff" />
                <Text style={styles.discoverTileText}>Discover groups</Text>
                <Ionicons name="chevron-forward" size={20} color="#475569" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discoverTile}
                onPress={() => {
                  closeUnifiedSearchModal();
                  router.push('/league/browse-teams');
                }}
              >
                <Ionicons name="trophy-outline" size={22} color="#00ffff" />
                <Text style={styles.discoverTileText}>Browse teams</Text>
                <Ionicons name="chevron-forward" size={20} color="#475569" />
              </TouchableOpacity>
            </ScrollView>
          ) : unifiedLoading ? (
            <ActivityIndicator color="#00ffff" style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={unifiedResults}
              keyExtractor={(item) => `${item.resultType}-${item.id}`}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <Text style={{ color: '#94a3b8', marginTop: 24, textAlign: 'center' }}>No matches</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.unifiedResultRow}
                  onPress={() => {
                    closeUnifiedSearchModal();
                    if (item.resultType === 'profile') router.push(`/profile/${item.id}`);
                    else if (item.resultType === 'group') router.push(`/group/${item.id}`);
                    else router.push(`/league/team/${item.id}`);
                  }}
                >
                  {item.resultType === 'profile' ? (
                    <PremiumAvatar
                      userId={item.id}
                      size={44}
                      source={item.avatar_url ? { uri: item.avatar_url } : null}
                      isPremium={item.is_premium}
                      username={item.username}
                      fullName={item.full_name}
                    />
                  ) : item.resultType === 'group' ? (
                    <GroupAvatar
                      groupName={item.name}
                      size={44}
                      source={item.avatar_url ? { uri: item.avatar_url } : null}
                    />
                  ) : (
                    <View style={styles.teamThumb}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.teamThumbImg} />
                      ) : (
                        <Ionicons name="trophy-outline" size={24} color="#00ffff" />
                      )}
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.unifiedResultTitle}>
                      {item.resultType === 'profile' ? item.username || item.full_name : item.name}
                    </Text>
                    <Text style={styles.unifiedResultSub}>
                      {item.resultType === 'profile'
                        ? 'Profile'
                        : item.resultType === 'group'
                          ? 'Group'
                          : 'Team'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#475569" />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Create Group Modal */}
      <Modal
        visible={showCreateGroupModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateGroupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Group</Text>
          
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={handleUploadAvatar}
            >
              {newGroup.avatar_url ? (
                <Image
                  source={{ uri: newGroup.avatar_url }}
                  style={styles.previewAvatar}
                />
              ) : (
                <Text style={styles.avatarButtonText}>Add Group Photo</Text>
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.input}
              placeholder="Group Name"
              placeholderTextColor="#888"
              value={newGroup.name}
              onChangeText={(text) => setNewGroup(prev => ({ ...prev, name: text }))}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Group Description (optional)"
              placeholderTextColor="#888"
              multiline
              value={newGroup.description}
              onChangeText={(text) => setNewGroup(prev => ({ ...prev, description: text }))}
            />

            <View style={styles.privacyToggle}>
              <Text style={styles.privacyLabel}>Privacy:</Text>
              <View style={styles.privacyOptions}>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    newGroup.is_public && styles.selectedPrivacy
                  ]}
                  onPress={() => setNewGroup(prev => ({ ...prev, is_public: true }))}
                >
                  <Ionicons
                    name="globe"
                    size={20}
                    color={newGroup.is_public ? '#00ffff' : '#fff'}
                  />
                  <Text style={[
                    styles.privacyText,
                    newGroup.is_public && styles.selectedPrivacyText
                  ]}>Public</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.privacyOption,
                    !newGroup.is_public && styles.selectedPrivacy
                  ]}
                  onPress={() => setNewGroup(prev => ({ ...prev, is_public: false }))}
                >
                  <Ionicons
                    name="lock-closed"
                    size={20}
                    color={!newGroup.is_public ? '#00ffff' : '#fff'}
                  />
                  <Text style={[
                    styles.privacyText,
                    !newGroup.is_public && styles.selectedPrivacyText
                  ]}>Private</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCreateGroupModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateGroup}
              >
                <Text style={styles.createButtonText}>Create Group</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Premium Modal */}
      <Modal
        visible={showPremiumModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPremiumModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Premium Feature</Text>
            <Text style={styles.modalText}>
              Creating groups is a premium feature. Upgrade to Premium to create and manage your own groups!
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowPremiumModal(false)}
              >
                <Text style={styles.cancelButtonText}>Maybe Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.createButton}
                onPress={async () => {
                  setShowPremiumModal(false);
                  const purchased = await presentPremiumPaywall();
                  if (!purchased && Platform.OS !== 'ios') {
                    router.push('/purchase-subscription');
                  }
                }}
              >
                <Text style={styles.createButtonText}>Upgrade to Premium</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddEventModal
        visible={showCreateEventModal}
        onClose={() => setShowCreateEventModal(false)}
        onSuccess={() => {
          setShowCreateEventModal(false);
          // Always reload feed data (onRefresh only runs fetch when the Feed sub-tab is active).
          fetchFeedRef.current(false, true);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.communityBg,
    paddingTop: 55,
    paddingHorizontal: 0,
    paddingBottom: T.spacing.lg,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: T.spacing.md,
  },
  communityHeader: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 28,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 1,
  },
  tabStripRowPrimary: {
    flexDirection: 'row',
    marginBottom: T.spacing.xs,
    width: '100%',
    paddingHorizontal: T.spacing.md,
  },
  tabPillFeedFull: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: T.communityRadius,
    backgroundColor: T.communityCardBg,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 0,
  },
  tabStripRow: {
    flexDirection: 'row',
    marginBottom: T.spacing.sm,
    gap: T.spacing.xs,
    width: '100%',
    paddingHorizontal: T.spacing.md,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: T.communityRadius,
    backgroundColor: T.communityCardBg,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 0,
  },
  tabPillActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderColor: T.communityBorderActive,
  },
  tabPillIconWrap: {
    marginRight: 4,
    position: 'relative',
  },
  tabPillBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: T.communityBadgeRed,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabPillBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  tabPillLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: T.communityTextMuted,
    marginLeft: 4,
  },
  tabPillLabelActive: {
    color: T.communityAccent,
    fontWeight: '600',
  },
  header: {
    color: T.communityAccent,
    fontWeight: 'bold',
    fontSize: 28,
    marginBottom: 4,
    textAlign: 'center',
  },
  searchInput: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.14)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 16,
  },
  username: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  friendsPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addFriendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38bdf8',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  addFriendBtnText: {
    marginLeft: 6,
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  removeFriendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
    minHeight: 40,
  },
  friendStatus: {
    color: '#00ffff',
    marginLeft: 10,
    fontWeight: 'bold',
    fontSize: 14,
  },
  friendsRequestsSection: {
    marginBottom: 18,
  },
  requestsHeader: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    marginTop: 8,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.14)',
  },
  requestInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  requestActions: {
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  requestActionsStacked: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  requestActionsSpacing: {
    marginTop: 8,
  },
  acceptBtn: {
    backgroundColor: '#00ff99',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 10,
  },
  acceptBtnText: {
    color: '#111',
    fontWeight: 'bold',
  },
  declineBtn: {
    backgroundColor: '#ff0055',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 6,
  },
  declineBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  friendsHeader: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    marginTop: 8,
  },
  avatarIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  groupsContainer: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 20,
  },
  groupsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00ffff',
    textShadowColor: 'rgba(0, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  groupsList: {
    paddingBottom: 20,
    flexGrow: 0,
  },
  groupCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
    overflow: 'hidden',
    height: 180,
  },
  groupCardHeader: {
    height: 60,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    position: 'relative',
  },
  groupBanner: {
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  groupAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#111',
    position: 'absolute',
    bottom: -25,
    left: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  groupInfo: {
    padding: 12,
    paddingTop: 30,
  },
  groupName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  groupDesc: {
    color: '#888',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 16,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    padding: 6,
    borderRadius: 10,
    marginBottom: 8,
  },
  groupMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCount: {
    color: '#00ffff',
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  privacyStatus: {
    color: '#00ffff',
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  groupActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    paddingTop: 0,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    minWidth: 100,
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#00ffff',
    fontWeight: '600',
    fontSize: 13,
  },
  leaveButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 0, 85, 0.1)',
    minWidth: 100,
    alignItems: 'center',
  },
  leaveButtonText: {
    color: '#ff0055',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  emptyStateText: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  feedEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 48,
    marginHorizontal: 24,
    backgroundColor: 'rgba(0, 255, 255, 0.04)',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.12)',
  },
  feedEmptyStateIcon: {
    marginBottom: 16,
  },
  feedEmptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  feedEmptyStateText: {
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 14,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  feedEmptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  feedEmptyStateButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Secondary CTA (outline): e.g. "Log activity" in feed empty state
  feedEmptyStateSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00ffff',
    backgroundColor: 'transparent',
  },
  feedEmptyStateSecondaryButtonText: {
    color: '#00ffff',
    fontWeight: '600',
    fontSize: 16,
    marginLeft: 8,
  },
  participationNudgeCard: {
    marginTop: 16,
    marginHorizontal: 24,
    marginBottom: 8,
    padding: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  participationNudgeDismiss: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  participationNudgeText: {
    color: '#e2e8f0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    paddingRight: 28,
  },
  participationNudgeButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#00ffff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  participationNudgeButtonText: {
    color: '#000',
    fontWeight: '600',
    fontSize: 14,
  },
  feedSupportCopy: {
    color: 'rgba(0, 255, 255, 0.9)',
    fontSize: 14,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  feedSupportSummary: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  filterButtonText: {
    color: '#00ffff',
    fontWeight: '600',
    fontSize: 15,
    marginLeft: 8,
  },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  filterModalContent: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  filterModalTitle: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterModalItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  filterModalItemText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  filterModalCloseButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  filterChipsScroll: {
    marginBottom: 12,
  },
  filterChipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 24,
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.4)',
  },
  filterChipText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#00ffff',
  },
  createGroupButton: {
    backgroundColor: '#00ffff',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 20,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createGroupButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 17,
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  avatarButton: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#00ffff',
    borderStyle: 'dashed',
  },
  avatarButtonText: {
    color: '#00ffff',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  previewAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: '#00ffff',
  },
  privacyToggle: {
    backgroundColor: '#222',
    padding: 16,
    borderRadius: 16,
    marginBottom: 32,
  },
  privacyLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  privacyOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  privacyOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  privacyText: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#ff0055',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ff0055',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  createButton: {
    flex: 1,
    backgroundColor: '#00ffff',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  createButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111',
    padding: 32,
    borderRadius: 24,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    color: '#00ffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 16,
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
  },
  premiumButton: {
    backgroundColor: '#666',
    shadowColor: '#666',
  },
  selectedPrivacy: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderColor: '#00ffff',
  },
  selectedPrivacyText: {
    color: '#00ffff',
  },
  modalText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
  },
  searchSection: {
    marginBottom: 16,
  },
  searchHeader: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  sectionSubtitle: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    marginTop: 8,
    textShadowColor: 'rgba(0, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  section: {
    marginBottom: 24,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  invitationAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  invitationInfo: {
    flex: 1,
    marginRight: 12,
  },
  invitationName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  invitationInviter: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  invitationDescription: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 4,
  },
  invitationActions: {
    flexDirection: 'column',
    gap: 8,
  },
  invitationButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  acceptButton: {
    backgroundColor: '#00ff99',
  },
  rejectButton: {
    backgroundColor: '#ff0055',
  },
  acceptButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: T.spacing.md,
    marginBottom: 4,
  },
  headerSideSpacer: {
    width: 44,
    height: 44,
  },
  searchIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.communityCardBgHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: T.communityBorderActive,
  },
  leagueEmbed: {
    flex: 1,
    marginHorizontal: -T.spacing.md,
    minHeight: 200,
  },
  unifiedSearchModal: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  unifiedSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  unifiedSearchTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  unifiedSearchInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.2)',
    marginBottom: 16,
  },
  discoverScroll: {
    flex: 1,
  },
  discoverSectionLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  discoverTile: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  discoverTileText: {
    flex: 1,
    marginLeft: 12,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unifiedResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  unifiedResultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  unifiedResultSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  teamThumb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  teamThumbImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  suggestedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    minWidth: 160,
    justifyContent: 'center',
  },
  suggestedButtonText: {
    color: 'cyan',
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingHorizontal: 4,
    paddingBottom: 120, // Increased from 75 to 120 to clear the tab bar
  },
  loadMoreButton: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 40, // Increased from 24 to 40 for more space above tab bar
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    flexDirection: 'row',
    gap: 8,
  },
  loadMoreText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  statusPillText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    color: '#0f172a',
  },
  statusPillSuccess: {
    backgroundColor: '#22d3ee',
    borderColor: '#22d3ee',
  },
  statusPillPending: {
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
  statusPillDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  resultSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleText: {
    marginLeft: 8,
    color: '#e2e8f0',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  sectionList: {
    paddingTop: 4,
  },
  emptyStateCard: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
});

export default CommunityScreen; 

