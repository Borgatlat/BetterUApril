import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { LogoImage } from '../utils/imageUtils';
import { useAuth } from '../context/AuthContext';
import { getOfferings, purchasePackage, restorePurchases, initializePurchases } from '../lib/purchases';
import { Purchases } from 'react-native-purchases';
import { supabase } from '../lib/supabase';

/** True when RevenueCat reports an active entitlement or subscription (post-purchase). */
function customerInfoHasActiveSubscription(customerInfo) {
  if (!customerInfo) return false;
  const ent = customerInfo.entitlements?.active || {};
  const subs = customerInfo.activeSubscriptions || [];
  const byProd = customerInfo.subscriptionsByProductIdentifier || {};
  const anyActiveProduct = Object.values(byProd).some((s) => s && s.isActive);
  return Object.keys(ent).length > 0 || subs.length > 0 || anyActiveProduct;
}

/**
 * Format a single offer (intro or discount) for display.
 * @private
 */
function formatOffer(intro) {
  if (!intro) return null;
  const n = intro.periodNumberOfUnits ?? 1;
  const unit = (intro.periodUnit || '').toLowerCase();
  const singular = unit === 'day' ? 'day' : unit === 'week' ? 'week' : unit === 'month' ? 'month' : unit === 'year' ? 'year' : 'period';
  const plural = unit === 'day' ? 'days' : unit === 'week' ? 'weeks' : unit === 'month' ? 'months' : unit === 'year' ? 'years' : 'periods';
  const durationHyphen = singular === 'period' ? `${n} ${plural}` : n + '-' + singular;
  const durationAfter = n + ' ' + (n !== 1 ? plural : singular);
  const isFree = intro.price === 0 || (intro.priceString && parseFloat(String(intro.priceString).replace(/[^0-9.]/g, '')) === 0);
  if (isFree) {
    return { introLabel: `${durationHyphen} free trial`, introDurationLabel: `After ${durationAfter}`, isFreeTrial: true };
  }
  const forDuration = n !== 1 ? `${n} ${plural}` : `1 ${singular}`;
  return { introLabel: `Intro: ${intro.priceString} for ${forDuration}`, introDurationLabel: 'After intro period', isFreeTrial: false };
}

/**
 * Introductory or promotional offer for display.
 * Prefers product.introPrice (e.g. 1-week free), then first product.discounts (e.g. half_price $2.99).
 * Also returns promoLabel when a separate promotional offer exists so both can be shown.
 * @param {Object} product - RevenueCat StoreProduct (pkg.product)
 * @returns {{ introLabel: string, introDurationLabel: string, isFreeTrial: boolean, promoLabel?: string } | null}
 */
function getIntroOrPromoOffer(product) {
  if (!product) return null;
  const introOffer = product.introPrice;
  const discount = product.discounts?.[0];
  const primary = introOffer ?? discount;
  if (!primary) return null;
  const result = formatOffer(primary);
  if (!result) return null;
  if (introOffer && discount) {
    result.promoLabel = formatOffer(discount)?.introLabel ?? null;
  }
  return result;
}

/**
 * Build duration text from discount: e.g. "for 12 months", "for 1 year" using cycles and period from the offer data.
 */
function getPromoDurationText(discount) {
  if (!discount) return null;
  const cycles = discount.cycles ?? 1;
  const n = discount.periodNumberOfUnits ?? 1;
  const unit = (discount.periodUnit || '').toLowerCase();
  const singular = unit === 'day' ? 'day' : unit === 'week' ? 'week' : unit === 'month' ? 'month' : unit === 'year' ? 'year' : '';
  const plural = unit === 'day' ? 'days' : unit === 'week' ? 'weeks' : unit === 'month' ? 'months' : unit === 'year' ? 'years' : '';
  const totalUnits = cycles * n;
  if (unit === 'month') return totalUnits === 1 ? 'for 1 month' : `for ${totalUnits} months`;
  if (unit === 'year') return totalUnits === 1 ? 'for 1 year' : `for ${totalUnits} years`;
  if (unit === 'week') return totalUnits === 1 ? 'for 1 week' : `for ${totalUnits} weeks`;
  if (unit === 'day') return totalUnits === 1 ? 'for 1 day' : `for ${totalUnits} days`;
  return totalUnits === 1 ? `for 1 ${singular}` : `for ${totalUnits} ${plural}`;
}

