/**
 * Bond Management Screen
 * 
 * This screen allows users to view and manage their bonds.
 * Users can see active bonds, check withdrawal eligibility, and withdraw bonds.
 * 
 * Key Features:
 * - View all active bonds with current week and potential payout
 * - Check withdrawal eligibility (7, 14, 21, or 28 days active)
 * - Withdraw bonds and receive payout
 * - View completed bonds (withdrawn/forfeited)
 * - See streak status warnings
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  RefreshControl,
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../../context/UserContext';
import { useAuth } from '../../context/AuthContext';
import { getUserBonds, withdrawBond, checkBondEligibility, calculateBondPayout } from '../../lib/bonds';
import { getStreakStatus } from '../../utils/streakHelpers';

export default function BondsScreen() {
  const router = useRouter();
  const { userProfile } = useUser();
  const { user } = useAuth();
  const [activeBonds, setActiveBonds] = useState([]);
  const [readyToWithdrawBonds, setReadyToWithdrawBonds] = useState([]);
  const [completedBonds, setCompletedBonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawing, setWithdrawing] = useState(null); // Track which bond is being withdrawn
  const [streakStatus, setStreakStatus] = useState(null);
  const [showBondCertificate, setShowBondCertificate] = useState(false);
  const [selectedBondForCertificate, setSelectedBondForCertificate] = useState(null);

  // Calculate summary statistics
  const bondStats = useMemo(() => {
    const allActiveBonds = [...activeBonds, ...readyToWithdrawBonds];
    const totalInvested = allActiveBonds.reduce((sum, bond) => sum + bond.bond_amount, 0);
    const totalPotentialPayout = allActiveBonds.reduce((sum, bond) => {
      const rates = bond.interest_rates_applied || {};
      const week4Rate = rates.week_4 || 0.30;
      return sum + Math.round(bond.bond_amount * (1 + week4Rate));
    }, 0);
    // Calculate earnings from withdrawn bonds (positive)
    const withdrawnEarnings = completedBonds
      .filter(b => b.status === 'withdrawn' && b.final_payout)
      .reduce((sum, bond) => sum + (bond.final_payout - bond.bond_amount), 0);
    
    // Calculate losses from forfeited bonds (negative - full bond amount lost)
    const forfeitedLosses = completedBonds
      .filter(b => b.status === 'forfeited')
      .reduce((sum, bond) => sum - bond.bond_amount, 0);
    
    // Total earned = withdrawn earnings - forfeited losses (can be negative)
    const totalEarned = withdrawnEarnings + forfeitedLosses;
    
    return {
      totalInvested,
      totalPotentialPayout,
      totalEarned,
      activeCount: allActiveBonds.length,
      completedCount: completedBonds.length
    };
  }, [activeBonds, readyToWithdrawBonds, completedBonds]);

  // Fetch bonds and streak status
  const fetchBonds = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      // Fetch bonds
      const bondsResult = await getUserBonds(user.id);
      if (bondsResult.success) {
        const bonds = bondsResult.bonds || [];
        const active = bonds.filter(b => b.status === 'active');
        
        // Separate active bonds into regular active and ready to withdraw (28+ days)
        const now = new Date();
        const readyToWithdraw = active.filter(bond => {
          const purchaseDate = new Date(bond.purchased_at);
          const daysActive = Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24));
          return daysActive >= 28;
        });
        const stillActive = active.filter(bond => {
          const purchaseDate = new Date(bond.purchased_at);
          const daysActive = Math.floor((now - purchaseDate) / (1000 * 60 * 60 * 24));
          return daysActive < 28;
        });
        
        setActiveBonds(stillActive);
        setReadyToWithdrawBonds(readyToWithdraw);
        setCompletedBonds(bonds.filter(b => b.status !== 'active'));
      }

      // Fetch streak status
      const streak = await getStreakStatus(user.id);
      if (streak) {
        setStreakStatus(streak);
      }
    } catch (error) {
      console.error('Error fetching bonds:', error);
      Alert.alert('Error', 'Failed to load bonds. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBonds();
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBonds();
  };

  /**
   * Handle bond withdrawal
   * Checks eligibility, confirms with user, then withdraws the bond
   */
  const handleWithdraw = async (bond) => {
    if (!bond || !user?.id) return;

    // Check eligibility first
    const eligibility = await checkBondEligibility(bond.id);
    
    if (!eligibility.success) {
      Alert.alert('Error', eligibility.error || 'Failed to check bond eligibility');
      return;
    }

    if (!eligibility.canWithdraw) {
      Alert.alert(
        'Cannot Withdraw',
        eligibility.reason || 'This bond cannot be withdrawn at this time.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Calculate potential payout
    const isPremium = userProfile?.is_premium || false;
    const rates = bond.interest_rates_applied || {};
    const weekRate = rates[`week_${eligibility.currentWeek}`] || rates.week_4;
    const payout = await calculateBondPayout(bond.bond_tier, eligibility.currentWeek, isPremium);

    // Confirm withdrawal
    Alert.alert(
      'Withdraw Bond',
      `Withdraw this bond now?\n\nWeek: ${eligibility.currentWeek}/4\nPayout: ${payout?.toLocaleString() || 'Calculating...'} Neuros\n\nNote: You must maintain your streak to receive the payout.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'default',
          onPress: async () => {
            setWithdrawing(bond.id);
            try {
              const result = await withdrawBond(bond.id);
              
              if (result.success) {
                Alert.alert(
                  'Bond Withdrawn!',
                  `You received ${result.payout.toLocaleString()} Neuros!\n\nNew balance: ${result.newBalance.toLocaleString()} Neuros`,
                  [{ text: 'OK', onPress: () => fetchBonds() }]
                );
              } else if (result.forfeited) {
                Alert.alert(
                  'Bond Forfeited',
                  result.error || 'Your bond was forfeited because your daily activity streak was broken.',
                  [{ text: 'OK', onPress: () => fetchBonds() }]
                );
              } else {
                Alert.alert('Withdrawal Failed', result.error || 'Failed to withdraw bond. Please try again.');
              }
            } catch (error) {
              console.error('Error withdrawing bond:', error);
              Alert.alert('Error', 'An unexpected error occurred. Please try again.');
            } finally {
              setWithdrawing(null);
            }
          }
        }
      ]
    );
  };

  /**
   * Get day name from day of week number
   */
  const getDayName = (dayOfWeek) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayOfWeek] || 'Unknown';
  };

  /**
   * Format date nicely for display in a compact format
   * Returns format like "Jan 15" or "Today", "Yesterday"
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    // Check if it's today
    if (dateOnly.getTime() === today.getTime()) {
      return 'Today';
    }
    
    // Check if it's yesterday
    if (dateOnly.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    }
    
    // Otherwise format as "Month Day" (compact, no year)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  /**
   * Calculate days active since bond purchase
   */
  const getDaysActive = (purchasedAt) => {
    if (!purchasedAt) return 0;
    const purchaseDate = new Date(purchasedAt);
    const today = new Date();
    const diffTime = today - purchaseDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  /**
   * Check if bond can be withdrawn based on days active (7, 14, 21, or 28+ days)
   */
  const canWithdrawOnDay = (daysActive) => {
    return daysActive >= 7 && (daysActive === 7 || daysActive === 14 || daysActive === 21 || daysActive >= 28);
  };

  /**
   * Get days until next withdrawal milestone (7, 14, 21, or 28 days)
   */
  const getDaysUntilNextWithdrawal = (daysActive) => {
    if (daysActive < 7) return 7 - daysActive;
    if (daysActive < 14) return 14 - daysActive;
    if (daysActive < 21) return 21 - daysActive;
    if (daysActive < 28) return 28 - daysActive;
    return 0; // 28+ days - can withdraw anytime
  };

  /**
   * Render active bond card
   */
  const renderActiveBond = (bond) => {
    const isPremium = bond.interest_rates_applied?.is_premium || false;
    const rates = bond.interest_rates_applied || {};
    
    // Calculate potential payouts for each week
    const week1Payout = Math.round(bond.bond_amount * (1 + (rates.week_1 || 0.05)));
    const week4Payout = Math.round(bond.bond_amount * (1 + (rates.week_4 || 0.30)));
    
    // Calculate days active and withdrawal eligibility
    const daysActive = getDaysActive(bond.purchased_at);
    const canWithdrawToday = canWithdrawOnDay(daysActive);
    const daysUntilNextWithdrawal = getDaysUntilNextWithdrawal(daysActive);
    const isReadyToWithdraw = daysActive >= 28;
    
    // Check streak status
    const isStreakAtRisk = streakStatus?.isAtRisk || false;
    const hasActivityToday = streakStatus?.hasActivityToday || false;

    // Calculate day-based progress (0-28 days = 0-100%)
    const dayProgress = Math.min(daysActive / 28, 1);
    const badgeOpacity = 0.2 + (dayProgress * 0.3);
    const badgeBackgroundColor = `rgba(0, 255, 255, ${badgeOpacity})`;

    // Calculate current payout amount
    const currentPayout = bond.current_week === 0 
      ? bond.bond_amount
      : Math.round(bond.bond_amount * (1 + (rates[`week_${bond.current_week}`] || rates.week_4 || 0.30)));
    const potentialEarnings = currentPayout - bond.bond_amount;
    const maxEarnings = week4Payout - bond.bond_amount;

    return (
      <View key={bond.id} style={styles.bondCard}>
        {/* Compact Header */}
        <View style={styles.bondCardHeader}>
          <View style={styles.bondHeaderLeft}>
            <View style={styles.bondIconContainer}>
              <Ionicons name="trending-up" size={24} color="#00ffff" />
            </View>
            <View style={styles.bondHeaderInfo}>
              <View style={styles.bondAmountRow}>
                <Text style={styles.bondCardAmount}>{bond.bond_amount.toLocaleString()}</Text>
                <Text style={styles.bondCardAmountLabel}>Neuros</Text>
                {isPremium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={10} color="#FFD700" />
                    <Text style={styles.premiumBadgeText}>Premium</Text>
                  </View>
                )}
              </View>
              <Text style={styles.bondFooterText}>
                {formatDate(bond.purchased_at)} • {daysActive} day{daysActive !== 1 ? 's' : ''} active
              </Text>
            </View>
          </View>
          <View style={[styles.weekBadge, { backgroundColor: badgeBackgroundColor }]}>
            <Text style={styles.weekBadgeText}>
              {daysActive}/28
            </Text>
            <Text style={styles.weekBadgeSubtext}>days</Text>
          </View>
        </View>

        <View style={styles.bondCardContent}>
          {/* Main Value Display */}
          <View style={styles.mainValueSection}>
            <View style={styles.currentValueCard}>
              <Text style={styles.currentValueLabel}>Current Value</Text>
              <Text style={styles.currentValueAmount}>
                {currentPayout.toLocaleString()} <Text style={styles.currentValueUnit}>Neuros</Text>
              </Text>
              {bond.current_week > 0 && (
                <Text style={styles.currentValueGain}>
                  +{potentialEarnings.toLocaleString()} ({((potentialEarnings / bond.bond_amount) * 100).toFixed(0)}%)
                </Text>
              )}
            </View>
            <View style={styles.maxValueCard}>
              <Text style={styles.maxValueLabel}>Max at 28 days</Text>
              <Text style={styles.maxValueAmount}>
                {week4Payout.toLocaleString()} <Text style={styles.maxValueUnit}>Neuros</Text>
              </Text>
              <Text style={styles.maxValueGain}>
                +{maxEarnings.toLocaleString()} ({((maxEarnings / bond.bond_amount) * 100).toFixed(0)}%)
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progress to Maturity</Text>
              <Text style={styles.progressPercentage}>{Math.round(dayProgress * 100)}%</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${dayProgress * 100}%` }
                  ]} 
                />
              </View>
              <View style={styles.progressMarkers}>
                {[7, 14, 21, 28].map((day) => (
                  <View 
                    key={day} 
                    style={[
                      styles.progressMarker,
                      daysActive >= day && styles.progressMarkerActive
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* Interest Rates - Compact Grid */}
          <View style={styles.ratesSection}>
            <Text style={styles.ratesTitle}>Interest Rates</Text>
            <View style={styles.ratesGrid}>
              {[1, 2, 3, 4].map((week) => {
                const weekRate = isPremium 
                  ? (rates[`premium_week_${week}`] || rates[`week_${week}`] || 0.05 + (week - 1) * 0.07)
                  : (rates[`week_${week}`] || 0.05 + (week - 1) * 0.07);
                const weekPayout = Math.round(bond.bond_amount * (1 + weekRate));
                const isCurrentWeek = bond.current_week === week;
                
                return (
                  <View 
                    key={week} 
                    style={[
                      styles.rateItem,
                      isCurrentWeek && styles.rateItemActive
                    ]}
                  >
                    <Text style={styles.rateWeekLabel}>Week {week}</Text>
                    <Text style={styles.ratePercentage}>{(weekRate * 100).toFixed(0)}%</Text>
                    <Text style={styles.ratePayout}>{weekPayout.toLocaleString()}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Streak Warning */}
          {(!hasActivityToday || isStreakAtRisk) && (
            <View style={styles.streakWarning}>
              <Ionicons name="warning" size={16} color="#ff9800" />
              <Text style={styles.streakWarningText}>
                {!hasActivityToday 
                  ? 'Complete an activity today to protect your bond!'
                  : 'Streak at risk - complete an activity soon!'
                }
              </Text>
            </View>
          )}

          {/* Issued by BetterU Badge */}
          <View style={styles.issuedByBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#00ffff" />
            <Text style={styles.issuedByText}>Issued by BetterU</Text>
          </View>

          {/* Withdraw Button */}
            <TouchableOpacity
              style={[
                styles.withdrawButton,
                ((!canWithdrawToday && !isReadyToWithdraw) || withdrawing === bond.id) && styles.withdrawButtonDisabled
              ]}
              onPress={() => handleWithdraw(bond)}
              disabled={(!canWithdrawToday && !isReadyToWithdraw) || withdrawing === bond.id}
              activeOpacity={0.8}
            >
              {withdrawing === bond.id ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons 
                    name={(canWithdrawToday || isReadyToWithdraw) ? "cash" : "time-outline"} 
                    size={18} 
                    color="#000" 
                  />
                  <Text style={styles.withdrawButtonText}>
                    {daysActive < 7
                      ? `${7 - daysActive} day${7 - daysActive > 1 ? 's' : ''} until first withdrawal`
                      : isReadyToWithdraw
                        ? 'Withdraw Now'
                        : canWithdrawToday 
                          ? 'Withdraw Now' 
                          : `${daysUntilNextWithdrawal} day${daysUntilNextWithdrawal > 1 ? 's' : ''} until next milestone`
                    }
                  </Text>
                  {(canWithdrawToday || isReadyToWithdraw) && (
                    <Ionicons name="chevron-forward" size={16} color="#000" />
                  )}
                </>
              )}
            </TouchableOpacity>
          
          {/* View Bond Certificate Button */}
          <TouchableOpacity
            style={styles.viewBondButton}
            onPress={() => {
              setSelectedBondForCertificate(bond);
              setShowBondCertificate(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={16} color="#00ffff" />
            <Text style={styles.viewBondButtonText}>View Bond Certificate</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  /**
   * Render completed bond card - matches active bond style
   */
  const renderCompletedBond = (bond) => {
    const isWithdrawn = bond.status === 'withdrawn';
    const isForfeited = bond.status === 'forfeited';
    const isPremium = bond.interest_rates_applied?.is_premium || false;
    const rates = bond.interest_rates_applied || {};

    const earnings = isWithdrawn && bond.final_payout 
      ? bond.final_payout - bond.bond_amount 
      : 0;

    // Calculate days active (from purchase to withdrawal/forfeiture)
    const endDate = isWithdrawn ? bond.withdrawn_at : (isForfeited ? bond.forfeited_at : bond.purchased_at);
    const daysActive = Math.floor((new Date(endDate) - new Date(bond.purchased_at)) / (1000 * 60 * 60 * 24));

    return (
      <View key={bond.id} style={[styles.bondCard, styles.completedBondCard]}>
        {/* Compact Header - Same as Active */}
        <View style={styles.bondCardHeader}>
          <View style={styles.bondHeaderLeft}>
            <View style={[
              styles.bondIconContainer,
              { 
                backgroundColor: isWithdrawn ? 'rgba(0, 255, 0, 0.15)' : 'rgba(255, 68, 68, 0.15)',
                borderColor: isWithdrawn ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 68, 68, 0.3)'
              }
            ]}>
              <Ionicons 
                name={isWithdrawn ? "checkmark-circle" : "close-circle"} 
                size={24} 
                color={isWithdrawn ? "#00ff00" : "#ff4444"} 
              />
            </View>
            <View style={styles.bondHeaderInfo}>
              <View style={styles.bondAmountRow}>
                <Text style={styles.bondCardAmount}>{bond.bond_amount.toLocaleString()}</Text>
                <Text style={styles.bondCardAmountLabel}>Neuros</Text>
                {isPremium && (
                  <View style={styles.premiumBadge}>
                    <Ionicons name="star" size={10} color="#FFD700" />
                    <Text style={styles.premiumBadgeText}>Premium</Text>
                  </View>
                )}
              </View>
              <Text style={styles.bondFooterText}>
                {formatDate(bond.purchased_at)} • {daysActive} day{daysActive !== 1 ? 's' : ''} active
              </Text>
            </View>
          </View>
          <View style={[
            styles.weekBadge,
            { 
              backgroundColor: isWithdrawn ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'
            }
          ]}>
            <Text style={[
              styles.weekBadgeText,
              { color: isWithdrawn ? '#00ff00' : '#ff4444' }
            ]}>
              {isWithdrawn ? 'Completed' : 'Forfeited'}
            </Text>
          </View>
        </View>

        <View style={styles.bondCardContent}>
          {/* Main Value Display - Same as Active */}
          {isWithdrawn && bond.final_payout ? (
            <View style={styles.mainValueSection}>
              <View style={[styles.currentValueCard, { backgroundColor: 'rgba(0, 255, 0, 0.08)' }]}>
                <Text style={styles.currentValueLabel}>Initial Investment</Text>
                <Text style={styles.currentValueAmount}>
                  {bond.bond_amount.toLocaleString()} <Text style={styles.currentValueUnit}>Neuros</Text>
                </Text>
              </View>
              <View style={[styles.maxValueCard, { backgroundColor: 'rgba(0, 255, 255, 0.12)' }]}>
                <Text style={styles.maxValueLabel}>Final Payout</Text>
                <Text style={[styles.maxValueAmount, { color: '#00ffff' }]}>
                  {bond.final_payout.toLocaleString()} <Text style={styles.maxValueUnit}>Neuros</Text>
                </Text>
                <Text style={[styles.maxValueGain, { color: '#00ffff' }]}>
                  +{earnings.toLocaleString()} ({((earnings / bond.bond_amount) * 100).toFixed(0)}%)
                </Text>
              </View>
            </View>
          ) : isForfeited ? (
            <View style={styles.forfeitedCard}>
              <Ionicons name="alert-circle" size={20} color="#ff4444" />
              <View style={styles.forfeitedContent}>
                <Text style={styles.forfeitedTitle}>Bond Forfeited</Text>
                <Text style={styles.forfeitedText}>
                  This bond was forfeited because your daily activity streak was broken.
                </Text>
              </View>
            </View>
          ) : null}

          {/* Interest Rates - Same as Active */}
          <View style={styles.ratesSection}>
            <Text style={styles.ratesTitle}>Interest Rates Applied</Text>
            <View style={styles.ratesGrid}>
              {[1, 2, 3, 4].map((week) => {
                const weekRate = isPremium 
                  ? (rates[`premium_week_${week}`] || rates[`week_${week}`] || 0.05 + (week - 1) * 0.07)
                  : (rates[`week_${week}`] || 0.05 + (week - 1) * 0.07);
                const weekPayout = Math.round(bond.bond_amount * (1 + weekRate));
                const wasReached = bond.current_week >= week;
                
                return (
                  <View 
                    key={week} 
                    style={[
                      styles.rateItem,
                      wasReached && styles.rateItemActive,
                      !wasReached && { opacity: 0.4 }
                    ]}
                  >
                    <Text style={styles.rateWeekLabel}>Week {week}</Text>
                    <Text style={styles.ratePercentage}>{(weekRate * 100).toFixed(0)}%</Text>
                    <Text style={styles.ratePayout}>{weekPayout.toLocaleString()}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Issued by BetterU Badge */}
          <View style={styles.issuedByBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#00ffff" />
            <Text style={styles.issuedByText}>Issued by BetterU</Text>
          </View>

          {/* View Bond Certificate Button */}
          <TouchableOpacity
            style={styles.viewBondButton}
            onPress={() => {
              setSelectedBondForCertificate(bond);
              setShowBondCertificate(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={16} color="#00ffff" />
            <Text style={styles.viewBondButtonText}>View Bond Certificate</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // Early return for loading state
  if (loading && activeBonds.length === 0 && readyToWithdrawBonds.length === 0 && completedBonds.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#00ffff" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>My Bonds</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text style={styles.loadingText}>Loading bonds...</Text>
        </View>
      </View>
    );
  }

  return (
  <View style={styles.container}>
    {/* Header */}
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#00ffff" />
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.title}>My Bonds</Text>
      <View style={styles.placeholder} />
    </View>

    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#00ffff"
        />
      }
    >
      {/* Summary Stats Card */}
      {(activeBonds.length > 0 || readyToWithdrawBonds.length > 0 || completedBonds.length > 0) && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Portfolio Overview</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryStatCard}>
              <Text style={styles.summaryStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {bondStats.activeCount}
              </Text>
              <Text style={styles.summaryStatLabel}>Active</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Text style={styles.summaryStatValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {bondStats.totalInvested.toLocaleString()}
              </Text>
              <Text style={styles.summaryStatLabel}>Invested</Text>
            </View>
            <View style={styles.summaryStatCard}>
              <Text style={[styles.summaryStatValue, styles.summaryStatValueEarned, bondStats.totalEarned < 0 && styles.summaryStatValueLoss]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
                {bondStats.totalEarned >= 0 ? '+' : ''}{bondStats.totalEarned.toLocaleString()}
              </Text>
              <Text style={styles.summaryStatLabel}>Earned</Text>
            </View>
          </View>
        </View>
      )}

      {/* Ready to Withdraw Section */}
      {readyToWithdrawBonds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="checkmark-circle" size={22} color="#00ff00" />
              <Text style={styles.sectionTitle}>Ready to Withdraw</Text>
            </View>
            <View style={[styles.sectionBadge, { backgroundColor: 'rgba(0, 255, 0, 0.2)' }]}>
              <Text style={[styles.sectionBadgeText, { color: '#00ff00' }]}>{readyToWithdrawBonds.length}</Text>
            </View>
          </View>
          {readyToWithdrawBonds.map(renderActiveBond)}
        </View>
      )}

      {/* Active Bonds Section */}
      {activeBonds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="trending-up" size={22} color="#00ffff" />
              <Text style={styles.sectionTitle}>Active Bonds</Text>
            </View>
            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{activeBonds.length}</Text>
            </View>
          </View>
          {activeBonds.map(renderActiveBond)}
        </View>
      )}

      {/* Completed Bonds Section */}
      {completedBonds.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <Ionicons name="checkmark-done-circle" size={22} color="#888" />
              <Text style={[styles.sectionTitle, styles.completedSectionTitle]}>Completed Bonds</Text>
            </View>
            <View style={[styles.sectionBadge, styles.completedSectionBadge]}>
              <Text style={styles.sectionBadgeText}>{completedBonds.length}</Text>
            </View>
          </View>
          {completedBonds.map(renderCompletedBond)}
        </View>
      )}

      {/* Empty State */}
      {activeBonds.length === 0 && readyToWithdrawBonds.length === 0 && completedBonds.length === 0 && !loading && (
        <View style={styles.emptyState}>
          <View style={styles.emptyStateIconContainer}>
            <Ionicons name="trending-up-outline" size={80} color="#00ffff" />
          </View>
          <Text style={styles.emptyStateTitle}>Start Your Bond Portfolio</Text>
          <Text style={styles.emptyStateText}>
            Invest your Neuros in bonds and earn weekly returns!{'\n\n'}
            • Start with 500, 1,000, or 5,000 Neuros{'\n'}
            • Earn up to 30% return over 4 weeks{'\n'}
            • Premium users get better rates{'\n'}
            • Maintain your streak to protect your investment
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => router.push('/store')}
            activeOpacity={0.8}
          >
            <Ionicons name="storefront" size={20} color="#000" />
            <Text style={styles.emptyStateButtonText}>Browse Bonds in Store</Text>
            <Ionicons name="chevron-forward" size={18} color="#000" />
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>

    {/* Bond Certificate Modal */}
    <Modal
      visible={showBondCertificate}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowBondCertificate(false)}
    >
      <View style={styles.certificateModalBackdrop}>
        <View style={styles.certificateContainer}>
          {selectedBondForCertificate ? (
            <>
              <ScrollView 
                style={styles.certificateScroll}
                contentContainerStyle={styles.certificateScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Certificate Header */}
                <View style={styles.certificateHeader}>
                  <View style={styles.certificateSeal}>
                    <Ionicons name="shield" size={30} color="#1a237e" />
                  </View>
                  <Text style={styles.certificateTitle}>BETTERU BOND CERTIFICATE</Text>
                  <Text style={styles.certificateSubtitle}>Digital Investment Security</Text>
                </View>

                {/* Certificate Body */}
                <View style={styles.certificateBody}>
                  {/* Bond Details */}
                  <View style={styles.certificateSection}>
                    <Text style={styles.certificateLabel}>BOND SERIES</Text>
                    <Text style={styles.certificateValue}>BetterU Neuro Investment Series {selectedBondForCertificate.bond_tier}</Text>
                  </View>

                  <View style={styles.certificateSection}>
                    <Text style={styles.certificateLabel}>FACE VALUE</Text>
                    <Text style={styles.certificateValueLarge}>{selectedBondForCertificate.bond_amount.toLocaleString()} Neuros</Text>
                  </View>

                  <View style={styles.certificateRow}>
                    <View style={styles.certificateSectionHalf}>
                      <Text style={styles.certificateLabel}>ISSUE DATE</Text>
                      <Text style={styles.certificateValue}>{new Date(selectedBondForCertificate.purchased_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</Text>
                    </View>
                    <View style={styles.certificateSectionHalf}>
                      <Text style={styles.certificateLabel}>BOND ID</Text>
                      <Text style={styles.certificateValue}>{selectedBondForCertificate.id.substring(0, 8).toUpperCase()}</Text>
                    </View>
                  </View>

                  {selectedBondForCertificate.status === 'withdrawn' && selectedBondForCertificate.withdrawn_at && (
                    <View style={styles.certificateSection}>
                      <Text style={styles.certificateLabel}>MATURITY DATE</Text>
                      <Text style={styles.certificateValue}>{new Date(selectedBondForCertificate.withdrawn_at).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</Text>
                    </View>
                  )}

                  {selectedBondForCertificate.status === 'withdrawn' && selectedBondForCertificate.final_payout && (
                    <View style={styles.certificateSection}>
                      <Text style={styles.certificateLabel}>REDEMPTION VALUE</Text>
                      <Text style={styles.certificateValueLarge}>{selectedBondForCertificate.final_payout.toLocaleString()} Neuros</Text>
                    </View>
                  )}

                  {/* Interest Schedule */}
                  <View style={styles.certificateSection}>
                    <Text style={styles.certificateLabel}>INTEREST SCHEDULE</Text>
                    <View style={styles.certificateInterestGrid}>
                      {[1, 2, 3, 4].map((week) => {
                        const rates = selectedBondForCertificate.interest_rates_applied || {};
                        const isPremium = rates.is_premium || false;
                        const weekRate = isPremium 
                          ? (rates[`premium_week_${week}`] || rates[`week_${week}`] || 0.05 + (week - 1) * 0.07)
                          : (rates[`week_${week}`] || 0.05 + (week - 1) * 0.07);
                        const weekPayout = Math.round(selectedBondForCertificate.bond_amount * (1 + weekRate));
                        
                        return (
                          <View key={week} style={styles.certificateInterestItem}>
                            <Text style={styles.certificateInterestWeek}>Week {week}</Text>
                            <Text style={styles.certificateInterestRate}>{(weekRate * 100).toFixed(0)}%</Text>
                            <Text style={styles.certificateInterestPayout}>{weekPayout.toLocaleString()} N</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  {/* Contract Terms */}
                  <View style={styles.certificateContractSection}>
                    <Text style={styles.certificateContractTitle}>TERMS AND CONDITIONS</Text>
                    <Text style={styles.certificateContractText}>
                      This BetterU Bond Certificate represents a digital investment security issued by BetterU. 
                      The bondholder is entitled to receive interest payments based on the schedule above, 
                      provided that the daily activity streak requirement is maintained throughout the bond's 
                      maturity period.{'\n\n'}
                      The bond may be withdrawn at 7, 14, 21, or 28 days after issuance, with interest 
                      calculated based on the withdrawal date. Failure to maintain the daily activity streak 
                      will result in immediate forfeiture of the bond and all accrued interest.{'\n\n'}
                      This certificate is non-transferable and is valid only for the original purchaser. 
                      All transactions are recorded on the BetterU blockchain ledger for security and transparency.
                    </Text>
                  </View>

                  {/* Barcode Section */}
                  <View style={styles.certificateBarcodeSection}>
                    <View style={styles.certificateBarcodeContainer}>
                      <View style={styles.certificateBarcode}>
                        {Array.from({ length: 60 }).map((_, i) => {
                          // Create a realistic barcode pattern with consistent spacing
                          const widths = [1, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 1, 2, 4, 1, 2, 3, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3];
                          const heights = [40, 50, 35, 55, 40, 45, 60, 40, 50, 52, 40, 45, 40, 55, 50, 40, 60, 40, 50, 52, 40, 45, 40, 55, 40, 45, 60, 40, 50, 52, 40, 45, 40, 55, 50, 40, 60, 40, 50, 52, 40, 45, 40, 55, 40, 45, 60, 40, 50, 52, 40, 45, 40, 55, 50, 40, 60, 40, 50, 52];
                          return (
                            <View 
                              key={i} 
                              style={[
                                styles.barcodeLine,
                                { 
                                  height: heights[i % heights.length],
                                  width: widths[i % widths.length]
                                }
                              ]} 
                            />
                          );
                        })}
                      </View>
                    </View>
                    <Text style={styles.certificateBarcodeText}>
                      {selectedBondForCertificate.id.substring(0, 8).toUpperCase()}-{selectedBondForCertificate.bond_amount}-{selectedBondForCertificate.bond_tier}
                    </Text>
                  </View>

                  {/* Footer */}
                  <View style={styles.certificateFooter}>
                    <Text style={styles.certificateFooterText}>DISTRIBUTED BY BETTERU</Text>
                    <Text style={styles.certificateFooterSubtext}>Digital Investment Platform</Text>
                    <Text style={styles.certificateFooterSubtext}>This is a digital certificate. Not redeemable for legal tender.</Text>
                  </View>

                  {/* Disclaimer */}
                  <View style={styles.certificateDisclaimer}>
                    <Text style={styles.certificateDisclaimerText}>
                      This certificate is a digital representation for entertainment purposes only. 
                      It does not represent a real financial instrument and has no monetary value. 
                      This is a simulated bond certificate within the BetterU application ecosystem.
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.certificateCloseButton}
                onPress={() => setShowBondCertificate(false)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={24} color="#fff" />
                <Text style={styles.certificateCloseText}>Close</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.certificateLoadingContainer}>
              <ActivityIndicator size="large" color="#00ffff" />
              <Text style={styles.certificateLoadingText}>Loading certificate...</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  </View>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#aaa',
    marginTop: 16,
  },
  // Summary Card Styles
  summaryCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  summaryTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 10,
  },
  summaryStatCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  summaryStatValue: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
    maxWidth: '100%',
  },
  summaryStatValueEarned: {
    color: '#00ff00',
  },
  summaryStatValueLoss: {
    color: '#ff4444', // Red for losses
  },
  summaryStatLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  completedSectionTitle: {
    color: '#888',
  },
  sectionBadge: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  completedSectionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sectionBadgeText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '700',
  },
  bondCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  completedBondCard: {
    opacity: 0.7,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  bondCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  bondHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bondIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  bondHeaderInfo: {
    flex: 1,
  },
  bondAmountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  bondCardAmount: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  bondCardAmountLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  bondFooterText: {
    color: '#fff',
    fontSize: 11,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  premiumBadgeText: {
    color: '#FFD700',
    fontSize: 9,
    fontWeight: '700',
  },
  weekBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 60,
  },
  weekBadgeText: {
    color: '#00ffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  weekBadgeSubtext: {
    color: '#00ffff',
    fontSize: 9,
    opacity: 0.8,
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bondCardContent: {
    padding: 16,
    gap: 14,
  },
  // Main Value Section
  mainValueSection: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  currentValueCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 0, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.2)',
  },
  currentValueLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  currentValueAmount: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  currentValueUnit: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '500',
  },
  currentValueGain: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: '600',
  },
  maxValueCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  maxValueLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  maxValueAmount: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  maxValueUnit: {
    fontSize: 12,
    color: '#aaa',
    fontWeight: '500',
  },
  maxValueGain: {
    color: '#00ffff',
    fontSize: 11,
    fontWeight: '600',
  },
  // Progress Section
  progressSection: {
    marginBottom: 4,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
  },
  progressPercentage: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  progressBarContainer: {
    position: 'relative',
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#00ffff',
    borderRadius: 4,
  },
  progressMarkers: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 1,
  },
  progressMarker: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 1.5,
  },
  progressMarkerActive: {
    backgroundColor: '#00ffff',
  },
  // Interest Rates Section
  ratesSection: {
    marginBottom: 4,
  },
  ratesTitle: {
    color: '#aaa',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratesGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  rateItem: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  rateItemActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  rateWeekLabel: {
    color: '#888',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratePercentage: {
    color: '#00ff00',
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  ratePayout: {
    color: '#aaa',
    fontSize: 9,
  },
  // Streak Warning
  streakWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  streakWarningText: {
    color: '#ff9800',
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
  },
  // Withdraw Button
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 4,
  },
  withdrawButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.6,
  },
  withdrawButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  // Issued by BetterU Badge
  issuedByBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  issuedByText: {
    color: '#00ffff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // View Bond Button
  viewBondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  viewBondButtonText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  bondCardFooter: {
    marginTop: 4,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bondCardFooterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bondCardFooterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    gap: 16,
  },
  bondCardFooterItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flexShrink: 1,
    minWidth: 100,
    maxWidth: '100%',
  },
  bondCardFooterIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  bondCardFooterTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  bondCardFooterLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  bondCardFooterValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  bondCardFooterText: {
    color: '#888',
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
    flexShrink: 1,
  },
  // Completed Bond Styles
  completedEarningsCard: {
    backgroundColor: 'rgba(0, 255, 0, 0.08)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.2)',
    marginBottom: 12,
  },
  completedEarningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedEarningsItem: {
    flex: 1,
    alignItems: 'center',
  },
  completedEarningsDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 12,
  },
  completedEarningsLabel: {
    color: '#aaa',
    fontSize: 11,
    marginBottom: 6,
    textAlign: 'center',
  },
  completedEarningsValue: {
    color: '#bbb',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  completedEarningsValueFinal: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: 'bold',
  },
  completedEarningsProfit: {
    color: '#00ff00',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  completedEarningsPercent: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
  },
  forfeitedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.3)',
    marginBottom: 12,
  },
  forfeitedContent: {
    flex: 1,
  },
  forfeitedTitle: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
  },
  forfeitedText: {
    color: '#ff6666',
    fontSize: 12,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyStateIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  emptyStateText: {
    color: '#aaa',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyStateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00ffff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  emptyStateButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  // Bond Certificate Modal Styles
  certificateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  certificateContainer: {
    width: '100%',
    maxWidth: 600,
    height: '90%',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#1a237e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  certificateScroll: {
    flex: 1,
  },
  certificateLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  certificateLoadingText: {
    color: '#000',
    fontSize: 16,
    marginTop: 16,
  },
  certificateScrollContent: {
    padding: 20,
  },
  certificateHeader: {
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#1a237e',
    paddingBottom: 15,
  },
  certificateSeal: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 3,
    borderColor: '#1a237e',
  },
  certificateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 6,
  },
  certificateSubtitle: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  certificateBody: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  certificateSection: {
    marginBottom: 14,
  },
  certificateSectionHalf: {
    flex: 1,
    marginRight: 12,
  },
  certificateRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  certificateLabel: {
    fontSize: 9,
    color: '#666',
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  certificateValue: {
    fontSize: 13,
    color: '#000',
    fontWeight: '600',
  },
  certificateValueLarge: {
    fontSize: 24,
    color: '#1a237e',
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  certificateInterestGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  certificateInterestItem: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  certificateInterestWeek: {
    fontSize: 9,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  certificateInterestRate: {
    fontSize: 14,
    color: '#1a237e',
    fontWeight: 'bold',
    marginBottom: 3,
  },
  certificateInterestPayout: {
    fontSize: 9,
    color: '#666',
  },
  certificateContractSection: {
    marginTop: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  certificateContractTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  certificateContractText: {
    fontSize: 9,
    color: '#333',
    lineHeight: 14,
    textAlign: 'justify',
  },
  certificateBarcodeSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 14,
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  certificateBarcodeContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  certificateBarcode: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    backgroundColor: '#fff',
  },
  barcodeLine: {
    backgroundColor: '#000',
    marginHorizontal: 0.5,
  },
  certificateBarcodeText: {
    fontSize: 10,
    color: '#000',
    fontWeight: '600',
    letterSpacing: 1.5,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  certificateFooter: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  certificateFooterText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1a237e',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  certificateFooterSubtext: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  certificateDisclaimer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  certificateDisclaimerText: {
    fontSize: 8,
    color: '#666',
    textAlign: 'center',
    lineHeight: 12,
    fontStyle: 'italic',
  },
  certificateCloseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
    paddingVertical: 14,
    gap: 8,
  },
  certificateCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
