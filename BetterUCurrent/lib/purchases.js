import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { triggerPremiumRefresh } from './premiumRefresh';
import {
  getPreferredDefaultPackage,
  getSubscriptionDurationDays,
  pickActiveSubscriptionProduct,
  sortPackagesForDisplay,
  filterKnownSubscriptionPackages,
  dedupeSubscriptionPackages,
  createStandaloneSubscriptionPackage,
  getMissingSubscriptionProductIds,
  getPackageProductId,
  isKnownSubscriptionPackage,
  SUBSCRIPTION_PRODUCT_PRIORITY,
} from './subscriptionProducts';

// RevenueCat Paywall UI – design your paywall in RevenueCat dashboard, then present it here.
// Requires a native dev build (expo run:ios / EAS build). In Expo Go the native module is missing
// so the package throws on load; we catch and fall back to purchase-subscription screen.
let RevenueCatUI = null;
let PAYWALL_RESULT = null;
try {
  const RCUI = require('react-native-purchases-ui');
  RevenueCatUI = RCUI.default;
  PAYWALL_RESULT = RCUI.PAYWALL_RESULT;
} catch (e) {
  // Expected in Expo Go or if native module not linked. Run: npx expo run:ios (or EAS build).
  if (__DEV__ && e?.message?.includes('linked')) {
    console.warn('[RevenueCat Paywall] Native module not linked. Rebuild the app with: npx expo run:ios (or EAS build). Expo Go does not include this native code.');
  }
}

// Initialize RevenueCat with your API keys
const REVENUECAT_API_KEYS = {
  ios: 'appl_VqDUMRHcMiIEYYmbHamptaLYyIY',
  android: null // We'll implement Android later
};

// Track initialization state to prevent multiple configures
let isInitializing = false;
let isInitialized = false;
let initPromise = null;

/**
 * Check if RevenueCat is initialized
 * @returns {boolean} - True if initialized, false otherwise
 */
export const isRevenueCatReady = () => {
  return isInitialized;
};