/**
 * Price to show on cards and CTA. When a promotional discount exists, returns original (strikethrough) + promo price + duration from offer data.
 * @param {Object} product - RevenueCat StoreProduct (pkg.product)
 * @returns {{ originalPrice: string, displayPrice: string, periodLabel: string, isPromo: boolean, promoDurationText?: string, thenPriceString?: string, thenPeriodLabel?: string }}
 */
function getDisplayPrice(product) {
  const isYearly = product?.subscriptionPeriod === 'P1Y' || product?.packageType === 'ANNUAL';
  const periodLabel = isYearly ? 'year' : 'month';
  const standardPrice = product?.priceString ?? (isYearly ? '$59.99' : '$5.99');
  const discount = product?.discounts?.[0];
  if (discount?.priceString) {
    const discountPeriod = (discount.periodUnit || '').toLowerCase();
    const discountPeriodLabel = discountPeriod === 'year' ? 'year' : discountPeriod === 'month' ? 'month' : periodLabel;
    return {
      originalPrice: standardPrice,
      displayPrice: discount.priceString,
      periodLabel: discountPeriodLabel,
      isPromo: true,
      promoDurationText: getPromoDurationText(discount),
      thenPriceString: standardPrice,
      thenPeriodLabel: periodLabel,
    };
  }
  return { originalPrice: standardPrice, displayPrice: standardPrice, periodLabel, isPromo: false };
}

