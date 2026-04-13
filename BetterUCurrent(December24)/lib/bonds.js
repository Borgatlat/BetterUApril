/**
 * Bond Market API Functions
 * 
 * This module provides functions for purchasing, withdrawing, and managing bonds.
 * Bonds are investment instruments that provide weekly ROI based on maintaining
 * a daily activity streak.
 * 
 * Key Concepts:
 * - Bonds cost 500, 1000, or 5000 Neuros
 * - Interest rates increase each week (5%, 12%, 20%, 30%)
 * - Premium users get better rates (7%, 14%, 22%, 32%)
 * - Bonds can be withdrawn when active for 7, 14, 21, or 28 days
 * - Bonds are forfeited if daily activity streak is broken
 * - Interest rates are configurable via bond_config table (not hardcoded)
 */

import { supabase } from './supabase';

/**
 * Purchase a bond
 * 
 * This function deducts Neuros from the user's balance and creates a new bond record.
 * The bond starts at week 1 and can be withdrawn weekly after the purchase day.
 * 
 * @param {string} bondTier - The bond tier: 'tier_500', 'tier_1000', or 'tier_5000'
 * @returns {Promise<Object>} Result object with success status and bond details
 * 
 * Example:
 * const result = await purchaseBond('tier_1000');
 * if (result.success) {
 *   console.log('Bond purchased!', result.bond_id);
 * }
 */
export async function purchaseBond(bondTier) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate bond tier
    if (!['tier_500', 'tier_1000', 'tier_5000'].includes(bondTier)) {
      return { success: false, error: 'Invalid bond tier' };
    }

    // Call the database function to handle purchase
    // This function handles balance deduction, bond creation, and transaction recording atomically
    const { data, error } = await supabase.rpc('purchase_bond', {
      p_user_id: user.id,
      p_bond_tier: bondTier
    });

    if (error) {
      console.error('Error purchasing bond:', error);
      return { success: false, error: error.message || 'Failed to purchase bond' };
    }

    // The RPC function returns a JSONB object with success status
    if (data && data.success) {
      return {
        success: true,
        bondId: data.bond_id,
        bondAmount: data.bond_amount,
        newBalance: data.new_balance
      };
    } else {
      return {
        success: false,
        error: data?.error || 'Failed to purchase bond'
      };
    }
  } catch (error) {
    console.error('Exception purchasing bond:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Withdraw a bond
 * 
 * This function calculates the payout based on the current week and withdraws the bond.
 * The payout is added to the user's Neuros balance.
 * 
 * Important: Bonds can be withdrawn when active for 7, 14, 21, or 28 days.
 * If the user's streak is broken, the bond will be forfeited (no payout).
 * 
 * @param {string} bondId - The UUID of the bond to withdraw
 * @returns {Promise<Object>} Result object with success status and payout details
 * 
 * Example:
 * const result = await withdrawBond('bond-uuid-here');
 * if (result.success) {
 *   console.log('Bond withdrawn! Payout:', result.payout);
 * }
 */
export async function withdrawBond(bondId) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (!bondId) {
      return { success: false, error: 'Bond ID is required' };
    }

    // Call the database function to handle withdrawal
    // This function checks eligibility, calculates payout, updates balance, and records transaction
    const { data, error } = await supabase.rpc('withdraw_bond', {
      p_user_id: user.id,
      p_bond_id: bondId
    });

    if (error) {
      console.error('Error withdrawing bond:', error);
      return { success: false, error: error.message || 'Failed to withdraw bond' };
    }

    // The RPC function returns a JSONB object with success status
    if (data && data.success) {
      return {
        success: true,
        payout: data.payout,
        week: data.week,
        newBalance: data.new_balance
      };
    } else {
      // Check if bond was forfeited
      if (data?.forfeited) {
        return {
          success: false,
          error: data.error || 'Bond was forfeited due to broken streak',
          forfeited: true
        };
      }
      
      return {
        success: false,
        error: data?.error || 'Failed to withdraw bond',
        daysUntilWithdrawal: data?.days_until_withdrawal
      };
    }
  } catch (error) {
    console.error('Exception withdrawing bond:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

/**
 * Get all bonds for a user
 * 
 * Fetches all bonds (active, withdrawn, forfeited) for the current user or a specific user.
 * 
 * @param {string} userId - Optional user ID. If not provided, uses current user
 * @param {string} status - Optional filter: 'active', 'withdrawn', 'forfeited', or null for all
 * @returns {Promise<Array>} Array of bond objects
 * 
 * Example:
 * const activeBonds = await getUserBonds(null, 'active');
 * activeBonds.forEach(bond => {
 *   console.log(`Bond: ${bond.bond_amount} Neuros, Week ${bond.current_week}`);
 * });
 */
export async function getUserBonds(userId = null, status = null) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const targetUserId = userId || user?.id;

    if (!targetUserId) {
      return { success: false, error: 'User ID is required', bonds: [] };
    }

    // Check and forfeit bonds if streak is broken (only for current user, not when viewing others)
    // This ensures bonds are forfeited immediately when user opens app or views bonds
    if (!userId || userId === user?.id) {
      try {
        const { data: forfeitedCount, error: forfeitError } = await supabase.rpc('check_and_forfeit_user_bonds', {
          p_user_id: targetUserId
        });
        
        if (forfeitError) {
          console.warn('Error checking bond forfeiture:', forfeitError);
          // Don't fail the entire request if forfeiture check fails
        } else if (forfeitedCount > 0) {
          console.log(`Forfeited ${forfeitedCount} bond(s) due to broken streak`);
        }
      } catch (forfeitError) {
        console.warn('Exception checking bond forfeiture:', forfeitError);
        // Continue with fetching bonds even if forfeiture check fails
      }
    }

    // Build query
    let query = supabase
      .from('user_bonds')
      .select('*')
      .eq('user_id', targetUserId)
      .order('purchased_at', { ascending: false });

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bonds:', error);
      return { success: false, error: error.message, bonds: [] };
    }

    return { success: true, bonds: data || [] };
  } catch (error) {
    console.error('Exception fetching bonds:', error);
    return { success: false, error: error.message, bonds: [] };
  }
}

