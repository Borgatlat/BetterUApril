import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { triggerPremiumRefresh } from './premiumRefresh';

// RevenueCat Paywall UI — design in RevenueCat dashboard. Requires a dev build (expo run:ios / EAS).
let RevenueCatUI = null;
let PAYWALL_RESULT = null;
try {
  const RCUI = require('react-native-purchases-ui');
  RevenueCatUI = RCUI.default;
  PAYWALL_RESULT = RCUI.PAYWALL_RESULT;
} catch (e) {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && e?.message?.includes?.('linked')) {
    console.warn(
      '[RevenueCat Paywall] Native module not linked. Rebuild: npx expo run:ios (or EAS). Expo Go has no purchases-ui native code.'
    );
  }
}

// TODO: move API keys to env (e.g. EXPO_PUBLIC_REVENUECAT_IOS_KEY) for production
const REVENUECAT_API_KEYS = {
  ios: 'appl_VqDUMRHcMiIEYYmbHamptaLYyIY',
  android: null,
};

let isInitializing = false;
let isInitialized = false;
let initPromise = null;

export const isRevenueCatReady = () => isInitialized;

export const initializePurchases = async (userId) => {
  if (isInitialized) {
    console.log('RevenueCat already initialized, skipping...');
    return;
  }
  if (isInitializing && initPromise) {
    console.log('RevenueCat initialization in progress, waiting...');
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      if (Platform.OS !== 'ios') {
        console.log('In-app purchases are currently only available on iOS');
        isInitializing = false;
        isInitialized = false;
        return;
      }
      const apiKey = REVENUECAT_API_KEYS.ios;
      if (!apiKey) {
        console.error('RevenueCat API key not found');
        isInitializing = false;
        isInitialized = false;
        return;
      }
      try {
        await Purchases.configure({
          apiKey,
          observerMode: false,
          useAmazon: false,
          appUserID: userId,
        });
        console.log('RevenueCat configured successfully');
      } catch (configureError) {
        if (configureError.message && configureError.message.includes('Bundle ID')) {
          console.warn('RevenueCat Bundle ID mismatch — products may not load:', configureError.message);
          isInitialized = true;
          isInitializing = false;
          return;
        }
        throw configureError;
      }

      try {
        await Purchases.getCustomerInfo();
      } catch (verifyError) {
        console.warn('RevenueCat configured but getCustomerInfo failed:', verifyError);
      }

      Purchases.addCustomerInfoUpdateListener(async (info) => {
        console.log('Purchase update received (listener)');
        await handlePurchaseUpdate(info);
      });

      isInitialized = true;
      isInitializing = false;
      console.log('RevenueCat initialization complete');
    } catch (error) {
      console.error('Error initializing purchases:', error);
      isInitializing = false;
      isInitialized = false;
    }
  })();

  return initPromise;
};

export const getOfferings = async () => {
  try {
    if (Platform.OS !== 'ios') {
      return null;
    }
    const offerings = await Purchases.getOfferings();
    if (!offerings) {
      return null;
    }

    let currentOffering = offerings.current;
    if (!currentOffering && offerings.all?.premium_offering) {
      currentOffering = offerings.all.premium_offering;
    }
    if (!currentOffering) {
      return null;
    }
    if (!offerings.current && currentOffering) {
      offerings.current = currentOffering;
    }
    if (!offerings.current.availablePackages?.length) {
      return null;
    }

    offerings.current.availablePackages.forEach((pkg, index) => {
      const prod = pkg.product;
      console.log(`Package ${index + 1}:`, {
        identifier: pkg.identifier,
        title: prod.title,
        priceString: prod.priceString,
        introPrice: prod.introPrice ?? null,
        discounts: prod.discounts ?? null,
      });
    });

    if (offerings.current.availablePackages.length === 1) {
      const monthlyPackage = offerings.current.availablePackages[0];
      if (monthlyPackage.product.subscriptionPeriod === 'P1M' || monthlyPackage.packageType === 'MONTHLY') {
        const yearlyPackage = {
          ...monthlyPackage,
          identifier: `${monthlyPackage.identifier}_yearly`,
          packageType: 'ANNUAL',
          product: {
            ...monthlyPackage.product,
            subscriptionPeriod: 'P1Y',
            priceString: `$${(parseFloat(String(monthlyPackage.product.priceString).replace('$', '')) * 10).toFixed(2)}`,
            title: 'Yearly Premium',
          },
        };
        offerings.current.availablePackages.push(yearlyPackage);
      }
    }

    return offerings;
  } catch (error) {
    console.error('Error getting offerings:', error);
    return null;
  }
};