function PurchaseSubscriptionScreen() {
  const router = useRouter();
  const { user, refetchProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState('monthly'); // 'monthly' or 'yearly'
  const [hasExistingSubscription, setHasExistingSubscription] = useState(null); // null = loading, true/false after check

  useEffect(() => {
    if (user?.id) {
      loadOfferings();
      checkExistingSubscription();
    }
  }, [user?.id]);

  const checkExistingSubscription = async () => {
    if (!user?.id) return;
    try {
      const { data, error: subError } = await supabase
        .from('subscriptions')
        .select('id')
        .or(`user_id.eq.${user.id},profile_id.eq.${user.id}`)
        .limit(1);
      setHasExistingSubscription(!subError && data && data.length > 0);
    } catch (e) {
      setHasExistingSubscription(false);
    }
  };

  const loadOfferings = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Loading offerings...');

      // Initialize RevenueCat first
      console.log('Initializing RevenueCat...');
      await initializePurchases(user.id);
      console.log('RevenueCat initialized successfully');

      const offeringsData = await getOfferings();
      console.log('Offerings data received:', offeringsData);

      if (!offeringsData?.current) {
        console.log('No current offering found');
        setError('No subscription options available');
        return;
      }

      if (!offeringsData.current.availablePackages?.length) {
        console.log('No available packages found');
        setError('No subscription packages available');
        return;
      }

      console.log('Setting offerings:', offeringsData.current);
      setOfferings(offeringsData.current);

      // Log all available packages
      console.log('All available packages:', offeringsData.current.availablePackages.map(pkg => ({
        identifier: pkg.identifier,
        title: pkg.product.title,
        price: pkg.product.priceString,
        period: pkg.product.subscriptionPeriod
      })));

      // Set default selected package to monthly
      const monthlyPackage = offeringsData.current.availablePackages.find(
        pkg => pkg.product.subscriptionPeriod === 'P1M' || pkg.packageType === 'MONTHLY'
      );
      console.log('Monthly package found:', monthlyPackage);

      if (monthlyPackage) {
        console.log('Setting default package to monthly');
        setSelectedPackage(monthlyPackage);
      } else {
        console.log('No monthly package found, using first available package');
        setSelectedPackage(offeringsData.current.availablePackages[0]);
      }
    } catch (error) {
      console.error('Error loading offerings:', error);
      setError('Failed to load subscription options');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPackage) {
      Alert.alert('Error', 'Please select a subscription plan');
      return;
    }

    // Apple’s payment sheet + RevenueCat native code are not available inside the Expo Go client.
    if (Platform.OS === 'ios' && Constants.appOwnership === 'expo') {
      Alert.alert(
        'Use a development build',
        'The App Store subscription sheet does not run in Expo Go. Build and install the app with:\n\nnpx expo run:ios\n\nor an EAS development build, then subscribe there.'
      );
      return;
    }

    try {
      setLoading(true);
      console.log('Starting purchase for package:', selectedPackage.identifier);
      
      const result = await purchasePackage(selectedPackage);
      
      if (!result.success) {
        if (result.error === 'User cancelled the purchase') {
          console.log('Purchase cancelled by user');
          return;
        }
        throw new Error(result.error || 'Failed to complete purchase');
      }

      if (!customerInfoHasActiveSubscription(result.customerInfo)) {
        Alert.alert(
          'Subscription not confirmed',
          'We could not detect an active subscription after checkout. If no Apple payment sheet appeared, use a development build (not Expo Go). You can also try Restore Purchases from this screen.'
        );
        return;
      }

      console.log('Purchase successful! Creating subscription record...');
      
      // handlePurchaseUpdate should have been called by purchasePackage
      // But let's create a backup subscription record using the customerInfo we got back
      if (result.customerInfo) {
        const customerInfo = result.customerInfo;
        const activeSubscriptions = customerInfo.activeSubscriptions || [];
        const subscriptionsByProduct = customerInfo.subscriptionsByProductIdentifier || {};
        const entitlements = customerInfo.entitlements?.active || {};
        
        // Check for active subscriptions
        const hasActiveSubscription = activeSubscriptions.length > 0 || Object.keys(entitlements).length > 0;
        
        if (hasActiveSubscription) {
          let productId = null;
          let transactionId = null;
          let purchaseDate = null;
          let expirationDate = null;
          
          // Try to get from subscriptionsByProductIdentifier first (more reliable)
          if (Object.keys(subscriptionsByProduct).length > 0) {
            // Prefer yearly over monthly
            const yearlySub = subscriptionsByProduct['betteru_premium_yearly'];
            const monthlySub = subscriptionsByProduct['betteru_premium_monthly'];
            const sub = yearlySub || monthlySub;
            
            if (sub && sub.isActive) {
              productId = sub.productIdentifier;
              transactionId = sub.storeTransactionId || sub.originalTransactionId;
              purchaseDate = new Date(sub.purchaseDate);
              expirationDate = sub.expiresDate ? new Date(sub.expiresDate) : null;
            }
          }
          
          // Fallback to entitlements if not found
          if (!productId && Object.keys(entitlements).length > 0) {
            const subscription = entitlements['premium'] || Object.values(entitlements)[0];
            if (subscription) {
              productId = subscription.productIdentifier;
              transactionId = subscription.originalTransactionId;
              purchaseDate = new Date(subscription.latestPurchaseDate);
              expirationDate = subscription.expirationDate ? new Date(subscription.expirationDate) : null;
            }
          }
          
          if (productId) {
            // If no expiration date, calculate it based on product identifier
            if (!expirationDate) {
              const isYearly = productId?.includes('yearly') || 
                               productId?.includes('annual');
              const daysToAdd = isYearly ? 365 : 30;
              expirationDate = new Date(purchaseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
              console.log('⚠️ No expiration date from RevenueCat, calculated:', expirationDate.toISOString());
            }
            
            console.log('Creating backup subscription record:', {
              productId,
              transactionId,
              expirationDate: expirationDate.toISOString(),
              userId: user.id
            });
            
            // Create subscription record as backup (handlePurchaseUpdate should have done this)
            const subscriptionData = {
              user_id: user.id,
              profile_id: user.id,
              product_id: productId,
              original_transaction_id: transactionId,
              latest_receipt: JSON.stringify(customerInfo.originalAppUserId || user.id),
              status: 'active',
              purchase_date: purchaseDate.toISOString(),
              start_date: purchaseDate.toISOString(),
              end_date: expirationDate.toISOString(), // Always set end_date (required by schema)
              platform: Platform.OS
            };
            
            console.log('📦 Backup subscription data:', JSON.stringify(subscriptionData, null, 2));
            
            // Use the SECURITY DEFINER function to bypass RLS
            const { data: functionResult, error: functionError } = await supabase.rpc(
              'upsert_subscription_service_role',
              {
                p_user_id: subscriptionData.user_id,
                p_profile_id: subscriptionData.profile_id,
                p_product_id: subscriptionData.product_id,
                p_original_transaction_id: subscriptionData.original_transaction_id,
                p_latest_receipt: subscriptionData.latest_receipt,
                p_status: subscriptionData.status,
                p_purchase_date: subscriptionData.purchase_date,
                p_start_date: subscriptionData.start_date,
                p_end_date: subscriptionData.end_date,
                p_platform: subscriptionData.platform
              }
            );

            if (functionError) {
              console.error('❌ Error calling upsert_subscription_service_role (backup):', functionError);
              
              // Fallback to direct insert/upsert if function doesn't exist
              const { data: insertData, error: insertError } = await supabase
                .from('subscriptions')
                .insert(subscriptionData)
                .select();
              
              if (insertError) {
                console.error('❌ Error inserting subscription (backup):', insertError);
                
                // If duplicate, try upsert
                if (insertError.code === '23505') {
                  const { error: upsertError } = await supabase
                    .from('subscriptions')
                    .upsert(subscriptionData, {
                      onConflict: 'original_transaction_id'
                    });
                  
                  if (upsertError) {
                    console.error('❌ Error upserting subscription (backup):', upsertError);
                  } else {
                    console.log('✅ Subscription record upserted successfully (backup)');
                  }
                }
              } else {
                console.log('✅ Subscription record inserted successfully (backup):', insertData);
              }
            } else {
              console.log('✅ Subscription record upserted via service role function (backup):', functionResult);
            }
            
            // Update premium status
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ is_premium: true })
              .eq('id', user.id);
            
            if (profileError) {
              console.error('Error updating premium status:', profileError);
            } else {
              console.log('✅ Premium status updated to true');
            }
          } else {
            console.warn('⚠️ No productId found in customerInfo - cannot create subscription record');
          }
        } else {
          console.warn('⚠️ No active subscriptions found in customerInfo');
        }
      } else {
        console.warn('⚠️ No customerInfo in result - handlePurchaseUpdate should have handled it');
      }
      
      Alert.alert('Success', 'Subscription activated successfully!');

      // If they came from onboarding (no existing subscription), mark onboarding complete and go to home
      if (hasExistingSubscription !== true && user?.id) {
        await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id);
        await supabase.from('onboarding_data').delete().eq('id', user.id);
        await refetchProfile();
        setTimeout(() => {
          router.replace('/(tabs)/home');
        }, 500);
      } else {
        setTimeout(() => {
          router.replace('/(tabs)/settings');
        }, 500);
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert('Error', error.message || 'Failed to complete purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setLoading(true);
      const result = await restorePurchases();
      
      if (result.success) {
        Alert.alert('Success', 'Purchases restored successfully!');
        router.replace('/settings');
      } else {
        Alert.alert('Error', result.error || 'Failed to restore purchases');
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert('Error', 'Failed to restore purchases');
    } finally {
      setLoading(false);
    }
  };

  const getMonthlyPackage = () => {
    if (!offerings?.availablePackages) {
      console.log('No available packages found');
      return null;
    }
    const monthly = offerings.availablePackages.find(
      pkg => pkg.product.subscriptionPeriod === 'P1M' || pkg.packageType === 'MONTHLY'
    );
    console.log('Getting monthly package:', monthly ? {
      identifier: monthly.identifier,
      price: monthly.product.priceString,
      period: monthly.product.subscriptionPeriod,
      type: monthly.packageType
    } : 'No monthly package found');
    return monthly;
  };

  const getYearlyPackage = () => {
    if (!offerings?.availablePackages) {
      console.log('No available packages found');
      return null;
    }
    const yearly = offerings.availablePackages.find(
      pkg => pkg.product.subscriptionPeriod === 'P1Y' || pkg.packageType === 'ANNUAL'
    );
    console.log('Getting yearly package:', yearly ? {
      identifier: yearly.identifier,
      price: yearly.product.priceString,
      period: yearly.product.subscriptionPeriod,
      type: yearly.packageType
    } : 'No yearly package found');
    return yearly;
  };

  const renderSubscriptionButton = (pkg, isSelected) => {
    if (!pkg) {
      console.log('No package provided for button');
      return null;
    }

    const getPeriodText = (pkg) => {
      if (pkg.packageType === 'MONTHLY') return 'month';
      if (pkg.packageType === 'ANNUAL') return 'year';
      if (pkg.product.subscriptionPeriod === 'P1M') return 'month';
      if (pkg.product.subscriptionPeriod === 'P1Y') return 'year';
      return 'month';
    };
    
    // Show 'Monthly' instead of 'Preview Product' for preview mode
    let displayTitle = pkg.product.title;
    if (displayTitle === 'Preview Product' && getPeriodText(pkg) === 'month') {
      displayTitle = 'Monthly';
    }
    if (displayTitle === 'Yearly Premium' && getPeriodText(pkg) === 'year') {
      displayTitle = 'Yearly';
    }

    return (
      <View style={isSelected ? styles.selectedOutline : null}>
        <TouchableOpacity
          style={[styles.subscriptionButton, isSelected && styles.selectedSubscriptionButton]}
          onPress={() => setSelectedPackage(pkg)}
        >
          <LinearGradient
            colors={isSelected ? ['#00ffff', '#0088ff'] : ['#222', '#111']}
            style={styles.subscriptionButtonGradient}
          >
            <Text style={[styles.subscriptionButtonText, isSelected && styles.selectedButtonText]}>
              {displayTitle}
            </Text>
            <Text style={[styles.subscriptionPrice, isSelected && styles.selectedButtonText]}>
              {pkg.product.priceString || '$9.99'}
            </Text>
            <Text style={[styles.subscriptionPeriod, isSelected && styles.selectedButtonText]}>
              per {getPeriodText(pkg)}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => (hasExistingSubscription === true ? router.replace('/(tabs)/settings') : router.back())}
      >
        <Ionicons name="chevron-back" size={28} color="#00ffff" />
        <Text style={styles.backButtonText}>
          {hasExistingSubscription === true ? 'Back to Settings' : 'Back'}
        </Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <LogoImage size={120} style={styles.logo} />
        <Text style={styles.title}>
          {hasExistingSubscription === true ? 'Upgrade Your Experience' : 'Start your one week free trial'}
        </Text>
        {hasExistingSubscription !== true && (
          <Text style={styles.headerSubtitle}>7-day free trial. After the trial, you'll be charged the price below unless you cancel.</Text>
        )}
      </View>

      {/* Premium Features Section - Moved to top for better visibility */}
      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>Premium Features</Text>
        <Text style={styles.featuresSubtitle}>
          {hasExistingSubscription === true
            ? 'Unlock advanced features for enhanced fitness and mental wellness'
            : 'Unlock everything below with your free trial'}
        </Text>
        
        <View style={styles.featuresList}>
          {/* Most Wanted Features */}
          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="chatbubbles" size={20} color="#FFD700" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>100 Daily AI Messages</Text>
              <Text style={styles.featureDescription}>Unlimited guidance, motivation, and support whenever you need it</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="restaurant" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>More AI Meals Daily</Text>
              <Text style={styles.featureDescription}>More meal ideas than free users - never run out of inspiration</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="fitness" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>More AI Workouts Daily</Text>
              <Text style={styles.featureDescription}>More workouts - fresh routines whenever you need them</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="flower" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>More AI Mental Sessions Daily</Text>
              <Text style={styles.featureDescription}>More sessions - meditation, breathing & mindfulness on demand</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="trophy" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Premium Workouts</Text>
              <Text style={styles.featureDescription}>Expert-designed plans for faster, better results</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="trending-up" size={20} color="#FFD700" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Premium Bond Rates</Text>
              <Text style={styles.featureDescription}>Earn more rewards with higher returns on your fitness bonds</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="clipboard-outline" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Custom Nutrition Goals</Text>
              <Text style={styles.featureDescription}>Set your own targets - full control over your nutrition</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="people" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Public Groups</Text>
              <Text style={styles.featureDescription}>Build communities and connect with fitness enthusiasts worldwide</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="timer" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Custom Rest Times</Text>
              <Text style={styles.featureDescription}>Optimize your training with personalized rest intervals</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="headset" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Guided Audio Sessions</Text>
              <Text style={styles.featureDescription}>Professional narration for deeper relaxation and focus</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="star" size={20} color="#FFD700" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Gold Profile Glow</Text>
              <Text style={styles.featureDescription}>Stand out with a stunning gold glow - show your status</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.featureIcon}>
              <Ionicons name="sparkles" size={20} color="#00ffff" />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>And More</Text>
              <Text style={styles.featureDescription}>Unlock additional premium features and exclusive content</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Plans Header */}
          <View style={styles.plansHeader}>
        <Text style={styles.plansTitle}>
          {hasExistingSubscription === true ? 'Choose Your Plan' : 'Start your free trial'}
        </Text>
        <Text style={styles.plansSubtitle}>
          {hasExistingSubscription === true
            ? 'Select the subscription that works best for you'
            : 'Choose monthly or yearly — 7-day free trial, then you can cancel anytime'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={loadOfferings}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={styles.pricingContainer}>
            {offerings?.availablePackages?.map((pkg) => {
              const isMonthly = pkg.product.subscriptionPeriod === 'P1M' || pkg.packageType === 'MONTHLY';
              const isSelected = selectedPackage?.identifier === pkg.identifier;
              const displayPrice = getDisplayPrice(pkg.product);
              return (
                <TouchableOpacity 
                  key={pkg.identifier}
                  style={[
                    styles.pricingCard,
                    isSelected && styles.selectedCard
                  ]}
                  onPress={() => setSelectedPackage(pkg)}
                >
                  <View style={styles.pricingHeader}>
                    <Text style={styles.pricingTitle}>
                      {isMonthly ? 'Monthly' : 'Yearly'}
                    </Text>
                    <View style={styles.pricingPriceRow}>
                      {displayPrice.isPromo ? (
                        <>
                          <Text style={[styles.pricingPrice, styles.pricingPriceStrikethrough]}>
                            {displayPrice.originalPrice}
                          </Text>
                          <Text style={styles.pricingPrice}>{displayPrice.displayPrice}</Text>
                        </>
                      ) : (
                        <Text style={styles.pricingPrice}>{displayPrice.displayPrice}</Text>
                      )}
                    </View>
                    <Text style={styles.pricingPeriod}>
                      per {displayPrice.periodLabel}
                      {displayPrice.isPromo && displayPrice.promoDurationText ? ` · ${displayPrice.promoDurationText}` : ''}
                      {displayPrice.isPromo && displayPrice.thenPriceString && displayPrice.promoDurationText
                        ? ` · then ${displayPrice.thenPriceString}/${displayPrice.thenPeriodLabel === 'year' ? 'yr' : 'mo'}`
                        : ''}
                    </Text>
                    {!isMonthly && (
                      <View style={styles.savingsBadge}>
                        <Text style={styles.savingsText}>Save 17%</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.pricingFeatures}>
                    <Text style={styles.pricingFeature}>• All Premium Features</Text>
                    <Text style={styles.pricingFeature}>
                      {isMonthly ? '• Cancel anytime' : '• Best value'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.subscribeButton, loading && styles.subscribeButtonDisabled]}
            onPress={handleSubscribe}
            disabled={loading || !selectedPackage}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={hasExistingSubscription === true ? ['#00ffff', '#0088ff'] : ['#00ffff', '#00dddd', '#0088cc']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subscribeButtonGradient}
            >
              {hasExistingSubscription === true ? (
                <Text style={styles.subscribeButtonText}>
                  {loading ? 'Loading...' : `Subscribe ${selectedPackage?.product.subscriptionPeriod === 'P1M' ? 'Monthly' : 'Yearly'}`}
                </Text>
              ) : (
                <>
                  <View style={styles.subscribeButtonContent}>
                    <Text style={styles.subscribeButtonText}>
                      {loading ? 'Loading...' : (() => {
                        const offer = selectedPackage ? getIntroOrPromoOffer(selectedPackage.product) : null;
                        if (offer) return offer.isFreeTrial ? `Start your ${offer.introLabel}` : `Get ${offer.introLabel}`;
                        return 'Start your 7-day free trial';
                      })()}
                    </Text>
                    <Text style={styles.subscribeButtonSubtext}>
                      {(() => {
                        const dp = selectedPackage ? getDisplayPrice(selectedPackage.product) : null;
                        if (!dp) return 'Then choose your plan';
                        const per = dp.periodLabel === 'year' ? 'yr' : 'mo';
                        if (dp.isPromo && dp.thenPriceString) return `Then ${dp.displayPrice}/${per} (then ${dp.thenPriceString}/${dp.thenPeriodLabel === 'year' ? 'yr' : 'mo'})`;
                        return `Then ${dp.displayPrice} per ${dp.periodLabel}`;
                      })()}
                    </Text>
                  </View>
                  <Ionicons name="sparkles" size={22} color="#000" style={styles.subscribeButtonIcon} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Guideline 3.1.2: Clear trial, promotional offer duration, then full price after that time */}
          {hasExistingSubscription !== true && selectedPackage && (() => {
            const introOffer = getIntroOrPromoOffer(selectedPackage.product);
            const displayPrice = getDisplayPrice(selectedPackage.product);
            const introText = introOffer ? introOffer.introLabel : '7-day free trial';
            const afterText = introOffer ? introOffer.introDurationLabel : 'After 7 days';
            const perLabel = displayPrice.periodLabel === 'year' ? 'year' : 'month';
            const thenPerLabel = displayPrice.thenPeriodLabel === 'year' ? 'year' : 'month';
            return (
              <View style={styles.trialDisclosureBox}>
                <Text style={styles.trialDisclosureTitle}>Free trial & billing</Text>
                <Text style={styles.trialDisclosureText}>
                  <Text style={styles.trialDisclosureBold}>{introText}.</Text>
                  {' '}{afterText}, you will be charged{' '}
                  {displayPrice.isPromo && displayPrice.promoDurationText && displayPrice.thenPriceString ? (
                    <>
                      <Text style={styles.trialDisclosureBold}>
                        {displayPrice.displayPrice} per {perLabel} {displayPrice.promoDurationText}
                      </Text>
                      . After that period, you will be billed{' '}
                      <Text style={styles.trialDisclosureBold}>
                        {displayPrice.thenPriceString} per {thenPerLabel}
                      </Text>
                      {' '}unless you cancel.
                    </>
                  ) : (
                    <>
                      <Text style={styles.trialDisclosureBold}>
                        {displayPrice.displayPrice} per {perLabel}
                      </Text>
                      {' '}unless you cancel.
                    </>
                  )}
                  {' '}Payment will be charged to your Apple ID at the end of the trial. Subscription automatically renews until cancelled.
                </Text>
              </View>
            );
          })()}

          <TouchableOpacity 
            style={styles.restoreButton} 
            onPress={handleRestorePurchases}
            disabled={loading}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </TouchableOpacity>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By subscribing, you agree to our{' '}
              <Text 
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://www.betteruai.com/terms-of-service')}
              >
                Terms of Service
              </Text>
              {' '}and{' '}
              <Text 
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://www.betteruai.com/privacy-policy')}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  contentContainer: {
    padding: 20,
    paddingTop: 140,
    paddingBottom: 100,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 18,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    marginTop: 0,
    paddingHorizontal: 20,
  },
  subtitle: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    opacity: 0.8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  pricingContainer: {
    gap: 20,
    marginBottom: 30,
  },
  pricingCard: {
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 10,
  },
  selectedCard: {
    borderColor: '#00ffff',
    borderWidth: 2,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
  },
  pricingHeader: {
    padding: 20,
    alignItems: 'center',
  },
  pricingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  pricingIntroOffer: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 4,
    fontWeight: '600',
  },
  pricingPromoOffer: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 6,
    fontWeight: '500',
  },
  pricingPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  pricingPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  pricingPriceStrikethrough: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.5)',
    fontSize: 24,
  },
  pricingPeriod: {
    fontSize: 16,
    color: '#666',
  },
  pricingFeatures: {
    alignItems: 'center',
  },
  pricingFeature: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 5,
  },
  savingsBadge: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginTop: 5,
  },
  savingsText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  trialDisclosureBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  trialDisclosureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#00ffff',
    marginBottom: 8,
  },
  trialDisclosureText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
    opacity: 0.95,
  },
  trialDisclosureBold: {
    fontWeight: '700',
    color: '#fff',
  },
  subscribeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 0,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  subscribeButtonGradient: {
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.2,
  },
  subscribeButtonSubtext: {
    color: 'rgba(0, 0, 0, 0.65)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  subscribeButtonIcon: {
    marginLeft: 12,
  },
  subscribeButtonDisabled: {
    opacity: 0.6,
  },
  restoreButton: {
    marginTop: 18,
    marginBottom: 10,
    alignItems: 'center',
  },
  restoreButtonText: {
    color: '#00ffff',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  featuresContainer: {
    marginBottom: 30,
    backgroundColor: 'rgba(0, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  featuresTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  featuresSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    marginBottom: 20,
  },
  plansHeader: {
    alignItems: 'center',
    marginBottom: 25,
    marginTop: 10,
  },
  plansTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00ffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  plansSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
  },
  featuresList: {
    gap: 16,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  termsContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  termsText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  termsLink: {
    color: '#00ffff',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#00ffff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  selectedOutline: {
    borderWidth: 3,
    borderColor: '#00ffff',
    borderRadius: 20,
    backgroundColor: 'rgba(0,255,255,0.08)',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
    marginBottom: 10,
  },
  subscriptionButtonsContainer: {
    display: 'none',
  },
});

export default PurchaseSubscriptionScreen; 