/**
 * Get bond configuration (interest rates)
 * 
 * Fetches the current interest rates for all bond tiers.
 * This is used to display rates in the store and bond management screens.
 * 
 * @returns {Promise<Object>} Object containing bond config for each tier
 * 
 * Example:
 * const config = await getBondConfig();
 * console.log('500 Neuros bond week 1 rate:', config.tier_500.week_1_rate);
 */
export async function getBondConfig() {
  try {
    const { data, error } = await supabase
      .from('bond_config')
      .select('*')
      .order('bond_tier');

    if (error) {
      console.error('Error fetching bond config:', error);
      return { success: false, error: error.message, config: {} };
    }

    // Transform array into object keyed by bond_tier for easier access
    const config = {};
    (data || []).forEach(item => {
      config[item.bond_tier] = item;
    });

    return { success: true, config };
  } catch (error) {
    console.error('Exception fetching bond config:', error);
    return { success: false, error: error.message, config: {} };
  }
}

/**
 * Check bond withdrawal eligibility
 * 
 * Checks if a bond can be withdrawn and returns eligibility information.
 * 
 * @param {string} bondId - The UUID of the bond to check
 * @returns {Promise<Object>} Eligibility information
 * 
 * Example:
 * const eligibility = await checkBondEligibility('bond-uuid');
 * if (eligibility.can_withdraw) {
 *   console.log('Can withdraw now!');
 * } else {
 *   console.log('Reason:', eligibility.reason);
 * }
 */
export async function checkBondEligibility(bondId) {
  try {
    if (!bondId) {
      return { success: false, error: 'Bond ID is required' };
    }

    const { data, error } = await supabase.rpc('get_bond_withdrawal_eligibility', {
      p_bond_id: bondId
    });

    if (error) {
      console.error('Error checking bond eligibility:', error);
      return { success: false, error: error.message };
    }

    // The RPC function returns a table, so data is an array with one row
    if (data && data.length > 0) {
      return {
        success: true,
        canWithdraw: data[0].can_withdraw,
        currentWeek: data[0].current_week,
        daysUntilWithdrawal: data[0].days_until_withdrawal,
        reason: data[0].reason
      };
    }

    return { success: false, error: 'No eligibility data returned' };
  } catch (error) {
    console.error('Exception checking bond eligibility:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Calculate bond payout for a given week
 * 
 * Helper function to calculate what the payout would be for a bond at a specific week.
 * Useful for displaying potential payouts in the UI.
 * 
 * @param {string} bondTier - The bond tier: 'tier_500', 'tier_1000', or 'tier_5000'
 * @param {number} weekNumber - The week number (1-4)
 * @param {boolean} isPremium - Whether the user is premium
 * @returns {Promise<number>} The payout amount
 * 
 * Example:
 * const payout = await calculateBondPayout('tier_1000', 4, true);
 * console.log('Week 4 payout for premium user:', payout); // 1320
 */
export async function calculateBondPayout(bondTier, weekNumber, isPremium = false) {
  try {
    const { data, error } = await supabase.rpc('calculate_bond_payout', {
      p_bond_tier: bondTier,
      p_week_number: weekNumber,
      p_is_premium: isPremium
    });

    if (error) {
      console.error('Error calculating bond payout:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception calculating bond payout:', error);
    return null;
  }
}