export const presentPaywall = async (options = {}) => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  if (!RevenueCatUI || !PAYWALL_RESULT) {
    console.warn('react-native-purchases-ui not available; use /purchase-subscription fallback');
    return false;
  }
  try {
    const result = options.offering
      ? await RevenueCatUI.presentPaywall({ offering: options.offering })
      : await RevenueCatUI.presentPaywall();
    const purchased = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    if (purchased) {
      await triggerPremiumRefresh();
    }
    return purchased;
  } catch (error) {
    console.error('Error presenting paywall:', error);
    return false;
  }
};

const PREMIUM_OFFERING_ID = 'premium_offering';

export const presentPremiumPaywall = async () => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  if (RevenueCatUI && PAYWALL_RESULT) {
    const offerings = await getOfferings();
    const offering = offerings?.all?.[PREMIUM_OFFERING_ID] ?? offerings?.current;
    return presentPaywall(offering ? { offering } : {});
  }
  try {
    const offerings = await getOfferings();
    const pkg = offerings?.current?.availablePackages?.[0];
    if (!pkg) {
      return false;
    }
    const { success } = await purchasePackage(pkg);
    return Boolean(success);
  } catch (e) {
    console.error('presentPremiumPaywall fallback:', e);
    return false;
  }
};

export const presentPaywallIfNeeded = async (opts = {}) => {
  if (Platform.OS !== 'ios') {
    return false;
  }
  if (!RevenueCatUI || !PAYWALL_RESULT) {
    return false;
  }
  const requiredEntitlementIdentifier = opts.requiredEntitlementIdentifier || 'premium';
  try {
    const result = opts.offering
      ? await RevenueCatUI.presentPaywallIfNeeded({
          offering: opts.offering,
          requiredEntitlementIdentifier,
        })
      : await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier });
    const hasAccess =
      result === PAYWALL_RESULT.PURCHASED ||
      result === PAYWALL_RESULT.RESTORED ||
      result === PAYWALL_RESULT.NOT_PRESENTED;
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
      await triggerPremiumRefresh();
    }
    return hasAccess;
  } catch (error) {
    console.error('presentPaywallIfNeeded:', error);
    return false;
  }
};

export const purchasePackage = async (pkg) => {
  try {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'In-app purchases are currently only available on iOS' };
    }

    const discount = pkg?.product?.discounts?.[0];
    if (discount) {
      try {
        const promoOffer = await Purchases.getPromotionalOffer(pkg.product, discount);
        if (promoOffer) {
          const { customerInfo, productIdentifier } = await Purchases.purchaseDiscountedPackage(pkg, promoOffer);
          await handlePurchaseUpdate(customerInfo);
          return { success: true, productIdentifier, customerInfo };
        }
      } catch (promoError) {
        if (promoError.userCancelled) {
          return { success: false, error: 'User cancelled the purchase' };
        }
        console.warn('Promotional offer not available, falling back to standard purchase:', promoError?.message);
      }
    }

    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
    await handlePurchaseUpdate(customerInfo);
    return { success: true, productIdentifier, customerInfo };
  } catch (error) {
    if (error.userCancelled) {
      return { success: false, error: 'User cancelled the purchase' };
    }
    console.error('Error purchasing package:', error);
    return { success: false, error: error.message };
  }
};

export const restorePurchases = async () => {
  try {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'In-app purchases are currently only available on iOS' };
    }
    const customerInfo = await Purchases.restorePurchases();
    await handlePurchaseUpdate(customerInfo);
    return { success: true };
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return { success: false, error: error.message };
  }
};