export const initializePurchases = async (userId) => {
  // If already initialized, return immediately
  if (isInitialized) {
    console.log('RevenueCat already initialized, skipping...');
    return;
  }

  // If currently initializing, wait for the existing promise
  if (isInitializing && initPromise) {
    console.log('RevenueCat initialization in progress, waiting...');
    return initPromise;
  }

  // Start initialization
  isInitializing = true;
  initPromise = (async () => {
    try {
      console.log('💰 Initializing RevenueCat for user:', userId);
      console.log('📱 Platform:', Platform.OS);
      
      // Only initialize for iOS for now
      if (Platform.OS !== 'ios') {
        console.log('⚠️ In-app purchases are currently only available on iOS');
        isInitializing = false;
        isInitialized = false;
        return;
      }

      const apiKey = REVENUECAT_API_KEYS.ios;
      if (!apiKey) {
        console.error('❌ RevenueCat API key not found');
        isInitializing = false;
        isInitialized = false;
        return;
      }

      console.log('🔧 Configuring RevenueCat with API key (first 10 chars):', apiKey.substring(0, 10) + '...');
      try {
        await Purchases.configure({ 
          apiKey,
          observerMode: false,
          useAmazon: false,
          appUserID: userId // Set the user ID during configuration
        });
        console.log('✅ RevenueCat configured successfully');
      } catch (configureError) {
        // If configuration fails due to bundle ID mismatch, log it but don't crash
        if (configureError.message && configureError.message.includes('Bundle ID')) {
          console.warn('⚠️ RevenueCat Bundle ID Mismatch Warning:');
          console.warn('The app\'s bundle ID doesn\'t match RevenueCat configuration.');
          console.warn('To fix: Delete the app from your device and rebuild, or update RevenueCat to match your bundle ID.');
          console.warn('Error:', configureError.message);
          // Still mark as initialized so the app doesn't crash - products just won't load
          isInitialized = true;
          isInitializing = false;
          return;
        }
        throw configureError; // Re-throw if it's a different error
      }

      // Verify it worked by trying to get customer info
      try {
        const customerInfo = await Purchases.getCustomerInfo();
        console.log('✅ RevenueCat verified - customer info retrieved successfully');
      } catch (verifyError) {
        console.warn('⚠️ RevenueCat configured but verification failed:', verifyError);
        // Still mark as initialized if configure succeeded
      }

      // Set up listener for purchase updates
      Purchases.addCustomerInfoUpdateListener(async (info) => {
        console.log('📦 Purchase update received:', JSON.stringify(info, null, 2));
        await handlePurchaseUpdate(info);
      });

      // Mark as initialized
      isInitialized = true;
      isInitializing = false;
      console.log('✅ RevenueCat initialization complete and ready');
    } catch (error) {
      console.error('❌ Error initializing purchases:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      isInitializing = false;
      isInitialized = false;
      // Don't throw - allow retries later
      return;
    }
  })();

  return initPromise;
};

/** Gather subscription packages from current + premium_offering + any offering that has our SKUs */
function collectSubscriptionPackagesFromOfferings(offerings) {
  const collected = [];

  const addPackages = (list) => {
    if (!Array.isArray(list)) return;
    for (const pkg of list) {
      if (isKnownSubscriptionPackage(pkg)) {
        collected.push(pkg);
      }
    }
  };

  addPackages(offerings?.current?.availablePackages);
  addPackages(offerings?.all?.['premium_offering']?.availablePackages);

  if (offerings?.all) {
    for (const offering of Object.values(offerings.all)) {
      addPackages(offering?.availablePackages);
    }
  }

  return dedupeSubscriptionPackages(collected);
}

/** Fetch any weekly/monthly/yearly product missing from the offering (e.g. weekly just added in App Store Connect) */
async function hydrateMissingSubscriptionPackages(packages) {
  const missingIds = getMissingSubscriptionProductIds(packages);
  if (!missingIds.length || Platform.OS !== 'ios') {
    return packages;
  }

  console.log('[RevenueCat] Hydrating missing subscription products:', missingIds);
  try {
    const products = await Purchases.getProducts(missingIds);
    const standalone = (products || [])
      .map(createStandaloneSubscriptionPackage)
      .filter(Boolean);
    if (standalone.length) {
      console.log(
        '[RevenueCat] Loaded standalone products for paywall:',
        standalone.map((p) => getPackageProductId(p))
      );
    }
    return dedupeSubscriptionPackages([...packages, ...standalone]);
  } catch (error) {
    console.warn('[RevenueCat] Could not hydrate missing subscription products:', error?.message);
    return packages;
  }
}

export const getOfferings = async () => {
  try {
    console.log('Getting offerings...');
    if (Platform.OS !== 'ios') {
      console.log('In-app purchases are currently only available on iOS');
      return null;
    }

    console.log('Calling Purchases.getOfferings()...');
    const offerings = await Purchases.getOfferings();
    console.log('Raw offerings data:', JSON.stringify(offerings, null, 2));
    
    if (!offerings) {
      console.log('No offerings returned from RevenueCat');
      return null;
    }

    // Try to get the current offering first, or fallback to premium_offering
    let currentOffering = offerings.current;
    
    if (!currentOffering) {
      console.log('No current offering found, checking for premium_offering...');
      // Fallback to the premium_offering if current is not set
      if (offerings.all && offerings.all['premium_offering']) {
        currentOffering = offerings.all['premium_offering'];
        console.log('Found premium_offering, using it as current offering');
      } else {
        console.log('No current offering and premium_offering not found');
        return null;
      }
    }

    // Replace offerings.current with our found offering for consistency
    if (!offerings.current && currentOffering) {
      offerings.current = currentOffering;
    }

    let mergedPackages = collectSubscriptionPackagesFromOfferings(offerings);
    mergedPackages = await hydrateMissingSubscriptionPackages(mergedPackages);

    if (!mergedPackages.length) {
      console.log('No subscription packages found after merge/hydrate');
      return null;
    }

    // Log detailed package information including intro/promo (so you can verify App Store Connect offers appear)
    console.log('Number of subscription packages (merged):', mergedPackages.length);
    mergedPackages.forEach((pkg, index) => {
      const prod = pkg.product;
      console.log(`Package ${index + 1}:`, {
        identifier: pkg.identifier,
        productId: prod?.identifier,
        standalone: !!pkg.isStandaloneProduct,
        product: {
          title: prod.title,
          priceString: prod.priceString,
          subscriptionPeriod: prod.subscriptionPeriod,
          introPrice: prod.introPrice ?? null,
          discounts: prod.discounts ?? null,
        }
      });
      if (!prod.introPrice && (!prod.discounts || prod.discounts.length === 0)) {
        console.warn('[RevenueCat] No introPrice or discounts on', prod.identifier, '- intro/promo will not show on subscription screen. Check App Store Connect introductory vs promotional offer setup.');
      }
    });

    // Weekly → yearly → monthly; only real App Store SKUs
    offerings.current.availablePackages = sortPackagesForDisplay(
      filterKnownSubscriptionPackages(mergedPackages)
    );

    if (!offerings.current.availablePackages.length) {
      console.log('No known subscription packages in current offering');
      return null;
    }

    return offerings;
  } catch (error) {
    console.error('Error getting offerings:', error);
    // Common cause: Simulator without StoreKit config, or App Store Connect / RevenueCat mismatch.
    if (error?.message?.includes('configuration') || error?.message?.includes('could be fetched')) {
      console.warn('[RevenueCat] Products could not be fetched. Simulator: add a StoreKit Configuration file in Xcode. Device: use a Sandbox Apple ID and ensure IAPs match in App Store Connect and RevenueCat. See https://rev.cat/why-are-offerings-empty');
    }
    return null;
  }
};

/**
 * Present the RevenueCat paywall you designed in the RevenueCat dashboard.
 * Use this when you want to show the paywall (e.g. "Upgrade" button, before premium features).
 *
 * Ensure RevenueCat is initialized first (e.g. initializePurchases(userId) in your app root).
 *
 * @param {Object} options - Optional. { offering } to show a specific offering's paywall.
 * @returns {Promise<boolean>} - true if user purchased or restored, false if cancelled/error/not presented.
 */
export const presentPaywall = async (options = {}) => {
  if (Platform.OS !== 'ios') {
    console.log('RevenueCat paywall is only available on iOS in this app');
    return false;
  }
  if (!RevenueCatUI || !PAYWALL_RESULT) {
    console.warn('react-native-purchases-ui not available; install it to use the RevenueCat paywall');
    return false;
  }
  try {
    const result = options.offering
      ? await RevenueCatUI.presentPaywall({ offering: options.offering })
      : await RevenueCatUI.presentPaywall();
    const purchased = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    if (purchased) await triggerPremiumRefresh();
    return purchased;
  } catch (error) {
    console.error('Error presenting paywall:', error);
    return false;
  }
};

/** Offering ID for the "Premium" paywall in RevenueCat (offering: premium_offering). */
const PREMIUM_OFFERING_ID = 'premium_offering';

/**
 * Present the Premium paywall from the offering "premium_offering" (RevenueCat dashboard).
 * Use this for all "Upgrade to Premium" flows so the same paywall design is shown everywhere.
 *
 * @returns {Promise<boolean>} - true if user purchased or restored, false otherwise.
 */
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
    const pkg = getPreferredDefaultPackage(offerings?.current?.availablePackages);
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

/**
 * Present the RevenueCat paywall only if the user does not have the given entitlement.
 * Useful for "hard paywalls" (e.g. show paywall when opening a premium-only screen).
 *
 * @param {Object} opts - { requiredEntitlementIdentifier: string } (e.g. 'premium').
 * @returns {Promise<boolean>} - true if user has entitlement or purchased/restored; false otherwise.
 */
export const presentPaywallIfNeeded = async (opts = {}) => {
  if (Platform.OS !== 'ios') return false;
  if (!RevenueCatUI || !PAYWALL_RESULT) return false;
  const requiredEntitlementIdentifier = opts.requiredEntitlementIdentifier || 'premium';
  try {
    const result = opts.offering
      ? await RevenueCatUI.presentPaywallIfNeeded({
          offering: opts.offering,
          requiredEntitlementIdentifier
        })
      : await RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier });
    const hasAccess = result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED || result === PAYWALL_RESULT.NOT_PRESENTED;
    if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) await triggerPremiumRefresh();
    return hasAccess;
  } catch (error) {
    console.error('Error in presentPaywallIfNeeded:', error);
    return false;
  }
};

