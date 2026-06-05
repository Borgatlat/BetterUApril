import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { purchaseConsumable, getProduct } from '../lib/purchases';
import { Platform } from 'react-native';
import { normalizeImageUrl } from '../utils/imageUrlHelpers';
import { purchaseBond, getBondConfig, calculateBondPayout } from '../lib/bonds';
import { getStreakStatus } from '../utils/streakHelpers';

// Profile theme definitions (visual properties - costs come from database)
const PROFILE_THEMES = {
  default: {
    name: 'Default',
    backgroundColor: '#1a1a1a', // Lightened from #000000
    gradientColors: ['#1a1a1a', '#2a2a2a'], // Lightened from #000000, #0a0a0a
  },
  light_blue: {
    name: 'Ocean Blue',
    backgroundColor: '#2a4f7f', // Lightened from #1e3a5f
    gradientColors: ['#2a4f7f', '#1a2f4f'], // Lightened from #1e3a5f, #0d1b2a
  },
  pink: {
    name: 'Sunset Pink',
    backgroundColor: '#6a295a', // Lightened from #4a1942
    gradientColors: ['#6a295a', '#4a2942'], // Lightened from #4a1942, #2d132c
  },
  green: {
    name: 'Forest Green',
    backgroundColor: '#2a5a3a', // Lightened from #1a3a2a
    gradientColors: ['#2a5a3a', '#1a3f2a'], // Lightened from #1a3a2a, #0d1f15
  },
  midnight_blue: {
    name: 'Midnight Blue',
    backgroundColor: '#1a2640', // Lightened from #0a1628
    gradientColors: ['#1a2640', '#0f1a28'], // Lightened from #0a1628, #050a14
  },
  charcoal: {
    name: 'Charcoal',
    backgroundColor: '#2a2a2a', // Lightened from #1a1a1a
    gradientColors: ['#2a2a2a', '#1f1f1f'], // Lightened from #1a1a1a, #0f0f0f
  },
  crimson_night: {
    name: 'Crimson Night',
    backgroundColor: '#4d1a1a', // Lightened from #2d0a0a
    gradientColors: ['#4d1a1a', '#2a0f0f'], // Lightened from #2d0a0a, #1a0505
  },
  royal_purple: {
    name: 'Royal Purple',
    backgroundColor: '#2a1a4e', // Lightened from #1a0a2e
    gradientColors: ['#2a1a4e', '#1a0f2a'], // Lightened from #1a0a2e, #0f051a
  },
  emerald_dark: {
    name: 'Emerald Dark',
    backgroundColor: '#1a3f2a', // Lightened from #0a1f1a
    gradientColors: ['#1a3f2a', '#0f2f1a'], // Lightened from #0a1f1a, #050f0d
  },
  golden_hour: {
    name: 'Golden Hour',
    backgroundColor: '#4a3f1a', // Lightened from #2a1f0a
    gradientColors: ['#4a3f1a', '#2a2f0f'], // Lightened from #2a1f0a, #1a1206
  },
  aurora: {
    name: 'Aurora',
    backgroundColor: '#1a2a4a', // Lightened from #0a1a2a
    gradientColors: ['#1a2a4a', '#0f1a2a'], // Lightened from #0a1a2a, #050d15
  },
  volcanic: {
    name: 'Volcanic',
    backgroundColor: '#3f1a1a', // Lightened from #1f0a0a
    gradientColors: ['#3f1a1a', '#2a0f0f'], // Lightened from #1f0a0a, #120505
  },
  platinum: {
    name: 'Platinum',
    backgroundColor: '#2a2a3f', // Lightened from #1a1a1f
    gradientColors: ['#2a2a3f', '#1f1f2a'], // Lightened from #1a1a1f, #0f0f12
  },
  neon_cyber: {
    name: 'Neon Cyber',
    backgroundColor: '#1f1a2a', // Lightened from #0f0a1a
    gradientColors: ['#1f1a2a', '#0f0f1a'], // Lightened from #0f0a1a, #08050d
  },
  obsidian: {
    name: 'Obsidian',
    backgroundColor: '#151515', // Lightened from #050505
    gradientColors: ['#151515', '#0a0a0a'], // Lightened from #050505, #000000
  },
};

