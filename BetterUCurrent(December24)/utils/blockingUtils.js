// Blocking System Utility Functions
// This file provides helper functions for managing user blocking relationships
// It handles blocking, unblocking, and checking if users are blocked

import { supabase } from '../lib/supabase';

/**
 * Block a user
 * When user A blocks user B, both users cannot see each other (mutual blocking)
 * 
 * @param {string} blockedUserId - The ID of the user to block
 * @param {string} currentUserId - The ID of the current user (blocker)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const blockUser = async (blockedUserId, currentUserId) => {
  try {
    // Prevent users from blocking themselves
    if (blockedUserId === currentUserId) {
      return { success: false, error: 'You cannot block yourself' };
    }

    // Check if already blocked
    const { data: existingBlock, error: checkError } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedUserId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 means no rows found, which is fine
      // Any other error is a real problem
      console.error('Error checking existing block:', checkError);
      return { success: false, error: 'Failed to check block status' };
    }

    // If already blocked, return success (idempotent operation)
    if (existingBlock) {
      return { success: true };
    }

    // Create the block
    const { error } = await supabase
      .from('blocks')
      .insert({
        blocker_id: currentUserId,
        blocked_id: blockedUserId
      });

    if (error) {
      console.error('Error blocking user:', error);
      return { success: false, error: 'Failed to block user' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in blockUser:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Unblock a user
 * Removes the blocking relationship, allowing both users to see each other again
 * 
 * @param {string} blockedUserId - The ID of the user to unblock
 * @param {string} currentUserId - The ID of the current user (who originally blocked)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const unblockUser = async (blockedUserId, currentUserId) => {
  try {
    // Delete the block
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', blockedUserId);

    if (error) {
      console.error('Error unblocking user:', error);
      return { success: false, error: 'Failed to unblock user' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in unblockUser:', error);
    return { success: false, error: 'An unexpected error occurred' };
  }
};

/**
 * Check if two users have a blocking relationship
 * Returns true if either user has blocked the other (mutual blocking)
 * 
 * @param {string} userId1 - First user ID
 * @param {string} userId2 - Second user ID
 * @returns {Promise<boolean>} - True if either user has blocked the other
 */
export const areUsersBlocked = async (userId1, userId2) => {
  try {
    // Use the database function for efficient checking
    const { data, error } = await supabase.rpc('is_blocked', {
      user1_id: userId1,
      user2_id: userId2
    });

    if (error) {
      console.error('Error checking block status:', error);
      // Fallback to manual check if RPC fails
      return await manualBlockCheck(userId1, userId2);
    }

    return data === true;
  } catch (error) {
    console.error('Error in areUsersBlocked:', error);
    return false;
  }
};

/**
 * Manual block check (fallback if RPC function fails)
 * Checks if either user has blocked the other
 */
const manualBlockCheck = async (userId1, userId2) => {
  try {
    const { data, error } = await supabase
      .from('blocks')
      .select('id')
      .or(`and(blocker_id.eq.${userId1},blocked_id.eq.${userId2}),and(blocker_id.eq.${userId2},blocked_id.eq.${userId1})`)
      .limit(1);

    if (error) {
      console.error('Error in manual block check:', error);
      return false;
    }

    return data && data.length > 0;
  } catch (error) {
    console.error('Error in manualBlockCheck:', error);
    return false;
  }
};

/**
 * Get all users blocked by the current user
 * Returns an array of user profiles that the current user has blocked
 * 
 * @param {string} currentUserId - The ID of the current user
 * @returns {Promise<Array>} - Array of blocked user profiles
 */
export const getBlockedUsers = async (currentUserId) => {
  try {
    // First, get all block records where current user is the blocker
    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', currentUserId)
      .order('created_at', { ascending: false });

    if (blocksError) {
      console.error('Error fetching blocks:', blocksError);
      return [];
    }

    if (!blocks || blocks.length === 0) {
      return [];
    }

    // Get the user IDs of all blocked users
    const blockedUserIds = blocks.map(block => block.blocked_id);

    // Fetch the profiles of blocked users
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, email')
      .in('id', blockedUserIds);

    if (profilesError) {
      console.error('Error fetching blocked user profiles:', profilesError);
      return [];
    }

    // Combine block data with profile data
    // Map each block to include the profile information and when it was created
    const blockedUsers = blocks.map(block => {
      const profile = profiles.find(p => p.id === block.blocked_id);
      return {
        ...profile,
        blocked_at: block.created_at,
        block_id: block.id // Store block ID for easy unblocking
      };
    }).filter(user => user.id); // Remove any entries without a profile

    return blockedUsers;
  } catch (error) {
    console.error('Error in getBlockedUsers:', error);
    return [];
  }
};

/**
 * Filter out blocked users from an array of user IDs
 * This is useful when displaying lists of users (e.g., in search results)
 * 
 * @param {Array<string>} userIds - Array of user IDs to filter
 * @param {string} currentUserId - The ID of the current user
 * @returns {Promise<Array<string>>} - Filtered array of user IDs (blocked users removed)
 */
export const filterBlockedUsers = async (userIds, currentUserId) => {
  try {
    if (!userIds || userIds.length === 0) {
      return [];
    }

    // Get all users blocked by current user
    const { data: blocks, error } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId)
      .in('blocked_id', userIds);

    if (error) {
      console.error('Error filtering blocked users:', error);
      return userIds; // Return original list if error (fail open)
    }

    // Get IDs of users who have blocked the current user
    const { data: blockers, error: blockersError } = await supabase
      .from('blocks')
      .select('blocker_id')
      .eq('blocked_id', currentUserId)
      .in('blocker_id', userIds);

    if (blockersError) {
      console.error('Error filtering blockers:', blockersError);
      // Continue with partial filtering
    }

    // Combine both sets of blocked relationships
    const blockedIds = new Set();
    blocks?.forEach(block => blockedIds.add(block.blocked_id));
    blockers?.forEach(block => blockedIds.add(block.blocker_id));

    // Filter out blocked users
    return userIds.filter(id => !blockedIds.has(id));
  } catch (error) {
    console.error('Error in filterBlockedUsers:', error);
    return userIds; // Return original list if error (fail open)
  }
};

/**
 * Add a filter to a Supabase query to exclude blocked users
 * This is a helper function that can be chained to Supabase queries
 * 
 * @param {object} query - Supabase query builder
 * @param {string} currentUserId - The ID of the current user
 * @param {string} userIdColumn - The column name for user ID (default: 'id')
 * @returns {object} - Modified query with block filtering applied
 */
export const excludeBlockedUsers = async (query, currentUserId, userIdColumn = 'id') => {
  try {
    // Get all blocked user IDs (both directions)
    const { data: blockedByMe, error: blockedError } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);

    const { data: blockedMe, error: blockersError } = await supabase
      .from('blocks')
      .select('blocker_id')
      .eq('blocked_id', currentUserId);

    if (blockedError || blockersError) {
      console.error('Error fetching blocked users for query filter:', blockedError || blockersError);
      return query; // Return original query if error
    }

    // Combine all blocked user IDs
    const blockedIds = new Set();
    blockedByMe?.forEach(block => blockedIds.add(block.blocked_id));
    blockedMe?.forEach(block => blockedIds.add(block.blocker_id));

    // If there are blocked users, exclude them from the query
    if (blockedIds.size > 0) {
      const blockedArray = Array.from(blockedIds);
      return query.not(userIdColumn, 'in', `(${blockedArray.map(id => `"${id}"`).join(',')})`);
    }

    return query;
  } catch (error) {
    console.error('Error in excludeBlockedUsers:', error);
    return query; // Return original query if error
  }
};