/**
 * Whether RevenueCat customerInfo reflects an active subscription or premium entitlement.
 */
export function customerInfoHasActiveSubscription(customerInfo) {
  if (!customerInfo) return false;

  const activeSubscriptions = customerInfo.activeSubscriptions || [];
  const entitlements = customerInfo.entitlements?.active || {};
  const subscriptionsByProduct = customerInfo.subscriptionsByProductIdentifier || {};

  if (activeSubscriptions.length > 0) return true;
  if (Object.keys(entitlements).length > 0) return true;

  return Object.values(subscriptionsByProduct).some((sub) => sub?.isActive);
}

/**
 * After purchase, Apple/RevenueCat can take a moment to mark the subscription active.
 * Poll getCustomerInfo() briefly so the paywall does not show a false "not confirmed" alert.
 */
export async function resolveCustomerInfoAfterPurchase(
  initialCustomerInfo,
  maxAttempts = 5,
  delayMs = 800
) {
  if (customerInfoHasActiveSubscription(initialCustomerInfo)) {
    return initialCustomerInfo;
  }

  if (Platform.OS !== 'ios') {
    return initialCustomerInfo;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      if (customerInfoHasActiveSubscription(customerInfo)) {
        return customerInfo;
      }
    } catch (error) {
      console.warn('[RevenueCat] getCustomerInfo after purchase failed:', error?.message);
    }
  }

  try {
    return (await Purchases.getCustomerInfo()) || initialCustomerInfo;
  } catch {
    return initialCustomerInfo;
  }
}