const handlePurchaseUpdate = async (customerInfo) => {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return;
    }

    const activeSubscriptions = customerInfo.activeSubscriptions || [];
    const subscriptionsByProduct = customerInfo.subscriptionsByProductIdentifier || {};
    const entitlements = customerInfo.entitlements?.active || {};
    const hasActiveSubscription =
      activeSubscriptions.length > 0 || Object.keys(entitlements).length > 0;

    if (hasActiveSubscription) {
      let productId = null;
      let transactionId = null;
      let purchaseDate = null;
      let expirationDate = null;

      if (Object.keys(entitlements).length > 0) {
        const subscription =
          entitlements.premium || entitlements.Premium || Object.values(entitlements)[0];
        if (subscription) {
          productId = subscription.productIdentifier;
          transactionId = subscription.originalTransactionId;
          purchaseDate = new Date(subscription.latestPurchaseDate);
          expirationDate = subscription.expirationDate ? new Date(subscription.expirationDate) : null;
        }
      }

      if (!productId && Object.keys(subscriptionsByProduct).length > 0) {
        const yearlySub = subscriptionsByProduct.betteru_premium_yearly;
        const monthlySub = subscriptionsByProduct.betteru_premium_monthly;
        const sub = yearlySub || monthlySub;
        if (sub && sub.isActive) {
          productId = sub.productIdentifier;
          transactionId = sub.storeTransactionId || sub.originalTransactionId;
          purchaseDate = new Date(sub.purchaseDate);
          expirationDate = sub.expiresDate ? new Date(sub.expiresDate) : null;
        }
      }

      if (!productId && activeSubscriptions.length > 0) {
        const allPurchaseDates = customerInfo.allPurchaseDates || {};
        const allExpirationDates = customerInfo.allExpirationDates || {};
        productId = activeSubscriptions.includes('betteru_premium_yearly')
          ? 'betteru_premium_yearly'
          : activeSubscriptions[0];
        const purchaseStr = allPurchaseDates[productId];
        const expirationStr = allExpirationDates[productId];
        purchaseDate = purchaseStr ? new Date(purchaseStr) : new Date();
        expirationDate = expirationStr ? new Date(expirationStr) : null;
        if (!transactionId) {
          transactionId = customerInfo.originalAppUserId
            ? `rc-${customerInfo.originalAppUserId}-${productId}`
            : `rc-${user.id}-${productId}`;
        }
      }

      if (!productId) {
        console.error('handlePurchaseUpdate: no product id from RevenueCat payload');
        return;
      }

      if (!expirationDate) {
        const isYearly = productId.includes('yearly') || productId.includes('annual');
        const daysToAdd = isYearly ? 365 : 30;
        expirationDate = new Date(purchaseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
      }

      const subscriptionData = {
        user_id: user.id,
        profile_id: user.id,
        product_id: productId,
        original_transaction_id: transactionId,
        latest_receipt: JSON.stringify(customerInfo.originalAppUserId || user.id),
        status: 'active',
        purchase_date: purchaseDate.toISOString(),
        start_date: purchaseDate.toISOString(),
        end_date: expirationDate.toISOString(),
        platform: Platform.OS,
      };

      const { error: functionError } = await supabase.rpc('upsert_subscription_service_role', {
        p_user_id: subscriptionData.user_id,
        p_profile_id: subscriptionData.profile_id,
        p_product_id: subscriptionData.product_id,
        p_original_transaction_id: subscriptionData.original_transaction_id,
        p_latest_receipt: subscriptionData.latest_receipt,
        p_status: subscriptionData.status,
        p_purchase_date: subscriptionData.purchase_date,
        p_start_date: subscriptionData.start_date,
        p_end_date: subscriptionData.end_date,
        p_platform: subscriptionData.platform,
      });

      if (functionError) {
        const { error: insertError } = await supabase.from('subscriptions').insert(subscriptionData);
        if (insertError?.code === '23505') {
          await supabase.from('subscriptions').upsert(subscriptionData, {
            onConflict: 'original_transaction_id',
            ignoreDuplicates: false,
          });
        } else if (insertError) {
          console.error('Subscription insert error:', insertError);
        }
      }

      await supabase.from('profiles').update({ is_premium: true }).eq('id', user.id);
      triggerPremiumRefresh();
    } else {
      await supabase.from('subscriptions').update({ status: 'expired' }).eq('user_id', user.id).eq('status', 'active');
      await supabase.from('profiles').update({ is_premium: false }).eq('id', user.id);
      triggerPremiumRefresh();
    }
  } catch (error) {
    console.error('Error handling purchase update:', error);
  }
};