export default function StoreScreen() {
  const router = useRouter();
  const { userProfile, updateProfile } = useUser();
  const { user } = useAuth();
  const [themeCosts, setThemeCosts] = useState({});
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(null);
  
  // Custom background state
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  // Background upload cost is hardcoded to 10,000 Neuros
  const backgroundUploadCost = 10000;
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [showBackgroundModal, setShowBackgroundModal] = useState(false);
  
  // Rotating themes state
  const [rotatingThemes, setRotatingThemes] = useState([]);
  const [currentRotationId, setCurrentRotationId] = useState(null);
  const [assigningThemes, setAssigningThemes] = useState(false);
  
  // Neuros purchase state
  const [purchasingNeuros, setPurchasingNeuros] = useState(false);
  const [neurosProducts, setNeurosProducts] = useState([]); // Array of products: neuros_10000, neuros_30000, neuros_100000
  const [loadingNeurosProducts, setLoadingNeurosProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState(null);
  
  // Bond market state
  const [bondConfig, setBondConfig] = useState(null);
  const [purchasingBond, setPurchasingBond] = useState(false);
  const [selectedBondTier, setSelectedBondTier] = useState(null);
  const [showBondModal, setShowBondModal] = useState(false);

  // Fetch rotating themes for current rotation
  useEffect(() => {
    const fetchRotatingThemes = async () => {
      if (!user?.id) return;
      
      try {
        setLoading(true);
        
        // Get current rotation - try RPC first, fallback to direct query
        let rotationId = null;
        
        // Try RPC function
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('get_current_rotation');
        
        if (!rpcError && rpcData) {
          rotationId = rpcData;
          console.log('✅ Got rotation from RPC:', rotationId);
        } else {
          console.log('⚠️ RPC failed, trying direct query. Error:', rpcError);
          // Fallback: query directly - check if today is between week_start_date and week_end_date
          const today = new Date().toISOString().split('T')[0];
          const { data: rotationData, error: rotationError } = await supabase
            .from('theme_rotations')
            .select('id, week_start_date, week_end_date, rotation_number')
            .eq('is_active', true)
            .lte('week_start_date', today)
            .gte('week_end_date', today)
            .order('rotation_number', { ascending: false })
            .limit(1);
          
          if (rotationError) {
            console.error('❌ Error fetching current rotation:', rotationError);
            setLoading(false);
            return;
          }
          
          if (rotationData && rotationData.length > 0) {
            rotationId = rotationData[0].id;
            console.log('✅ Got rotation from direct query:', rotationId, rotationData[0]);
          } else {
            console.log('⚠️ No rotation found. Today:', today, 'Available rotations:', rotationData);
          }
        }
        
        if (!rotationId) {
          console.log('❌ No active rotation found - make sure you created a rotation!');
          // Check if any rotations exist at all
          const { data: allRotations } = await supabase
            .from('theme_rotations')
            .select('id, week_start_date, week_end_date, is_active, rotation_number')
            .order('rotation_number', { ascending: false })
            .limit(5);
          console.log('📋 All rotations in database:', allRotations);
          setLoading(false);
          return;
        }
        
        setCurrentRotationId(rotationId);
        
        // Check if themes exist in bank
        const { data: bankThemes, error: bankError } = await supabase
          .from('theme_bank')
          .select('id, name, is_active, is_rotating')
          .eq('is_active', true)
          .eq('is_rotating', true);
        
        if (bankError) {
          console.error('❌ Error checking theme bank:', bankError);
        } else {
          console.log('📚 Themes in bank:', bankThemes?.length || 0);
          if (!bankThemes || bankThemes.length === 0) {
            console.log('❌ No themes in theme_bank! Add themes first.');
            setLoading(false);
            return;
          }
        }
        
        // Check if user has slots for this rotation
        const { data: slotsData, error: slotsError } = await supabase
          .from('user_theme_slots')
          .select('*')
          .eq('user_id', user.id)
          .eq('rotation_id', rotationId);
        
        if (slotsError) {
          console.error('❌ Error fetching user slots:', slotsError);
          setLoading(false);
          return;
        }
        
        console.log('📦 User slots:', slotsData?.length || 0);
        
        // If user doesn't have slots, assign them
        if (!slotsData || slotsData.length === 0) {
          console.log('🔄 Assigning themes to user...');
          setAssigningThemes(true);
          const { error: assignError } = await supabase
            .rpc('assign_user_theme_slots', {
              p_user_id: user.id,
              p_rotation_id: rotationId
            });
          
          if (assignError) {
            console.error('❌ Error assigning themes:', assignError);
            setAssigningThemes(false);
            setLoading(false);
            return;
          }
          
          console.log('✅ Themes assigned, fetching slots...');
          
          // Wait a moment for the assignment to complete
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Fetch the newly assigned slots
          // Include theme_bank.neuros_cost and rarity to prioritize per-theme pricing and use up-to-date rarities
          const { data: newSlotsData, error: newSlotsError } = await supabase
            .from('user_theme_slots')
            .select(`
              *,
              theme:theme_id (
                id,
                name,
                theme_key,
                image_url,
                background_color,
                gradient_colors,
                description,
                neuros_cost,
                rarity
              )
            `)
            .eq('user_id', user.id)
            .eq('rotation_id', rotationId)
            .order('slot_number', { ascending: true });
          
          if (newSlotsError) {
            console.error('❌ Error fetching new slots:', newSlotsError);
            setAssigningThemes(false);
            setLoading(false);
            return;
          }
          
          console.log('✅ Fetched slots:', newSlotsData?.length || 0, 'themes');
          setRotatingThemes(newSlotsData || []);
          setAssigningThemes(false);
        } else {
          // Fetch theme details for existing slots
          // Include theme_bank.neuros_cost and rarity to prioritize per-theme pricing and use up-to-date rarities
          const { data: themesData, error: themesError } = await supabase
            .from('user_theme_slots')
            .select(`
              *,
              theme:theme_id (
                id,
                name,
                theme_key,
                image_url,
                background_color,
                gradient_colors,
                description,
                neuros_cost,
                rarity
              )
            `)
            .eq('user_id', user.id)
            .eq('rotation_id', rotationId)
            .order('slot_number', { ascending: true });
          
          if (themesError) {
            console.error('❌ Error fetching themes:', themesError);
            setLoading(false);
            return;
          }
          
          console.log('✅ Fetched existing themes:', themesData?.length || 0, 'themes');
          setRotatingThemes(themesData || []);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching rotating themes:', error);
        setLoading(false);
      }
    };
    
    fetchRotatingThemes();
  }, [user?.id]);

  // Fetch custom backgrounds and upload cost
  useEffect(() => {
    const fetchCustomBackgrounds = async () => {
      if (!user?.id) return;
      
      try {
        // Fetch user's custom backgrounds
        const { data: backgrounds, error: bgError } = await supabase
          .from('custom_backgrounds')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (bgError) {
          console.error('Error fetching custom backgrounds:', bgError);
          return;
        }
        
        setCustomBackgrounds(backgrounds || []);
        
        // Background upload cost is hardcoded to 10,000 Neuros
        // No need to fetch from database
      } catch (error) {
        console.error('Error fetching custom backgrounds:', error);
      }
    };
    
    fetchCustomBackgrounds();
  }, [user?.id]);

  // Fetch bond configuration (interest rates)
  useEffect(() => {
    const fetchBondConfig = async () => {
      try {
        const result = await getBondConfig();
        if (result.success) {
          setBondConfig(result.config);
        }
      } catch (error) {
        console.error('Error fetching bond config:', error);
      }
    };
    
    fetchBondConfig();
  }, []);

  // Fetch classic theme costs from profile_theme_costs so classic themes require purchase at correct prices
  // (Without this, themeCosts stays {} and getThemeCost returns 0 for all, making every theme "free")
  useEffect(() => {
    const fetchClassicThemeCosts = async () => {
      try {
        const { data, error } = await supabase
          .from('profile_theme_costs')
          .select('theme_key, neuros_cost')
          .eq('is_active', true);
        if (error) {
          console.warn('Store: could not fetch profile_theme_costs:', error.message);
          return;
        }
        const costsMap = {};
        data?.forEach((item) => {
          costsMap[item.theme_key] = item.neuros_cost ?? 0;
        });
        setThemeCosts(costsMap);
      } catch (err) {
        console.warn('Store: error fetching classic theme costs:', err);
      }
    };
    fetchClassicThemeCosts();
  }, []);

  // Load Neuros purchase products (all three: 10k, 30k, 100k)
  // Wait for user to be available so RevenueCat is initialized
  const loadNeurosProducts = async () => {
    // Only load on iOS
    if (Platform.OS !== 'ios') {
      return;
    }

    // Wait for user to be available (ensures RevenueCat is initialized)
    if (!user?.id) {
      console.log('⏳ Waiting for user to load before fetching products...');
      setProductLoadError('Waiting for user to load...');
      return;
    }

    setLoadingNeurosProducts(true);
    setProductLoadError(null);
    
    try {
      // Product identifiers - must match what you set in App Store Connect and RevenueCat
      const productIds = ['neuros_1000', 'neuros_5000', 'neuros_10000', 'neuros_30000', 'neuros_100000'];
      console.log('🔄 Attempting to load neuros products:', productIds);
      
      // Load all products in parallel
      // getProduct now has built-in retry logic for RevenueCat initialization
      const productPromises = productIds.map(productId => 
        getProduct(productId, 8, 1500) // 8 retries with 1.5s delay = ~12 seconds
      );
      
      const products = await Promise.all(productPromises);
      
      // Filter out null results and set products (sort by amount: 10k, 30k, 100k)
      const validProducts = products.filter(p => p !== null);
      
      if (validProducts.length > 0) {
        // Sort products by identifier to ensure consistent order
        validProducts.sort((a, b) => {
          const order = { 'neuros_1000': 0, 'neuros_5000': 1, 'neuros_10000': 2, 'neuros_30000': 3, 'neuros_100000': 4 };
          return (order[a.identifier] ?? 999) - (order[b.identifier] ?? 999);
        });
        
        setNeurosProducts(validProducts);
        setProductLoadError(null);
        console.log(`✅ Loaded ${validProducts.length} neuros products:`, 
          validProducts.map(p => ({ identifier: p.identifier, price: p.priceString }))
        );
      } else {
        const errorMsg = 'Products not found. Make sure:\n1. Products exist in App Store Connect\n2. Products are in RevenueCat\n3. Wait 5-10 min after creating\n4. Try the Retry button';
        setProductLoadError(errorMsg);
        console.warn('❌ No neuros products found');
      }
    } catch (error) {
      const errorMsg = error.message || 'Failed to load products. Please try again.';
      setProductLoadError(errorMsg);
      console.error('❌ Error loading neuros products:', error);
    } finally {
      setLoadingNeurosProducts(false);
    }
  };

  useEffect(() => {
    // Start loading after user is available
    if (user?.id) {
      loadNeurosProducts();
    }
  }, [user?.id]);

  // Get theme cost from database (defaults to 0 if not found)
  const getThemeCost = (themeKey) => {
    return themeCosts[themeKey] ?? 0;
  };

  // Check if theme is unlocked (free or purchased)
  const isThemeUnlocked = (themeKey) => {
    const cost = getThemeCost(themeKey);
    
    // Free themes are always unlocked
    if (cost === 0) return true;
    
    // Check if user has purchased this theme
    const purchasedThemes = userProfile?.purchased_themes || [];
    return purchasedThemes.includes(themeKey);
  };

  // Handle rotating theme purchase
  const handlePurchaseRotatingTheme = async (slot) => {
    if (!slot || !slot.theme) return;
    
    const theme = slot.theme;
    const neurosBalance = userProfile?.neuros_balance || 0;
    // Prioritize theme_bank.neuros_cost (per-theme pricing) if set
    // If NULL, fall back to slot.neuros_cost (rarity-based pricing)
    const themeCost = theme?.neuros_cost !== null && theme?.neuros_cost !== undefined
      ? theme.neuros_cost  // Use per-theme price from theme_bank
      : slot.neuros_cost;   // Fall back to rarity-based price from slot
    
    // Check if already purchased
    const purchasedThemes = userProfile?.purchased_themes || [];
    if (purchasedThemes.includes(theme.theme_key)) {
      // Already owned, just activate
      try {
        await supabase
          .from('profiles')
          .update({ profile_theme: theme.theme_key })
          .eq('id', user?.id);
        
        if (updateProfile) {
          updateProfile({ profile_theme: theme.theme_key });
        }
        
        Alert.alert('Success!', `"${theme.name}" theme activated!`);
        router.back();
      } catch (error) {
        console.error('Error activating theme:', error);
        Alert.alert('Error', 'Failed to activate theme. Please try again.');
      }
      return;
    }
    
    // Check if user has enough neuros
    if (neurosBalance < themeCost) {
      Alert.alert(
        'Not Enough Neuros',
        `This theme costs ${themeCost} Neuros, but you only have ${neurosBalance}. Refer friends to earn more Neuros!`,
        [
          { text: 'OK' },
          { 
            text: 'Earn Neuros', 
            onPress: () => {
              router.back();
              setTimeout(() => {
                router.push('/(tabs)/profile');
              }, 300);
            }
          }
        ]
      );
      return;
    }
    
    // Confirm purchase
    const displayRarity = theme?.rarity || slot?.slot_rarity || 'common';
    const displayRarityLabel = displayRarity.charAt(0).toUpperCase() + displayRarity.slice(1);
    setSelectedTheme(theme.theme_key);
    Alert.alert(
      'Purchase Theme?',
      `Purchase "${theme.name}" (${displayRarityLabel}) for ${themeCost} Neuros?\n\nYou will have ${neurosBalance - themeCost} Neuros remaining.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedTheme(null) },
        {
          text: 'Purchase',
          onPress: async () => {
            setPurchasing(true);
            try {
              // Deduct neuros and add to purchased themes
              const newNeurosBalance = neurosBalance - themeCost;
              const purchasedThemes = [...(userProfile?.purchased_themes || []), theme.theme_key];
              
              // Deactivate all custom backgrounds for this user
              await supabase
                .from('custom_backgrounds')
                .update({ is_active: false })
                .eq('user_id', user?.id);
              
              const { error: purchaseError } = await supabase
                .from('profiles')
                .update({
                  neuros_balance: newNeurosBalance,
                  purchased_themes: purchasedThemes,
                  profile_theme: theme.theme_key, // Also set as active theme
                  active_custom_background_id: null
                })
                .eq('id', user?.id);

              if (purchaseError) throw purchaseError;

              // Refresh backgrounds list
              const { data: backgrounds } = await supabase
                .from('custom_backgrounds')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
              
              setCustomBackgrounds(backgrounds || []);

              // Update local profile
              if (updateProfile) {
                updateProfile({
                  neuros_balance: newNeurosBalance,
                  purchased_themes: purchasedThemes,
                  profile_theme: theme.theme_key,
                  active_custom_background_id: null
                });
              }

              Alert.alert('Success!', `"${theme.name}" theme purchased and activated!`);
              setSelectedTheme(null);
              router.back();
            } catch (error) {
              console.error('Error purchasing theme:', error);
              Alert.alert('Error', 'Failed to purchase theme. Please try again.');
            } finally {
              setPurchasing(false);
            }
          }
        }
      ]
    );
  };

  // Handle theme purchase (old function - kept for compatibility)
  const handlePurchase = async (themeKey) => {
    const theme = PROFILE_THEMES[themeKey];
    if (!theme) return;

    const neurosBalance = userProfile?.neuros_balance || 0;
    const isUnlocked = isThemeUnlocked(themeKey);
    const themeCost = getThemeCost(themeKey);

    // If already unlocked, just activate it
    if (isUnlocked) {
      try {
        // Deactivate all custom backgrounds for this user
        await supabase
          .from('custom_backgrounds')
          .update({ is_active: false })
          .eq('user_id', user?.id);
        
        const { error } = await supabase
          .from('profiles')
          .update({ 
            profile_theme: themeKey,
            active_custom_background_id: null // Clear custom background when theme is selected
          })
          .eq('id', user?.id);

        if (error) throw error;

        // Refresh backgrounds list to update active status
        const { data: backgrounds } = await supabase
          .from('custom_backgrounds')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        setCustomBackgrounds(backgrounds || []);

        if (updateProfile) {
          updateProfile({ 
            profile_theme: themeKey,
            active_custom_background_id: null // Clear custom background in local state
          });
        }

        Alert.alert('Success!', `"${theme.name}" theme activated!`);
        router.back();
      } catch (error) {
        console.error('Error activating theme:', error);
        Alert.alert('Error', 'Failed to activate theme. Please try again.');
      }
      return;
    }

    // Check if user has enough neuros
    if (neurosBalance < themeCost) {
      Alert.alert(
        'Not Enough Neuros',
        `This theme costs ${themeCost} Neuros, but you only have ${neurosBalance}. Refer friends to earn more Neuros!`,
        [
          { text: 'OK' },
          { 
            text: 'Earn Neuros', 
            onPress: () => {
              router.back();
              // Navigate to referral section after a delay
              setTimeout(() => {
                router.push('/(tabs)/profile');
              }, 300);
            }
          }
        ]
      );
      return;
    }

    // Confirm purchase
    setSelectedTheme(themeKey);
    Alert.alert(
      'Purchase Theme?',
      `Purchase "${theme.name}" for ${themeCost} Neuros?\n\nYou will have ${neurosBalance - themeCost} Neuros remaining.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => setSelectedTheme(null) },
        {
          text: 'Purchase',
          onPress: async () => {
            setPurchasing(true);
            try {
              // Deduct neuros and add to purchased themes
              const newNeurosBalance = neurosBalance - themeCost;
              const purchasedThemes = [...(userProfile?.purchased_themes || []), themeKey];
              
              // Deactivate all custom backgrounds for this user
              await supabase
                .from('custom_backgrounds')
                .update({ is_active: false })
                .eq('user_id', user?.id);
              
              const { error: purchaseError } = await supabase
                .from('profiles')
                .update({
                  neuros_balance: newNeurosBalance,
                  purchased_themes: purchasedThemes,
                  profile_theme: themeKey, // Also set as active theme
                  active_custom_background_id: null // Clear custom background when theme is selected
                })
                .eq('id', user?.id);

              if (purchaseError) throw purchaseError;

              // Refresh backgrounds list to update active status
              const { data: backgrounds } = await supabase
                .from('custom_backgrounds')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
              
              setCustomBackgrounds(backgrounds || []);

              // Update local profile
              if (updateProfile) {
                updateProfile({
                  neuros_balance: newNeurosBalance,
                  purchased_themes: purchasedThemes,
                  profile_theme: themeKey,
                  active_custom_background_id: null // Clear custom background in local state
                });
              }

              Alert.alert('Success!', `"${theme.name}" theme purchased and activated!`);
              setSelectedTheme(null);
              router.back();
            } catch (error) {
              console.error('Error purchasing theme:', error);
              Alert.alert('Error', 'Failed to purchase theme. Please try again.');
            } finally {
              setPurchasing(false);
            }
          }
        }
      ]
    );
  };

  /**
   * Upload custom background image
   * This function handles the entire flow:
   * 1. Checks user has enough neuros
   * 2. Deducts neuros from balance
   * 3. Uploads image to Cloudinary
   * 4. Saves background to database
   * 5. Sets it as active
   */
  const handleBackgroundUpload = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to upload backgrounds.');
      return;
    }

    // Check neuros balance
    const currentNeuros = userProfile?.neuros_balance || 0;
    if (currentNeuros < backgroundUploadCost) {
      Alert.alert(
        'Insufficient Neuros',
        `You need ${backgroundUploadCost.toLocaleString()} Neuros to upload a custom background.\n\nCurrent balance: ${currentNeuros.toLocaleString()} ⭐`,
        [
          { text: 'OK' },
          {
            text: 'Earn Neuros',
            onPress: () => {
              router.back();
              setTimeout(() => {
                router.push('/(tabs)/profile');
              }, 300);
            }
          }
        ]
      );
      return;
    }

    // Ask for permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photos to upload a background.');
      return;
    }

    // Pick image with rectangular aspect ratio (9:16 portrait)
    // This matches the phone's screen shape - tall and narrow (portrait orientation)
    // The aspect array is [width, height], so [9, 16] means 9:16 ratio (portrait)
    // Note: On iOS, the crop frame should be rectangular, not square
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16], // Portrait rectangular: width 9, height 16 (tall rectangle, not square)
      quality: 0.8,
      // Ensure we get the edited image with the correct aspect ratio
      exif: false,
    });

    if (result.canceled || !result.assets || !result.assets[0]?.uri) return;

    setUploadingBackground(true);
    try {
      // Step 1: Deduct neuros first (before upload to prevent free uploads if balance changes)
      // Get current balance
      const { data: profileData, error: fetchError } = await supabase
        .from('profiles')
        .select('neuros_balance')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;

      const currentBalance = profileData?.neuros_balance || 0;
      if (currentBalance < backgroundUploadCost) {
        throw new Error(`Insufficient Neuros. You need ${backgroundUploadCost.toLocaleString()} Neuros.`);
      }

      // Deduct neuros
      const newBalance = currentBalance - backgroundUploadCost;
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ neuros_balance: newBalance })
        .eq('id', user.id);

      if (deductError) {
        throw new Error(`Failed to deduct Neuros: ${deductError.message}`);
      }

      // Step 2: Upload to Cloudinary
      const formData = new FormData();
      formData.append('file', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'background.jpg',
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
      if (!data.secure_url) throw new Error('Upload failed');

      // Step 3: Save background to database and set as active
      // First, deactivate all existing backgrounds
      await supabase
        .from('custom_backgrounds')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Insert new background as active
      const { data: newBackground, error: insertError } = await supabase
        .from('custom_backgrounds')
        .insert({
          user_id: user.id,
          image_url: data.secure_url,
          is_active: true,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update profile to reference the new background
      await supabase
        .from('profiles')
        .update({ active_custom_background_id: newBackground.id })
        .eq('id', user.id);

      // Refresh backgrounds list
      const { data: backgrounds } = await supabase
        .from('custom_backgrounds')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setCustomBackgrounds(backgrounds || []);

      // Update local profile with new neuros balance
      if (updateProfile) {
        await updateProfile({ neuros_balance: newBalance });
      }

      Alert.alert('Success!', `Background uploaded successfully! ${backgroundUploadCost.toLocaleString()} Neuros deducted.`);
      setShowBackgroundModal(false);
    } catch (error) {
      console.error('Error uploading background:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload background. Please try again.');
    } finally {
      setUploadingBackground(false);
    }
  };

  /**
   * Set a custom background as active
   */
  const handleSetActiveBackground = async (backgroundId) => {
    if (!user?.id) return;

    try {
      // Deactivate all backgrounds
      await supabase
        .from('custom_backgrounds')
        .update({ is_active: false })
        .eq('user_id', user.id);

      // Activate selected background
      const { error } = await supabase
        .from('custom_backgrounds')
        .update({ is_active: true })
        .eq('id', backgroundId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update profile reference
      await supabase
        .from('profiles')
        .update({ active_custom_background_id: backgroundId })
        .eq('id', user.id);

      // Refresh backgrounds
      const { data: backgrounds } = await supabase
        .from('custom_backgrounds')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      setCustomBackgrounds(backgrounds || []);

      // Update local profile
      if (updateProfile) {
        const active = backgrounds?.find(bg => bg.id === backgroundId);
        if (active) {
          await updateProfile({ active_custom_background_id: active.id });
        }
      }

      Alert.alert('Success', 'Background activated!');
    } catch (error) {
      console.error('Error setting active background:', error);
      Alert.alert('Error', 'Failed to set background. Please try again.');
    }
  };

  /**
   * Delete a custom background
   */
  const handleDeleteBackground = async (backgroundId) => {
    if (!user?.id) return;

    const background = customBackgrounds.find(bg => bg.id === backgroundId);
    if (!background) return;

    Alert.alert(
      'Delete Background',
      'Are you sure you want to delete this background? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // If it's the active background, we need to clear the profile reference
              if (background.is_active) {
                await supabase
                  .from('profiles')
                  .update({ active_custom_background_id: null })
                  .eq('id', user.id);
              }

              // Delete the background
              const { error } = await supabase
                .from('custom_backgrounds')
                .delete()
                .eq('id', backgroundId)
                .eq('user_id', user.id);

              if (error) throw error;

              // Refresh backgrounds
              const { data: backgrounds } = await supabase
                .from('custom_backgrounds')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

              setCustomBackgrounds(backgrounds || []);

              if (background.is_active && updateProfile) {
                await updateProfile({ active_custom_background_id: null });
              }

              Alert.alert('Success', 'Background deleted successfully.');
            } catch (error) {
              console.error('Error deleting background:', error);
              Alert.alert('Error', 'Failed to delete background. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Get rarity color
  const getRarityColor = (rarity) => {
    switch (rarity) {
      case 'common': return '#9e9e9e'; // Gray
      case 'rare': return '#2196f3'; // Blue
      case 'epic': return '#9c27b0'; // Purple
      case 'legendary': return '#ff9800'; // Orange
      case 'mythic': return '#f44336'; // Red
      default: return '#9e9e9e';
    }
  };

  /**
   * Handle bond purchase
   * This function handles purchasing a bond with Neuros
   * Bonds provide weekly ROI but require maintaining a daily activity streak.
   * Users cannot buy bonds if their current activity streak is 0.
   */
  const handlePurchaseBond = async (bondTier) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to purchase bonds');
      return;
    }

    // Block purchase if current activity streak is 0
    const streak = await getStreakStatus(user.id);
    if (streak?.currentStreak === 0) {
      Alert.alert(
        'Streak Required',
        'You need an activity streak to buy bonds. Complete a workout, mental session, or run today to start your streak, then try again.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Show confirmation modal with bond details
    setSelectedBondTier(bondTier);
    setShowBondModal(true);
  };

  /**
   * Confirm and execute bond purchase
   */
  const confirmBondPurchase = async () => {
    if (!selectedBondTier || !user?.id) return;

    setPurchasingBond(true);
    try {
      const result = await purchaseBond(selectedBondTier);
      
      if (result.success) {
        // Refresh user profile to get updated balance
        if (updateProfile) {
          const { data: updatedProfile } = await supabase
            .from('profiles')
            .select('neuros_balance')
            .eq('id', user.id)
            .single();
          
          if (updatedProfile) {
            updateProfile({ neuros_balance: updatedProfile.neuros_balance });
          }
        }

        Alert.alert(
          'Bond Purchased!',
          `You've successfully purchased a ${result.bondAmount} Neuros bond. Maintain your daily activity streak to earn interest!`,
          [{ text: 'OK', onPress: () => {
            setShowBondModal(false);
            setSelectedBondTier(null);
            // Navigate to bonds management screen
            router.push('/bonds');
          }}]
        );
      } else {
        Alert.alert('Purchase Failed', result.error || 'Failed to purchase bond. Please try again.');
      }
    } catch (error) {
      console.error('Error purchasing bond:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setPurchasingBond(false);
    }
  };

  /**
   * Handle purchasing Neuros via in-app purchase
   * This function initiates the purchase flow for the consumable IAP
   * Handles errors gracefully and provides clear user feedback
   */
  const handlePurchaseNeuros = async (product) => {
    if (!product) {
      Alert.alert(
        'Product Not Available', 
        'The purchase product is not available at this time. Please check your connection and try again later.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (Platform.OS !== 'ios') {
      Alert.alert('Not Available', 'In-app purchases are currently only available on iOS.');
      return;
    }

    setPurchasingNeuros(true);
    try {
      console.log('Starting Neuros purchase...');
      const result = await purchaseConsumable(product.identifier);
      
      if (!result.success) {
        if (result.error === 'User cancelled the purchase') {
          console.log('Purchase cancelled by user');
          return; // Don't show error for user cancellation - this is normal behavior
        }
        
        // Check for specific error types and provide helpful messages
        const errorMessage = result.error || 'Failed to complete purchase';
        
        if (errorMessage.includes('configuration') || errorMessage.includes('App Store Connect')) {
          Alert.alert(
            'Configuration Error',
            'There\'s an issue with the app store configuration. Please contact support if this continues.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert('Purchase Failed', errorMessage);
        }
        return;
      }

      // Refresh user profile to get updated neuros balance
      // The purchase handler already updated the balance, but we need to refresh the UI
      if (updateProfile) {
        try {
          // Fetch updated profile
          const { data: updatedProfile, error: fetchError } = await supabase
            .from('profiles')
            .select('neuros_balance')
            .eq('id', user.id)
            .single();
          
          if (fetchError) {
            console.warn('Could not fetch updated profile:', fetchError);
            // Still show success - the purchase completed, balance will update on next refresh
          } else if (updatedProfile) {
            updateProfile({ neuros_balance: updatedProfile.neuros_balance });
          }
        } catch (profileError) {
          console.warn('Error refreshing profile after purchase:', profileError);
          // Non-critical - purchase succeeded, balance will update eventually
        }
      }

      // Extract neuros amount from product identifier
      const neurosMap = { 'neuros_1000': 1000, 'neuros_5000': 5000, 'neuros_10000': 10000, 'neuros_30000': 30000, 'neuros_100000': 100000 };
      const neurosAmount = neurosMap[product.identifier] || 10000;
      
      Alert.alert(
        'Purchase Successful!', 
        `${neurosAmount.toLocaleString()} Neuros have been added to your account.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Purchase error:', error);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to complete purchase. Please try again.';
      
      if (error.message) {
        if (error.message.includes('configuration')) {
          errorMessage = 'There\'s an issue with the app store configuration. Please contact support.';
        } else if (error.message.includes('network') || error.message.includes('connection')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Purchase Failed', errorMessage);
    } finally {
      setPurchasingNeuros(false);
    }
  };

  const neurosBalance = userProfile?.neuros_balance || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="chevron-back" size={24} color="#00ffff" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Store</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Neuros Balance Card */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceContent}>
          <Ionicons name="sparkles" size={24} color="#FFD700" />
          <View style={styles.balanceTextContainer}>
            <Text style={styles.balanceLabel}>Your Balance</Text>
            <Text style={styles.balanceAmount}>{neurosBalance} Neuros</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00ffff" />
          <Text style={styles.loadingText}>Loading themes...</Text>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Rotating Themes Section - First Shelf */}
          <View style={styles.shelfContainer}>
            <View style={styles.shelfHeaderSecond}>
              <Text style={styles.shelfTitle}>Weekly Rotating Themes</Text>
              <Text style={styles.shelfSubtitle}>5 new themes every week • Rarities vary per user</Text>
            </View>
            
            {assigningThemes ? (
              <View style={styles.shelfLoadingContainer}>
                <ActivityIndicator size="large" color="#00ffff" />
                <Text style={styles.loadingText}>Assigning your themes...</Text>
              </View>
            ) : rotatingThemes.length > 0 ? (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelfScrollContent}
                style={styles.shelfScrollView}
              >
                {(() => {
                  // Sort by ownership first (unowned first, owned last), then by rarity (mythic first, common last)
                  const rarityOrder = { mythic: 0, legendary: 1, epic: 2, rare: 3, common: 4 };
                  
                  const sortedThemes = [...rotatingThemes]
                    .filter(slot => slot.theme) // Filter out null themes
                    .sort((a, b) => {
                      // First sort by ownership (unowned first, owned last)
                      const isOwnedA = (userProfile?.purchased_themes || []).includes(a.theme?.theme_key);
                      const isOwnedB = (userProfile?.purchased_themes || []).includes(b.theme?.theme_key);
                      
                      if (isOwnedA !== isOwnedB) {
                        return isOwnedA ? 1 : -1; // unowned (-1) comes before owned (1)
                      }
                      
                      // If same ownership status, sort by rarity (mythic first, common last)
                      // Use theme_bank.rarity as source of truth (always up to date), fall back to slot_rarity
                      const rarityA = rarityOrder[(a.theme?.rarity || a.slot_rarity)?.toLowerCase()] ?? 999;
                      const rarityB = rarityOrder[(b.theme?.rarity || b.slot_rarity)?.toLowerCase()] ?? 999;
                      
                      return rarityA - rarityB; // Lower number = rarer (mythic first)
                    });
                  
                  return sortedThemes.map((slot) => {
                    const theme = slot.theme;
                    // Prioritize theme_bank.neuros_cost (per-theme pricing) if set
                    // If NULL, fall back to slot.neuros_cost (rarity-based pricing)
                    // This allows themes to have custom prices that override rarity pricing
                    const themeCost = theme?.neuros_cost !== null && theme?.neuros_cost !== undefined
                      ? theme.neuros_cost  // Use per-theme price from theme_bank
                      : slot.neuros_cost;   // Fall back to rarity-based price from slot
                    const canAfford = neurosBalance >= themeCost;
                    const isOwned = (userProfile?.purchased_themes || []).includes(theme.theme_key);
                    // Use theme_bank.rarity as source of truth (always up to date), fall back to slot_rarity for display
                    const displayRarity = theme?.rarity || slot.slot_rarity || 'common';
                    const rarityColor = getRarityColor(displayRarity);
                  
                  return (
                    <TouchableOpacity
                      key={slot.id}
                      style={[
                        styles.classicThemeCard,
                        !canAfford && !isOwned && styles.themeCardLocked,
                        isOwned && styles.themeCardOwned,
                      ]}
                      onPress={() => handlePurchaseRotatingTheme(slot)}
                      disabled={purchasing}
                    >
                      {/* Theme Preview - matches classic theme structure */}
                      <View style={[
                        styles.classicThemePreview,
                        theme.image_url 
                          ? {} 
                          : { backgroundColor: theme.background_color || '#000' }
                      ]}>
                        {theme.image_url ? (
                          <Image
                            source={{ uri: normalizeImageUrl(theme.image_url) }}
                            style={styles.classicThemePreviewImage}
                            resizeMode="cover"
                          />
                        ) : null}
                        {/* Gradient overlay for image themes */}
                        {theme.image_url && (
                          <View style={styles.classicThemePreviewOverlay} />
                        )}
                      </View>
                      
                      <View style={styles.classicThemeCardContent}>
                        <View style={styles.classicThemeHeader}>
                          <Text style={styles.classicThemeName} numberOfLines={1}>
                            {theme.name}
                          </Text>
                          {/* Rarity Badge */}
                          <View style={[styles.rarityBadgeSmall, { backgroundColor: rarityColor + '40', borderColor: rarityColor }]}>
                            <Text style={[styles.rarityTextSmall, { color: rarityColor }]}>
                              {displayRarity.charAt(0).toUpperCase() + displayRarity.slice(1)}
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.classicThemeFooter}>
                          {isOwned ? (
                            <View style={styles.ownedBadgeSmall}>
                              <Ionicons name="checkmark-circle" size={14} color="#00ff00" />
                              <Text style={styles.ownedTextSmall}>Owned</Text>
                            </View>
                          ) : (
                            <View style={styles.costBadgeSmall}>
                              <Ionicons name="sparkles" size={12} color="#FFD700" />
                              <Text style={styles.costTextSmall}>{themeCost}</Text>
                            </View>
                          )}
                        </View>
                        
                        {!canAfford && !isOwned && (
                          <View style={styles.lockOverlay}>
                            <Ionicons name="lock-closed" size={20} color="#fff" />
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                });
                })()}
              </ScrollView>
            ) : (
              <View style={styles.shelfEmptyState}>
                <Ionicons name="refresh-outline" size={48} color="#666" />
                <Text style={styles.emptyStateText}>No themes available</Text>
              </View>
            )}
          </View>

          {/* Classic Themes Section - Bottom Shelf */}
          <View style={styles.shelfContainer}>
            <View style={styles.shelfHeader}>
              <Text style={styles.shelfTitle}>Classic Themes</Text>
              <Text style={styles.shelfSubtitle}>Solid color themes • Always available</Text>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfScrollContent}
              style={styles.shelfScrollView}
            >
              {(() => {
                // Sort classic themes by ownership (unowned first, owned last)
                const sortedClassicThemes = Object.entries(PROFILE_THEMES)
                  .sort(([keyA], [keyB]) => {
                    const isUnlockedA = isThemeUnlocked(keyA);
                    const isUnlockedB = isThemeUnlocked(keyB);
                    
                    if (isUnlockedA === isUnlockedB) return 0;
                    return isUnlockedA ? 1 : -1; // unowned (-1) comes before owned (1)
                  });
                
                return sortedClassicThemes.map(([key, theme]) => {
                  const isUnlocked = isThemeUnlocked(key);
                  const themeCost = getThemeCost(key);
                
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.classicThemeCard,
                      !isUnlocked && styles.themeCardLocked,
                      isUnlocked && styles.themeCardOwned,
                    ]}
                    onPress={() => handlePurchase(key)}
                    disabled={purchasing}
                  >
                    {/* Theme Preview - solid color */}
                    <View style={[
                      styles.classicThemePreview,
                      { backgroundColor: theme.backgroundColor }
                    ]} />
                    
                    <View style={styles.classicThemeCardContent}>
                      <View style={styles.classicThemeHeader}>
                        <Text style={styles.classicThemeName} numberOfLines={1}>
                          {theme.name}
                        </Text>
                      </View>
                      
                      <View style={styles.classicThemeFooter}>
                        {isUnlocked ? (
                          <View style={styles.ownedBadgeSmall}>
                            <Ionicons name="checkmark-circle" size={14} color="#00ff00" />
                            <Text style={styles.ownedTextSmall}>Owned</Text>
                          </View>
                        ) : (
                          <View style={styles.costBadgeSmall}>
                            <Ionicons name="sparkles" size={12} color="#FFD700" />
                            <Text style={styles.costTextSmall}>{themeCost}</Text>
                          </View>
                        )}
                      </View>
                      
                      {!isUnlocked && neurosBalance < themeCost && (
                        <View style={styles.lockOverlay}>
                          <Ionicons name="lock-closed" size={20} color="#fff" />
                        </View>
                      )}
                    </View>
                    </TouchableOpacity>
                  );
                });
              })()}
            </ScrollView>
          </View>

          {/* Bond Market Section */}
          <View style={styles.shelfContainer}>
            <View style={styles.shelfHeaderSecond}>
              <Text style={styles.shelfTitle}>Bond Market</Text>
              <Text style={styles.shelfSubtitle}>Invest Neuros • Earn weekly returns • Maintain your streak</Text>
            </View>
            
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfScrollContent}
              style={styles.shelfScrollView}
            >
              {[
                { tier: 'tier_500', amount: 500 },
                { tier: 'tier_1000', amount: 1000 },
                { tier: 'tier_5000', amount: 5000 }
              ].map(({ tier, amount }) => {
                const canAfford = neurosBalance >= amount;
                const isPremium = userProfile?.is_premium || false;
                const config = bondConfig?.[tier];
                
                // Get rates (premium or standard)
                const week1Rate = isPremium 
                  ? (config?.premium_week_1_rate || 0.07)
                  : (config?.week_1_rate || 0.05);
                const week4Rate = isPremium
                  ? (config?.premium_week_4_rate || 0.32)
                  : (config?.week_4_rate || 0.30);
                
                const week1Payout = Math.round(amount * (1 + week1Rate));
                const week4Payout = Math.round(amount * (1 + week4Rate));
                
                // Calculate all week rates for display
                const week2Rate = isPremium
                  ? (config?.premium_week_2_rate || 0.14)
                  : (config?.week_2_rate || 0.12);
                const week3Rate = isPremium
                  ? (config?.premium_week_3_rate || 0.22)
                  : (config?.week_3_rate || 0.20);
                const week2Payout = Math.round(amount * (1 + week2Rate));
                const week3Payout = Math.round(amount * (1 + week3Rate));
                const maxEarnings = week4Payout - amount;

                return (
                  <TouchableOpacity
                    key={tier}
                    style={[
                      styles.bondCard,
                      !canAfford && styles.bondCardLocked
                    ]}
                    onPress={() => handlePurchaseBond(tier)}
                    disabled={purchasingBond || !canAfford}
                    activeOpacity={0.7}
                  >
                    {/* Compact Header - Purchase Focused */}
                    <View style={styles.bondCardHeader}>
                      <View style={styles.bondHeaderLeft}>
                        <View style={styles.bondIconContainer}>
                          <Ionicons name="trending-up" size={18} color="#00ffff" />
                        </View>
                        <View style={styles.bondHeaderInfo}>
                          <View style={styles.bondAmountRow}>
                            <Text style={styles.bondCardAmount}>{amount.toLocaleString()}</Text>
                            <Text style={styles.bondCardAmountLabel}>Neuros</Text>
                            {isPremium && (
                              <View style={styles.premiumBadge}>
                                <Ionicons name="star" size={8} color="#FFD700" />
                                <Text style={styles.premiumBadgeText}>Premium</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.bondCardContent}>
                      {/* Main Value Display - Compact */}
                      <View style={styles.mainValueSection}>
                        <View style={styles.currentValueCard}>
                          <Text style={styles.currentValueLabel}>Invest</Text>
                          <Text style={styles.currentValueAmount}>
                            {amount.toLocaleString()}
                          </Text>
                        </View>
                        <View style={styles.maxValueCard}>
                          <Text style={styles.maxValueLabel}>Max Return</Text>
                          <Text style={styles.maxValueAmount}>
                            {week4Payout.toLocaleString()}
                          </Text>
                          <Text style={styles.maxValueGain}>
                            +{((maxEarnings / amount) * 100).toFixed(0)}%
                          </Text>
                        </View>
                      </View>

                      {/* Interest Rates - Compact Inline */}
                      <View style={styles.ratesSectionCompact}>
                        <View style={styles.ratesGridCompact}>
                          {[1, 2, 3, 4].map((week) => {
                            const weekRate = week === 1 ? week1Rate : week === 2 ? week2Rate : week === 3 ? week3Rate : week4Rate;
                            
                            return (
                              <View key={week} style={styles.rateItemCompact}>
                                <Text style={styles.rateWeekLabelCompact}>W{week}</Text>
                                <Text style={styles.ratePercentageCompact}>{(weekRate * 100).toFixed(0)}%</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                    
                    {!canAfford && (
                      <View style={styles.bondLockOverlay}>
                        <Ionicons name="lock-closed" size={20} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Custom Background Section - Only visible to admins */}
          {userProfile?.is_admin && (
            <View style={styles.shelfContainerNoMargin}>
              <View style={styles.shelfHeader}>
                <Text style={styles.shelfTitle}>Custom Backgrounds</Text>
              </View>
              <View style={styles.shelfContent}>
                <TouchableOpacity
                  style={styles.customBackgroundCard}
                  onPress={() => setShowBackgroundModal(true)}
                >
                  <View style={styles.customBackgroundCardContent}>
                    <Ionicons name="image-outline" size={32} color="#00ffff" />
                    <View style={styles.customBackgroundTextContainer}>
                      <Text style={styles.customBackgroundTitle}>Upload Custom Background</Text>
                      <Text style={styles.customBackgroundSubtitle}>
                        {backgroundUploadCost.toLocaleString()} Neuros • {customBackgrounds.length} uploaded
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#666" />
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Neuros Shop */}
          {Platform.OS === 'ios' && (
            <View style={styles.neurosShopSection}>
              <View style={styles.neurosShopHeader}>
                <View style={styles.neurosShopHeaderTop}>
                  <Text style={styles.neurosShopTitle}>Neuros Shop</Text>
                  <View style={styles.neurosShopBalanceChip}>
                    <Text style={styles.neurosShopBalanceAmount}>{neurosBalance.toLocaleString()}</Text>
                    <Text style={styles.neurosShopBalanceUnit}>⭐</Text>
                  </View>
                </View>
                <Text style={styles.neurosShopSubtitle}>Themes, backgrounds & bonds</Text>
              </View>

              {loadingNeurosProducts ? (
                <View style={styles.neurosShopLoading}>
                  <ActivityIndicator size="large" color="#00ffff" />
                  <Text style={styles.loadingText}>Loading...</Text>
                </View>
              ) : neurosProducts.length > 0 ? (
                <View style={styles.neurosShopList}>
                  {neurosProducts.map((product, index) => {
                    const neurosMap = { 'neuros_1000': 1000, 'neuros_5000': 5000, 'neuros_10000': 10000, 'neuros_30000': 30000, 'neuros_100000': 100000 };
                    const neurosAmount = neurosMap[product.identifier] || 0;
                    const neurosFormatted = neurosAmount.toLocaleString();
                    const isRecommended = neurosAmount === 10000;
                    const isLast = index === neurosProducts.length - 1;
                    return (
                      <TouchableOpacity
                        key={product.identifier}
                        onPress={() => handlePurchaseNeuros(product)}
                        disabled={purchasingNeuros}
                        activeOpacity={0.75}
                        style={[
                          styles.neurosShopRow,
                          isRecommended && styles.neurosShopRowRecommended,
                          isLast && styles.neurosShopRowLast,
                          purchasingNeuros && styles.neurosProductCardDisabled,
                        ]}
                      >
                        <View style={styles.neurosShopRowIcon}>
                          <Ionicons name="diamond" size={22} color="#00ffff" />
                        </View>
                        <View style={styles.neurosShopRowCenter}>
                          <Text style={styles.neurosShopRowAmount}>{neurosFormatted} Neuros</Text>
                          {isRecommended && (
                            <Text style={styles.neurosShopRowBadge}>Best value</Text>
                          )}
                        </View>
                        <View style={styles.neurosShopRowRight}>
                          <Text style={styles.neurosShopRowPrice}>{product.priceString}</Text>
                          <View style={styles.neurosShopGetBtn}>
                            <Text style={styles.neurosShopGetBtnText}>Get</Text>
                            <Ionicons name="arrow-forward" size={14} color="#000" />
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.shelfEmptyState}>
                  <Ionicons name="warning-outline" size={48} color="#ff9800" />
                  <Text style={styles.emptyStateText}>
                    {productLoadError || 'Products not available'}
                  </Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={loadNeurosProducts}
                    disabled={loadingNeurosProducts}
                  >
                    <Ionicons name="refresh" size={16} color="#00ffff" />
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}

      {purchasing && (
        <Modal transparent visible={purchasing} animationType="fade">
          <View style={styles.purchasingOverlay}>
            <View style={styles.purchasingCard}>
              <ActivityIndicator size="large" color="#00ffff" />
              <Text style={styles.purchasingText}>Processing purchase...</Text>
            </View>
          </View>
        </Modal>
      )}

      {/* Bond Purchase Confirmation Modal */}
      <Modal
        visible={showBondModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          if (!purchasingBond) {
            setShowBondModal(false);
            setSelectedBondTier(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Purchase Bond</Text>
              <TouchableOpacity 
                style={styles.modalClose}
                onPress={() => {
                  if (!purchasingBond) {
                    setShowBondModal(false);
                    setSelectedBondTier(null);
                  }
                }}
                disabled={purchasingBond}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedBondTier && (() => {
              const amount = selectedBondTier === 'tier_500' ? 500 : selectedBondTier === 'tier_1000' ? 1000 : 5000;
              const isPremium = userProfile?.is_premium || false;
              const config = bondConfig?.[selectedBondTier];
              
              const week1Rate = isPremium 
                ? (config?.premium_week_1_rate || 0.07)
                : (config?.week_1_rate || 0.05);
              const week2Rate = isPremium
                ? (config?.premium_week_2_rate || 0.14)
                : (config?.week_2_rate || 0.12);
              const week3Rate = isPremium
                ? (config?.premium_week_3_rate || 0.22)
                : (config?.week_3_rate || 0.20);
              const week4Rate = isPremium
                ? (config?.premium_week_4_rate || 0.32)
                : (config?.week_4_rate || 0.30);
              
              const week1Payout = Math.round(amount * (1 + week1Rate));
              const week2Payout = Math.round(amount * (1 + week2Rate));
              const week3Payout = Math.round(amount * (1 + week3Rate));
              const week4Payout = Math.round(amount * (1 + week4Rate));
              
              const maxEarnings = week4Payout - amount;
              
              return (
                <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalScrollContent}>
                  <View style={styles.bondModalContent}>
                    {/* Compact Header - Matching My Bonds Style */}
                    <View style={styles.bondCardHeader}>
                      <View style={styles.bondHeaderLeft}>
                        <View style={styles.bondIconContainer}>
                          <Ionicons name="trending-up" size={24} color="#00ffff" />
                        </View>
                        <View style={styles.bondHeaderInfo}>
                          <View style={styles.bondAmountRow}>
                            <Text style={styles.bondCardAmount}>{amount.toLocaleString()}</Text>
                            <Text style={styles.bondCardAmountLabel}>Neuros</Text>
                            {isPremium && (
                              <View style={styles.premiumBadge}>
                                <Ionicons name="star" size={10} color="#FFD700" />
                                <Text style={styles.premiumBadgeText}>Premium</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.bondCardContent}>
                      {/* Main Value Display - Compact */}
                      <View style={styles.mainValueSection}>
                        <View style={styles.currentValueCard}>
                          <Text style={styles.currentValueLabel}>Investment</Text>
                          <Text style={styles.currentValueAmount}>
                            {amount.toLocaleString()} <Text style={styles.currentValueUnit}>Neuros</Text>
                          </Text>
                        </View>
                        <View style={styles.maxValueCard}>
                          <Text style={styles.maxValueLabel}>Max Return</Text>
                          <Text style={styles.maxValueAmount}>
                            {week4Payout.toLocaleString()} <Text style={styles.maxValueUnit}>Neuros</Text>
                          </Text>
                          <Text style={styles.maxValueGain}>
                            +{maxEarnings.toLocaleString()} ({((maxEarnings / amount) * 100).toFixed(0)}%)
                          </Text>
                        </View>
                      </View>

                      {/* Interest Rates - Compact Inline */}
                      <View style={styles.ratesSectionCompact}>
                        <Text style={styles.ratesTitleCompact}>Weekly Returns</Text>
                        <View style={styles.ratesGridCompact}>
                          {[1, 2, 3, 4].map((week) => {
                            const weekRate = week === 1 ? week1Rate : week === 2 ? week2Rate : week === 3 ? week3Rate : week4Rate;
                            
                            return (
                              <View key={week} style={styles.rateItemCompact}>
                                <Text style={styles.rateWeekLabelCompact}>Week {week}</Text>
                                <Text style={styles.ratePercentageCompact}>{(weekRate * 100).toFixed(0)}%</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {/* Terms - Simple */}
                      <View style={styles.bondTermsSection}>
                        <View style={styles.bondTermItem}>
                          <Ionicons name="time-outline" size={14} color="#00ffff" />
                          <Text style={styles.bondTermText}>Withdraw at 7, 14, 21, or 28 days</Text>
                        </View>
                        <View style={styles.bondTermItem}>
                          <Ionicons name="flame-outline" size={14} color="#ff9800" />
                          <Text style={styles.bondTermText}>Maintain daily streak to earn</Text>
                        </View>
                      </View>

                      {/* Purchase Button - Enhanced */}
                      <TouchableOpacity
                        style={[styles.bondPurchaseButton, purchasingBond && styles.bondPurchaseButtonDisabled]}
                        onPress={confirmBondPurchase}
                        disabled={purchasingBond}
                      >
                        {purchasingBond ? (
                          <ActivityIndicator size="small" color="#000" />
                        ) : (
                          <>
                            <Text style={styles.bondPurchaseButtonText}>
                              Purchase {amount.toLocaleString()} Neuros Bond
                            </Text>
                            <Ionicons name="arrow-forward" size={16} color="#000" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Custom Background Modal - Only accessible to admins */}
      <Modal
        visible={showBackgroundModal && userProfile?.is_admin}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBackgroundModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Custom Backgrounds</Text>
              <TouchableOpacity 
                style={styles.modalClose}
                onPress={() => setShowBackgroundModal(false)}
              >
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {/* Scrollable Content */}
            <ScrollView 
              style={styles.modalScrollView}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <Text style={styles.modalSubtitle}>
                Upload custom background images. The background stays stationary while your content scrolls on top.
              </Text>

              {/* Upload Button */}
              <TouchableOpacity 
                style={[styles.uploadBackgroundButton, uploadingBackground && styles.uploadBackgroundButtonDisabled]}
                onPress={handleBackgroundUpload}
                disabled={uploadingBackground}
              >
                {uploadingBackground ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={22} color="#000" />
                    <Text style={styles.uploadBackgroundButtonText}>
                      Upload Background ({backgroundUploadCost.toLocaleString()} Neuros)
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Current Backgrounds List */}
              {customBackgrounds.length > 0 && (
                <View style={styles.backgroundsList}>
                  <Text style={styles.backgroundsListTitle}>Your Backgrounds</Text>
                  {customBackgrounds.map((background) => (
                    <View key={background.id} style={styles.backgroundItem}>
                      <Image
                        source={{ uri: background.image_url }}
                        style={styles.backgroundItemImage}
                        resizeMode="cover"
                      />
                      <View style={styles.backgroundItemContent}>
                        <View style={styles.backgroundItemInfo}>
                          {background.is_active && (
                            <View style={styles.activeBadge}>
                              <Ionicons name="checkmark-circle" size={16} color="#00ff00" />
                              <Text style={styles.activeBadgeText}>Active</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.backgroundItemActions}>
                          {!background.is_active && (
                            <TouchableOpacity
                              style={styles.backgroundActionButton}
                              onPress={() => handleSetActiveBackground(background.id)}
                            >
                              <Ionicons name="checkmark" size={18} color="#00ffff" />
                              <Text style={styles.backgroundActionButtonText}>Set Active</Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.backgroundActionButton, styles.backgroundActionButtonDanger]}
                            onPress={() => handleDeleteBackground(background.id)}
                          >
                            <Ionicons name="trash-outline" size={18} color="#ff4444" />
                            <Text style={[styles.backgroundActionButtonText, styles.backgroundActionButtonTextDanger]}>
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Empty State */}
              {customBackgrounds.length === 0 && (
                <View style={styles.emptyBackgroundsContainer}>
                  <Ionicons name="image-outline" size={48} color="#666" />
                  <Text style={styles.emptyBackgroundsText}>No custom backgrounds yet</Text>
                  <Text style={styles.emptyBackgroundsSubtext}>
                    Upload your first background for {backgroundUploadCost.toLocaleString()} Neuros!
                  </Text>
                </View>
              )}
            </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  placeholder: {
    width: 80, // Balance the back button width
  },
  balanceCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  purchaseNeurosCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)', // Solid background for shadow calculation
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    // Removed shadow properties to avoid warnings - using border for visual depth instead
    elevation: 0, // Disable elevation to avoid shadow warnings
  },
  purchaseNeurosHeaderGradient: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 215, 0, 0.2)',
  },
  purchaseNeurosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingBottom: 12,
    gap: 10,
  },
  purchaseNeurosIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  purchaseNeurosHeaderText: {
    flex: 1,
  },
  purchaseNeurosTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  purchaseNeurosSubtitle: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '500',
  },
  purchaseNeurosContent: {
    padding: 14,
    paddingTop: 12,
  },
  purchaseNeurosBenefits: {
    marginBottom: 14,
    gap: 8,
  },
  purchaseNeurosBenefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  purchaseNeurosBenefitText: {
    color: '#ddd',
    fontSize: 13,
    fontWeight: '500',
  },
  purchaseNeurosButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)', // Solid background for shadow calculation
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    // Removed shadow properties that cause warnings - using border and background only
    elevation: 0, // Disable elevation to avoid shadow warnings
  },
  purchaseNeurosButtonDisabled: {
    opacity: 0.5,
  },
  purchaseNeurosButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  purchaseNeurosButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  purchaseNeurosButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchaseNeurosButtonTextContainer: {
    flex: 1,
  },
  purchaseNeurosButtonAmount: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 3,
  },
  purchaseNeurosButtonPriceLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 13,
    fontWeight: '400',
  },
  purchaseNeurosButtonRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 12,
  },
  purchaseNeurosButtonPrice: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  purchaseNeurosButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  purchaseNeurosButtonLoadingText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '500',
  },
  purchaseNeurosLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  purchaseNeurosLoadingText: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '500',
  },
  purchaseNeurosUnavailable: {
    paddingVertical: 14,
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  purchaseNeurosUnavailableText: {
    color: '#ff9800',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  retryButtonText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '600',
  },
  balanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  balanceTextContainer: {
    flex: 1,
  },
  balanceLabel: {
    color: '#999',
    fontSize: 14,
    marginBottom: 4,
  },
  balanceAmount: {
    color: '#FFD700',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  subtitleContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  // Shelf Layout Styles
  shelfContainer: {
    marginBottom: 32,
  },
  // Reduced spacing for custom background section (first shelf)
  shelfContainerFirst: {
    marginBottom: 16, // Reduced from default 32
  },
  // No bottom margin for sections that need to be closer together
  shelfContainerNoMargin: {
    marginBottom: 0,
  },
  shelfHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  // Reduced top padding for rotating themes header (second shelf)
  shelfHeaderSecond: {
    paddingHorizontal: 20,
    paddingTop: 12, // Reduced from 20
    paddingBottom: 12,
  },
  shelfTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  shelfSubtitle: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  shelfContent: {
    paddingHorizontal: 20,
  },
  shelfScrollView: {
    marginHorizontal: 20,
  },
  shelfScrollContent: {
    paddingRight: 20,
    gap: 12,
  },
  shelfLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shelfEmptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Classic Theme Card (matches profile theme structure)
  classicThemeCard: {
    width: 140,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 12,
    position: 'relative',
  },
  classicThemePreview: {
    width: '100%',
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  classicThemePreviewImage: {
    width: '100%',
    height: '100%',
  },
  classicThemePreviewOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  classicThemeCardContent: {
    padding: 10,
    paddingTop: 4,
  },
  classicThemeHeader: {
    marginBottom: 8,
    minHeight: 36,
  },
  classicThemeName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  classicThemeFooter: {
    marginTop: 'auto',
  },
  // Rarity Badge (smaller for classic cards)
  rarityBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  rarityTextSmall: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  // Badge styles (smaller for classic cards)
  ownedBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  ownedTextSmall: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: '600',
  },
  costBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
    gap: 4,
  },
  costTextSmall: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // Legacy styles (kept for compatibility)
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  themeCard: {
    width: '47%',
    aspectRatio: 1.2,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  themeImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  themeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  themeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  themeFooter: {
    marginTop: 'auto',
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  themeCardOwned: {
    borderColor: '#00ff00',
    borderWidth: 2,
  },
  subtitleNote: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  themeCardActive: {
    borderColor: '#00ffff',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  themeCardLocked: {
    opacity: 0.6,
  },
  themeCardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  themeName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  activeText: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: '600',
  },
  ownedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  ownedText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  costBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  costText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchasingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  purchasingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  purchasingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 12,
  },
  emptyStateText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  // Custom Background Styles
  customBackgroundCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    marginBottom: 20,
  },
  customBackgroundCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  customBackgroundTextContainer: {
    flex: 1,
  },
  customBackgroundTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  customBackgroundSubtitle: {
    color: '#999',
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 28,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 500,
    minHeight: 550,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 26,
    paddingBottom: 22,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(0, 255, 255, 0.2)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  modalClose: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    padding: 26,
    paddingBottom: 40,
  },
  modalSubtitle: {
    color: '#bbb',
    fontSize: 15,
    marginBottom: 28,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  uploadBackgroundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 32,
    marginBottom: 32,
    gap: 12,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  uploadBackgroundButtonDisabled: {
    opacity: 0.6,
  },
  uploadBackgroundButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backgroundsList: {
    marginTop: 8,
  },
  backgroundsListTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  backgroundItem: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  backgroundItemImage: {
    width: 140,
    height: 140,
    backgroundColor: '#2a2a2a',
  },
  backgroundItemContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  backgroundItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 255, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 0, 0.4)',
    shadowColor: '#00ff00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  activeBadgeText: {
    color: '#00ff00',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backgroundItemActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  backgroundActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#00ffff',
    flexShrink: 1,
    flexGrow: 1,
    flexBasis: '45%',
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  backgroundActionButtonDanger: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderColor: '#ff4444',
    shadowColor: '#ff4444',
  },
  backgroundActionButtonText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  backgroundActionButtonTextDanger: {
    color: '#ff4444',
  },
  emptyBackgroundsContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyBackgroundsText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  emptyBackgroundsSubtext: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  // Neuros Shop
  neurosShopSection: {
    marginTop: 24,
    marginBottom: 40,
    marginHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  neurosShopHeader: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  neurosShopHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  neurosShopTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  neurosShopBalanceChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: 'rgba(0,255,255,0.12)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.25)',
  },
  neurosShopBalanceAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#00ffff',
    fontVariant: ['tabular-nums'],
  },
  neurosShopBalanceUnit: {
    fontSize: 14,
    color: 'rgba(0,255,255,0.9)',
    fontWeight: '700',
  },
  neurosShopSubtitle: {
    fontSize: 15,
    color: '#999',
    lineHeight: 22,
  },
  neurosShopLoading: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
  },
  neurosShopList: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  neurosShopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  neurosShopRowRecommended: {
    backgroundColor: 'rgba(0,255,255,0.07)',
    borderColor: 'rgba(0,255,255,0.22)',
  },
  neurosShopRowLast: {
    marginBottom: 0,
  },
  neurosProductCardDisabled: {
    opacity: 0.5,
  },
  neurosShopRowIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  neurosShopRowCenter: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  neurosShopRowAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  neurosShopRowBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ffff',
    marginTop: 4,
    letterSpacing: 0.3,
  },
  neurosShopRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginLeft: 12,
  },
  neurosShopRowPrice: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  neurosShopGetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00ffff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  neurosShopGetBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  // Bond Market Styles - Purchase focused, compact
  bondCard: {
    width: 240,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
    overflow: 'hidden',
    position: 'relative',
  },
  bondCardLocked: {
    opacity: 0.5,
  },
  bondCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  bondCardAmountLabel: {
    color: '#888',
    fontSize: 13,
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: 'bold',
  },
  weekBadgeSubtext: {
    color: '#00ffff',
    fontSize: 9,
    opacity: 0.8,
    marginTop: 1,
  },
  bondCardContent: {
    padding: 12,
    gap: 10,
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
    borderRadius: 10,
    padding: 10,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  currentValueUnit: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500',
  },
  currentValueGain: {
    color: '#00ff00',
    fontSize: 10,
    fontWeight: '600',
  },
  maxValueCard: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    borderRadius: 10,
    padding: 10,
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
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  maxValueUnit: {
    fontSize: 11,
    color: '#aaa',
    fontWeight: '500',
  },
  maxValueGain: {
    color: '#00ffff',
    fontSize: 10,
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
  rateWeekLabel: {
    color: '#888',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
  },
  ratePercentage: {
    color: '#00ff00',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  ratePayout: {
    color: '#aaa',
    fontSize: 9,
  },
  // Compact rates for purchase cards
  ratesSectionCompact: {
    marginBottom: 8,
  },
  ratesTitleCompact: {
    color: '#aaa',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratesGridCompact: {
    flexDirection: 'row',
    gap: 6,
  },
  rateItemCompact: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  rateWeekLabelCompact: {
    color: '#888',
    fontSize: 8,
    fontWeight: '600',
    marginBottom: 3,
  },
  ratePercentageCompact: {
    color: '#00ff00',
    fontSize: 11,
    fontWeight: 'bold',
  },
  // Bond Terms Section
  bondTermsSection: {
    gap: 8,
    marginBottom: 12,
  },
  bondTermItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  bondTermText: {
    color: '#aaa',
    fontSize: 11,
    flex: 1,
  },
  // Modern Purchase Button - Clean & Minimal
  bondPurchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 6,
    marginTop: 8,
  },
  bondPurchaseButtonDisabled: {
    opacity: 0.4,
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
  },
  bondPurchaseButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.1,
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
  bondCostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginTop: 4,
    alignSelf: 'center',
  },
  bondCostText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  // Withdraw/Purchase Button (reused for purchase)
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
  bondLockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Bond Modal Styles - Using same structure as My Bonds cards
  bondModalContent: {
    // No padding - bondCardContent handles it
  },
  bondModalIconContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bondModalAmount: {
    color: '#00ffff',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  bondModalPremiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
    marginBottom: 24,
    gap: 8,
  },
  bondModalPremiumText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '700',
  },
  bondModalPayoutSchedule: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  bondModalScheduleTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  bondModalScheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bondModalScheduleWeek: {
    color: '#bbb',
    fontSize: 15,
    fontWeight: '500',
  },
  bondModalSchedulePayout: {
    color: '#00ff00',
    fontSize: 15,
    fontWeight: '700',
  },
  bondModalWarning: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.3)',
  },
  bondModalWarningText: {
    flex: 1,
    color: '#ff9800',
    fontSize: 13,
    lineHeight: 18,
  },
  bondModalInfo: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  bondModalInfoText: {
    color: '#00ffff',
    fontSize: 13,
    lineHeight: 20,
  },
  bondModalPurchaseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
    shadowColor: '#00ffff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  bondModalPurchaseButtonDisabled: {
    opacity: 0.6,
  },
  bondModalPurchaseButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