/**
 * Purchase a package. If the product has a promotional offer (discount), applies it so the
 * Apple payment sheet shows the promo price (e.g. $2.99 for 12 months) instead of the full price.
 */
export const purchasePackage = async (pkg) => {
  try {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'In-app purchases are currently only available on iOS' };
    }

    // Products fetched via getProducts() (not yet in a RevenueCat offering package)
    if (pkg?.isStandaloneProduct && pkg?.product) {
      console.log('Attempting standalone product purchase:', pkg.product.identifier);
      const { customerInfo, productIdentifier } = await Purchases.purchaseStoreProduct(pkg.product);
      console.log('Standalone purchase successful:', { customerInfo, productIdentifier });
      await handlePurchaseUpdate(customerInfo);
      return { success: true, productIdentifier, customerInfo };
    }

    const discount = pkg?.product?.discounts?.[0];
    if (discount) {
      try {
        console.log('Attempting to get promotional offer for discount:', discount.identifier);
        const promoOffer = await Purchases.getPromotionalOffer(pkg.product, discount);
        if (promoOffer) {
          console.log('Purchasing package with promotional offer:', discount.identifier);
          const { customerInfo, productIdentifier } = await Purchases.purchaseDiscountedPackage(pkg, promoOffer);
          console.log('Purchase successful (with promo):', { customerInfo, productIdentifier });
          await handlePurchaseUpdate(customerInfo);
          return { success: true, productIdentifier, customerInfo };
        }
      } catch (promoError) {
        if (promoError.userCancelled) {
          console.log('User cancelled the purchase');
          return { success: false, error: 'User cancelled the purchase' };
        }
        console.warn('Promotional offer not available, falling back to standard purchase:', promoError?.message);
      }
    }

    console.log('Attempting to purchase package:', pkg.identifier);
    const { customerInfo, productIdentifier } = await Purchases.purchasePackage(pkg);
    console.log('Purchase successful:', { customerInfo, productIdentifier });
    
    await handlePurchaseUpdate(customerInfo);
    return { success: true, productIdentifier, customerInfo };
  } catch (error) {
    if (error.userCancelled) {
      console.log('User cancelled the purchase');
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

/**
 * Check if RevenueCat is initialized by trying to access it
 * @returns {Promise<boolean>} - True if initialized, false otherwise
 */
const isRevenueCatInitialized = async () => {
  // First check our internal flag
  if (isInitialized) {
    return true;
  }

  // If still initializing, wait a bit
  if (isInitializing && initPromise) {
    try {
      await Promise.race([
        initPromise,
        new Promise(resolve => setTimeout(resolve, 3000)) // Timeout after 3s
      ]);
      return isInitialized;
    } catch (error) {
      return false;
    }
  }

  // Try to get customer info - this will throw if RevenueCat isn't initialized
  try {
    await Purchases.getCustomerInfo();
    // If we get here, RevenueCat is initialized
    isInitialized = true;
    return true;
  } catch (error) {
    // If we get the "no singleton instance" error, RevenueCat isn't initialized
    if (error.message && error.message.includes('no singleton instance')) {
      return false;
    }
    // Other errors might mean it's initialized but there's a different issue
    // Check our flag again
    return isInitialized;
  }
};

/**
 * Get a specific product by identifier
 * This is useful for consumable products that might not be in offerings
 * @param {string} productIdentifier - The product identifier (e.g., 'neuros_10000')
 * @param {number} maxRetries - Maximum number of retries if RevenueCat isn't initialized (default: 3)
 * @param {number} retryDelay - Delay in milliseconds between retries (default: 1000)
 * @returns {Promise<Object|null>} - The product object or null if not found
 */
export const getProduct = async (productIdentifier, maxRetries = 3, retryDelay = 1000) => {
  try {
    if (Platform.OS !== 'ios') {
      console.log('In-app purchases are currently only available on iOS');
      return null;
    }

    console.log('Getting product:', productIdentifier);
    
    // Wait for RevenueCat to be initialized with retry logic
    let retries = 0;
    while (retries < maxRetries) {
      const isInitialized = await isRevenueCatInitialized();
      
      if (isInitialized) {
        console.log('RevenueCat is initialized, proceeding to fetch product');
        break;
      }
      
      retries++;
      if (retries >= maxRetries) {
        console.warn('RevenueCat not initialized after', maxRetries, 'retries. Make sure initializePurchases() was called before loading products.');
        return null;
      }
      
      console.log(`RevenueCat not initialized yet, retrying in ${retryDelay}ms... (attempt ${retries}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    // First, try to get the product directly by ID
    // This works for products even if they're not in offerings
    console.log('Fetching product directly by ID:', productIdentifier);
    let products = await Purchases.getProducts([productIdentifier]);
    
    // If not found, try checking offerings as a fallback
    // (Products might be in offerings even if direct fetch fails)
    if (!products || products.length === 0) {
      console.log('Product not found via getProducts(), checking all offerings...');
      try {
        const offerings = await Purchases.getOfferings();
        
        // Check current offering first
        if (offerings?.current?.availablePackages) {
          console.log('Checking current offering:', offerings.current.identifier);
          for (const pkg of offerings.current.availablePackages) {
            if (pkg.product.identifier === productIdentifier) {
              console.log('✅ Found product in current offering:', pkg.product.identifier);
              products = [pkg.product];
              break;
            }
          }
        }
        
        // If still not found, check ALL offerings (including neuros_purchase)
        if ((!products || products.length === 0) && offerings?.all) {
          console.log('Checking all offerings...');
          try {
            for (const [offeringId, offering] of Object.entries(offerings.all)) {
              if (offering?.availablePackages) {
                console.log('Checking offering:', offeringId, offering.identifier);
                for (const pkg of offering.availablePackages) {
                  if (pkg.product.identifier === productIdentifier) {
                    console.log('✅ Found product in offering:', offeringId, '- Product:', pkg.product.identifier);
                    products = [pkg.product];
                    break;
                  }
                }
                if (products && products.length > 0) break; // Stop searching if found
              }
            }
          } catch (offeringLoopError) {
            // Silently continue - individual offering access errors are non-critical
            console.log('Note: Could not access all offerings:', offeringLoopError.message);
          }
        }
      } catch (offeringsError) {
        // Don't log configuration errors as warnings - they're expected if products aren't set up yet
        if (offeringsError.message && offeringsError.message.includes('configuration')) {
          console.log('RevenueCat offerings not available (configuration issue) - product may need to be added to offerings');
        } else {
          console.log('Could not check offerings:', offeringsError.message);
        }
      }
    }
    
    console.log('Products fetched:', products?.length || 0, 'products found');
    
    if (!products || products.length === 0) {
      console.warn('Product not found:', productIdentifier);
      console.warn('Possible reasons:');
      console.warn('1. Product not created in App Store Connect');
      console.warn('2. Product not added to RevenueCat Products list');
      console.warn('3. Product not in an Offering (recommended: add to an offering)');
      console.warn('4. Product not synced to RevenueCat (wait 5-10 minutes after creating)');
      console.warn('5. Product ID mismatch (check it matches exactly: ' + productIdentifier + ')');
      console.warn('6. App Store Connect integration not properly configured in RevenueCat');
      return null;
    }

    const product = products[0];
    console.log('Product found:', {
      identifier: product.identifier,
      title: product.title,
      price: product.priceString,
      description: product.description
    });

    return product;
  } catch (error) {
    console.error('Error getting product:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      userInfo: error.userInfo
    });
    return null;
  }
};

/**
 * Purchase a consumable product (like Neuros)
 * This function handles consumable IAPs differently from subscriptions
 * @param {string} productIdentifier - The product identifier (e.g., 'neuros_10000')
 * @returns {Promise<Object>} - { success: boolean, error?: string, productIdentifier?: string }
 */
export const purchaseConsumable = async (productIdentifier) => {
  try {
    if (Platform.OS !== 'ios') {
      return { success: false, error: 'In-app purchases are currently only available on iOS' };
    }

    console.log('Attempting to purchase consumable:', productIdentifier);
    
    // Get the product first to ensure it exists and is available
    const products = await Purchases.getProducts([productIdentifier]);
    if (!products || products.length === 0) {
      console.error('Product not found when attempting to purchase:', productIdentifier);
      return { success: false, error: 'Product not found. Please check App Store Connect and RevenueCat configuration.' };
    }

    const product = products[0];
    
    // Log product details for debugging
    console.log('Product to purchase:', {
      identifier: product.identifier,
      title: product.title,
      price: product.priceString,
      description: product.description
    });
    
    // Verify product has identifier
    if (!product.identifier) {
      console.error('Product object missing identifier:', product);
      return { success: false, error: 'Product data is invalid. Please try again.' };
    }
    
    // Purchase the product directly (not as a package)
    // For consumables, we use purchaseProduct() with the product object
    // Use purchaseStoreProduct() which takes a StoreProduct object
    // purchaseProduct(productIdentifier: string) is deprecated - use purchaseStoreProduct(product) instead
    // This works for any product, while purchasePackage() only works for products in offerings
    console.log('Calling Purchases.purchaseStoreProduct with product:', product.identifier);
    const { customerInfo, productIdentifier: purchasedProductId } = await Purchases.purchaseStoreProduct(product);
    console.log('✅ Consumable purchase successful:', { 
      customerInfo: customerInfo?.originalAppUserId,
      purchasedProductId 
    });
    
    // Handle the consumable purchase (credit neuros)
    await handleConsumablePurchase(customerInfo, purchasedProductId);
    
    return { success: true, productIdentifier: purchasedProductId || productIdentifier };
  } catch (error) {
    if (error.userCancelled) {
      console.log('User cancelled the purchase');
      return { success: false, error: 'User cancelled the purchase' };
    }
    console.error('❌ Error purchasing consumable:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      userInfo: error.userInfo
    });
    return { success: false, error: error.message || 'Failed to complete purchase' };
  }
};

/**
 * Handle consumable purchase - credits Neuros to user's account
 * This function checks the product identifier and credits the appropriate amount
 * @param {Object} customerInfo - RevenueCat customer info object
 * @param {string} productIdentifier - The product identifier that was purchased
 */
const handleConsumablePurchase = async (customerInfo, productIdentifier) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('No user found when handling consumable purchase');
      return;
    }

    // Map product identifiers to neuros amounts. Add new products here when you create them in App Store Connect.
    // See CONSUMABLE_IAP_SETUP_GUIDE.md for how to change prices and add 1k, 5k, etc.
    const NEUROS_PRODUCT_MAP = {
      'neuros_1000': 1000,
      'neuros_5000': 5000,
      'neuros_10000': 10000,
      'neuros_30000': 30000,
      'neuros_100000': 100000,
    };

    const neurosAmount = NEUROS_PRODUCT_MAP[productIdentifier];
    
    if (!neurosAmount) {
      console.warn('Unknown consumable product:', productIdentifier);
      // You might want to log this to a monitoring service
      return;
    }

    console.log(`Crediting ${neurosAmount} Neuros for product: ${productIdentifier}`);

    // Get current balance
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('neuros_balance')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Error fetching current neuros balance:', fetchError);
      throw fetchError;
    }

    const currentBalance = profile?.neuros_balance || 0;
    const newBalance = currentBalance + neurosAmount;

    // Update neuros balance
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ neuros_balance: newBalance })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating neuros balance:', updateError);
      throw updateError;
    }

    // Record the purchase in consumable_purchases table (if it exists)
    // This helps with analytics and prevents duplicate credits
    try {
      const { error: purchaseRecordError } = await supabase
        .from('consumable_purchases')
        .insert({
          user_id: user.id,
          product_id: productIdentifier,
          neuros_amount: neurosAmount,
          transaction_id: customerInfo.originalTransactionId || `consumable_${Date.now()}`,
          platform: Platform.OS,
          purchase_date: new Date().toISOString()
        });

      if (purchaseRecordError) {
        // If table doesn't exist yet, that's okay - we'll create it in a migration
        console.log('Note: consumable_purchases table may not exist yet:', purchaseRecordError.message);
      }
    } catch (recordError) {
      // Non-critical - just log it
      console.log('Could not record consumable purchase (table may not exist):', recordError.message);
    }

    console.log(`Successfully credited ${neurosAmount} Neuros. New balance: ${newBalance}`);
  } catch (error) {
    console.error('Error handling consumable purchase:', error);
    // In production, you might want to queue this for retry or alert support
    throw error;
  }
};

const handlePurchaseUpdate = async (customerInfo) => {
  try {
    console.log('📦 handlePurchaseUpdate STARTED');
    console.log('📦 CustomerInfo received:', JSON.stringify(customerInfo, null, 2));
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('❌ Error getting user:', userError);
      return;
    }
    
    if (!user) {
      console.error('❌ handlePurchaseUpdate: No user found');
      return;
    }

    console.log('📦 handlePurchaseUpdate called for user:', user.id);
    console.log('📦 CustomerInfo structure:', {
      hasEntitlements: !!customerInfo.entitlements,
      hasActive: !!customerInfo.entitlements?.active,
      activeSubscriptions: customerInfo.activeSubscriptions || [],
      subscriptionsByProductIdentifier: customerInfo.subscriptionsByProductIdentifier ? Object.keys(customerInfo.subscriptionsByProductIdentifier) : []
    });

    // Check for active subscriptions - RevenueCat might not populate entitlements.active
    // but will have activeSubscriptions and subscriptionsByProductIdentifier
    const activeSubscriptions = customerInfo.activeSubscriptions || [];
    const subscriptionsByProduct = customerInfo.subscriptionsByProductIdentifier || {};
    const entitlements = customerInfo.entitlements?.active || {};
    
    // Determine if premium by checking active subscriptions or entitlements
    const hasActiveSubscription = activeSubscriptions.length > 0 || Object.keys(entitlements).length > 0;
    
    console.log('📦 Active subscriptions:', activeSubscriptions);
    console.log('📦 Subscriptions by product:', Object.keys(subscriptionsByProduct));
    console.log('📦 Active entitlements:', Object.keys(entitlements));
    console.log('📦 Has active subscription:', hasActiveSubscription);

    if (hasActiveSubscription) {
      // Get the most recent active subscription (prefer yearly over monthly)
      let productId = null;
      let transactionId = null;
      let purchaseDate = null;
      let expirationDate = null;
      
      // First try to get from entitlements
      if (Object.keys(entitlements).length > 0) {
        const subscription = entitlements['premium'] || 
                            entitlements['Premium'] || 
                            Object.values(entitlements)[0];
        
        if (subscription) {
          productId = subscription.productIdentifier;
          transactionId = subscription.originalTransactionId;
          purchaseDate = new Date(subscription.latestPurchaseDate);
          expirationDate = subscription.expirationDate ? new Date(subscription.expirationDate) : null;
        }
      }
      
      // If not found in entitlements, get from subscriptionsByProductIdentifier
      if (!productId && Object.keys(subscriptionsByProduct).length > 0) {
        const sub = pickActiveSubscriptionProduct(subscriptionsByProduct);
        if (sub) {
          productId = sub.productIdentifier;
          // Use storeTransactionId as original_transaction_id
          transactionId = sub.storeTransactionId || sub.originalTransactionId;
          purchaseDate = new Date(sub.purchaseDate);
          expirationDate = sub.expiresDate ? new Date(sub.expiresDate) : null;
          
          console.log('✅ Found subscription from subscriptionsByProductIdentifier:', {
            productId,
            transactionId,
            purchaseDate: purchaseDate.toISOString(),
            expirationDate: expirationDate?.toISOString()
          });
        }
      }

      // Fallback: RevenueCat may expose activeSubscriptions (string[]) but entitlements or
      // subscriptionsByProductIdentifier can be empty or use a different shape. Use
      // activeSubscriptions + allPurchaseDates/allExpirationDates so we never treat a
      // paying user as non-premium.
      if (!productId && activeSubscriptions.length > 0) {
        const allPurchaseDates = customerInfo.allPurchaseDates || {};
        const allExpirationDates = customerInfo.allExpirationDates || {};
        const priority = SUBSCRIPTION_PRODUCT_PRIORITY;
        productId = priority.find((id) => activeSubscriptions.includes(id)) || activeSubscriptions[0];
        const purchaseStr = allPurchaseDates[productId];
        const expirationStr = allExpirationDates[productId];
        purchaseDate = purchaseStr ? new Date(purchaseStr) : new Date();
        expirationDate = expirationStr ? new Date(expirationStr) : null;
        // subscriptions.original_transaction_id is NOT NULL; use a stable fallback so upsert works
        if (!transactionId) {
          transactionId = customerInfo.originalAppUserId
            ? `rc-${customerInfo.originalAppUserId}-${productId}`
            : `rc-${user.id}-${productId}`;
        }
        console.log('✅ Found subscription from activeSubscriptions fallback:', {
          productId,
          transactionId,
          purchaseDate: purchaseDate.toISOString(),
          expirationDate: expirationDate?.toISOString()
        });
      }
      
      if (!productId) {
        console.error('❌ No active subscription found in entitlements or subscriptionsByProductIdentifier');
        console.error('❌ Active subscriptions list:', activeSubscriptions);
        return;
      }

      // If no expiration date, calculate it based on product identifier
      // Monthly subscriptions are typically 30 days, yearly are 365 days
      if (!expirationDate) {
        const daysToAdd = getSubscriptionDurationDays(productId);
        expirationDate = new Date(purchaseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        console.log('⚠️ No expiration date from RevenueCat, calculated:', expirationDate.toISOString());
      }

      console.log('📦 Subscription details:', {
        productIdentifier: productId,
        originalTransactionId: transactionId,
        purchaseDate: purchaseDate.toISOString(),
        expirationDate: expirationDate.toISOString()
      });

      // First, try to insert the subscription record
      // Use upsert with onConflict to handle if it already exists
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

      console.log('📦 Inserting subscription data:', JSON.stringify(subscriptionData, null, 2));
      console.log('📦 User ID:', user.id);
      console.log('📦 Profile ID:', user.id);
      console.log('📦 Auth UID check:', 'Will verify RLS policy allows insert');

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
        console.error('❌ Error calling upsert_subscription_service_role:', functionError);
        console.error('❌ Function error details:', JSON.stringify(functionError, null, 2));
        
        // Fallback to direct insert/upsert if function doesn't exist
        console.log('📦 Falling back to direct insert/upsert...');
        const { data: insertResult, error: insertError } = await supabase
          .from('subscriptions')
          .insert(subscriptionData)
          .select();

        if (insertError) {
          console.error('❌ Error inserting subscription:', insertError);
          
          // If insert fails due to duplicate, try upsert
          if (insertError.code === '23505') { // Unique violation
            console.log('📦 Duplicate detected, trying upsert instead...');
            const { data: upsertResult, error: upsertError } = await supabase
              .from('subscriptions')
              .upsert(subscriptionData, {
                onConflict: 'original_transaction_id',
                ignoreDuplicates: false
              })
              .select();
            
            if (upsertError) {
              console.error('❌ Error upserting subscription:', upsertError);
              throw upsertError;
            } else {
              console.log('✅ Subscription upserted successfully:', upsertResult);
            }
          } else {
            throw insertError;
          }
        } else {
          console.log('✅ Subscription inserted successfully:', insertResult);
        }
      } else {
        console.log('✅ Subscription upserted via service role function:', functionResult);
      }

      // Update is_premium in profiles table
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_premium: true })
        .eq('id', user.id);

      if (profileError) {
        console.error('❌ Error updating premium status:', profileError);
      } else {
        console.log('✅ Premium status updated to true');
      }

      console.log('✅ Subscription and premium status updated in Supabase:', {
        userId: user.id,
        productId: productId,
        transactionId: transactionId,
        status: 'active',
        expirationDate: expirationDate?.toISOString(),
        isPremium: true
      });
      triggerPremiumRefresh();
    } else {
      // If not premium, update both tables to reflect that
      console.log('📦 User is not premium, updating status to expired');
      
      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ status: 'expired' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (updateError) {
        console.error('❌ Error updating subscription status:', updateError);
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_premium: false })
        .eq('id', user.id);

      if (profileError) {
        console.error('❌ Error updating premium status:', profileError);
      }

      console.log('✅ Premium status removed:', {
        userId: user.id,
        isPremium: false
      });
      triggerPremiumRefresh();
    }
  } catch (error) {
    console.error('❌ Error handling purchase update:', error);
    console.error('❌ Error stack:', error.stack);
  }
};

/**
 * Mock purchase function for testing
 * This simulates a successful purchase without going through the App Store
 * Only use this for development/testing purposes
 * 
 * @param {string} productId - The product identifier (e.g., 'betteru_premium_monthly')
 * @param {string} packageType - The package type ('MONTHLY' or 'ANNUAL')
 * @returns {Promise<Object>} - { success: boolean, error?: string }
 */
export const mockPurchase = async (productId, packageType = 'MONTHLY') => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'No user logged in' };
    }

    console.log('🧪 MOCK PURCHASE: Simulating purchase for', productId);

    // Calculate subscription duration based on package type
    const now = new Date();
    let endDate;
    if (packageType === 'ANNUAL' || productId.includes('yearly')) {
      // 1 year from now
      endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      // 1 month from now
      endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    // Create a mock transaction ID
    const transactionId = `mock_${Date.now()}_${user.id}`;

    // Create subscription record in Supabase
    const { error: subError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: user.id,
        profile_id: user.id,
        product_id: productId,
        original_transaction_id: transactionId,
        latest_receipt: JSON.stringify({ mock: true, userId: user.id }),
        status: 'active',
        purchase_date: now.toISOString(),
        start_date: now.toISOString(),
        end_date: endDate.toISOString(),
        platform: Platform.OS
      }, {
        onConflict: 'original_transaction_id'
      });

    if (subError) {
      console.error('Error creating mock subscription:', subError);
      return { success: false, error: subError.message };
    }

    // Update is_premium in profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ is_premium: true })
      .eq('id', user.id);

    if (profileError) {
      console.error('Error updating premium status:', profileError);
      return { success: false, error: profileError.message };
    }

    console.log('✅ MOCK PURCHASE: Successfully created subscription');
    return { 
      success: true, 
      productIdentifier: productId,
      transactionId,
      endDate: endDate.toISOString()
    };
  } catch (error) {
    console.error('Error in mock purchase:', error);
    return { success: false, error: error.message };
  }
}; 