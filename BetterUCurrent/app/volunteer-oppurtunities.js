import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
  Switch,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import AddEventModal from './(modals)/AddEventModal';

const STORAGE_MAX_MILES = '@betteru/volunteer_max_miles';
const STORAGE_TAGS = '@betteru/volunteer_tags';
const STORAGE_INCLUDE_REMOTE = '@betteru/volunteer_include_remote';
const GOOGLE_PLACES_BASE_URL = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const GOOGLE_NEXT_PAGE_TOKEN_DELAY_MS = 2200;

/** Match AddEventModal date field (MM/DD/YYYY). */
function formatDateForEventForm(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${y}`;
}

/** Match AddEventModal time field (HH:MM 24h). */
function formatTimeForEventForm(d) {
  const h = d.getHours();
  const min = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Convert volunteer list row → AddEventModal initialValues shape. */
function volunteerToEventInitialValues(opp) {
  const now = new Date();
  const lines = [];
  if (opp.organization) lines.push(`Organization: ${opp.organization}`);
  if (opp.description) lines.push(String(opp.description));
  if (opp.applyUrl) lines.push(`Sign up / details: ${opp.applyUrl}`);
  return {
    title: String(opp.title || 'Volunteer opportunity').trim().slice(0, 200),
    description: lines.join('\n\n'),
    date: formatDateForEventForm(now),
    time: formatTimeForEventForm(now),
    location: String(opp.locationLabel || '').trim(),
  };
}

/** Convert degrees → radians (Math.sin/cos need radians, not degrees). */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Great-circle distance in miles (Earth radius 3959 mi). */
function calculateDistanceMiles(from, to) {
  const R = 3959;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Rank/filter opportunities by interest tags + distance (miles).
 * Remote roles skip the distance check when includeRemote is true.
 */
function findVolunteerOpportunities(opportunities, prefs) {
  const {
    userLocation = null,
    preferredTags = [],
    maxDistanceMiles = 30,
    includeRemote = true,
  } = prefs;

  const normalizedTags = preferredTags
    .map((t) => String(t).toLowerCase().trim())
    .filter(Boolean);
  const filterByTags = normalizedTags.length > 0;

  const scored = opportunities
    .map((opp) => {
      const oppTags = (opp.tags || []).map((t) => String(t).toLowerCase().trim());
      const tagMatches = normalizedTags.filter((t) => oppTags.includes(t)).length;
      if (filterByTags && tagMatches === 0) return null;

      if (opp.isRemote) {
        if (!includeRemote) return null;
        return {
          ...opp,
          distanceMiles: null,
          tagMatches,
          score: tagMatches * 25 + 8,
        };
      }

      const hasCoords =
        typeof opp.latitude === 'number' &&
        typeof opp.longitude === 'number' &&
        !Number.isNaN(opp.latitude) &&
        !Number.isNaN(opp.longitude);

      if (!hasCoords) {
        return {
          ...opp,
          distanceMiles: null,
          tagMatches,
          score: tagMatches * 18,
        };
      }

      if (!userLocation) {
        return {
          ...opp,
          distanceMiles: null,
          tagMatches,
          score: tagMatches * 20,
          needsLocationForDistance: true,
        };
      }

      const distanceMiles = calculateDistanceMiles(
        { latitude: userLocation.latitude, longitude: userLocation.longitude },
        { latitude: opp.latitude, longitude: opp.longitude }
      );

      if (distanceMiles > maxDistanceMiles) return null;

      return {
        ...opp,
        distanceMiles,
        tagMatches,
        score: tagMatches * 25 + Math.max(0, maxDistanceMiles - distanceMiles),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  return scored.map(({ score, needsLocationForDistance, ...row }) => ({
    ...row,
    ...(needsLocationForDistance ? { needsLocationForDistance: true } : {}),
  }));
}

function getGoogleMapsApiKey() {
  // Expo only inlines EXPO_PUBLIC_* into JS at bundle time; GOOGLE_MAPS_API_KEY alone is often undefined here.
  // app.config.js also copies the key into extra.googleMapsApiKey at build — read that as fallback.
  const raw =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_MAPS_API_KEY ||
    Constants?.expoConfig?.extra?.googleMapsApiKey ||
    Constants?.expoConfig?.ios?.config?.googleMapsApiKey ||
    '';
  return typeof raw === 'string' ? raw.trim() : '';
}

function inferTagsFromGoogleTypes(types = []) {
  const typeSet = new Set(types);
  const tags = [];
  if (typeSet.has('school') || typeSet.has('library') || typeSet.has('university')) tags.push('education');
  if (typeSet.has('hospital') || typeSet.has('health')) tags.push('health');
  if (typeSet.has('park') || typeSet.has('campground')) tags.push('environment');
  if (typeSet.has('church') || typeSet.has('community_center')) tags.push('community');
  if (typeSet.has('food_bank') || typeSet.has('meal_delivery')) tags.push('food');
  return tags.length ? tags : ['community'];
}

function buildGoogleKeywordFromTags(selectedTags = []) {
  const map = {
    animals: 'animal shelter rescue volunteer',
    environment: 'environment conservation cleanup volunteer',
    youth: 'youth mentoring volunteer',
    seniors: 'senior support volunteer',
    food: 'food bank pantry volunteer',
    health: 'health hospital clinic volunteer',
    education: 'education tutoring literacy volunteer',
    community: 'community service nonprofit volunteer',
    sports: 'sports volunteer',
    art: 'art volunteer',
  };

  const normalized = selectedTags
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean);
  if (!normalized.length) return 'volunteer nonprofit community service';
  return normalized.map((tag) => map[tag] || `${tag} volunteer`).join(' ');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One Google Nearby Search request. Omit `type` — food banks & warehouses often fail `point_of_interest` filtering. */
async function executeGoogleNearbySearch(apiKey, { pageToken, latitude, longitude, radiusMeters, keyword }) {
  const params = new URLSearchParams({ key: apiKey });
  if (pageToken) {
    await wait(GOOGLE_NEXT_PAGE_TOKEN_DELAY_MS);
    params.set('pagetoken', pageToken);
  } else {
    params.set('location', `${latitude},${longitude}`);
    params.set('radius', String(radiusMeters));
    if (keyword) params.set('keyword', keyword);
  }

  const url = `${GOOGLE_PLACES_BASE_URL}?${params.toString()}`;
  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error_message || 'Google Places request failed.');
  }

  if (payload.status === 'INVALID_REQUEST' && pageToken) {
    throw new Error('Google next page token is not ready yet. Please try again.');
  }

  if (payload.status && payload.status !== 'OK' && payload.status !== 'ZERO_RESULTS') {
    throw new Error(payload.error_message || payload.status || 'Google Places request failed.');
  }

  return {
    results: Array.isArray(payload.results) ? payload.results : [],
    nextPageToken: payload.next_page_token || null,
  };
}

function googlePlaceToOpportunity(place) {
  const lat = place?.geometry?.location?.lat;
  const lng = place?.geometry?.location?.lng;
  const safeName = place?.name || 'Local nonprofit';
  let mapsUrl = 'https://www.google.com/maps';
  if (place?.place_id) {
    const q = new URLSearchParams({ api: '1', query: safeName, query_place_id: place.place_id });
    mapsUrl = `https://www.google.com/maps/search/?${q.toString()}`;
  } else if (typeof lat === 'number' && typeof lng === 'number') {
    const q = new URLSearchParams({ api: '1', query: `${lat},${lng}` });
    mapsUrl = `https://www.google.com/maps/search/?${q.toString()}`;
  } else {
    const q = new URLSearchParams({ api: '1', query: safeName });
    mapsUrl = `https://www.google.com/maps/search/?${q.toString()}`;
  }

  return {
    id: `g-${place.place_id || `${safeName}-${lat}-${lng}`}`,
    title: `${safeName} volunteer`,
    organization: safeName,
    description:
      place?.business_status === 'OPERATIONAL'
        ? 'Nearby organization from Google Places. Open to learn current volunteer options.'
        : 'Nearby organization from Google Places. Open listing for volunteer opportunities.',
    locationLabel: place?.vicinity || 'Nearby',
    latitude: typeof lat === 'number' ? lat : undefined,
    longitude: typeof lng === 'number' ? lng : undefined,
    isRemote: false,
    applyUrl: mapsUrl,
    tags: inferTagsFromGoogleTypes(place?.types),
    rating: typeof place?.rating === 'number' ? place.rating : null,
    logoDomain: null,
    source: 'google_places',
  };
}

async function fetchGoogleVolunteerPlaces({
  latitude,
  longitude,
  maxDistanceMiles,
  selectedTags = [],
  pageToken = null,
}) {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error('Missing Google Maps API key.');
  }

  const radiusMeters = Math.min(Math.max(Math.round(maxDistanceMiles * 1609.34), 1000), 50000);

  // Pagination continues the *primary* query only (same token chain Google returns).
  if (pageToken) {
    const { results, nextPageToken } = await executeGoogleNearbySearch(apiKey, { pageToken });
    return {
      opportunities: results.map(googlePlaceToOpportunity),
      nextPageToken,
    };
  }

  const tagSet = new Set(selectedTags.map((t) => String(t).toLowerCase().trim()));
  const primaryKeyword = `${buildGoogleKeywordFromTags(selectedTags)} nonprofit charity volunteer`
    .replace(/\s+/g, ' ')
    .trim();

  const extraKeywords = [
    'food bank pantry hunger relief soup kitchen',
    'homeless shelter community kitchen',
  ];
  if (tagSet.has('animals')) {
    extraKeywords.push('animal shelter rescue humane society');
  }
  if (tagSet.has('health')) {
    extraKeywords.push('hospital clinic volunteer');
  }

  const primaryPromise = executeGoogleNearbySearch(apiKey, {
    latitude,
    longitude,
    radiusMeters,
    keyword: primaryKeyword,
  });

  const extraPromises = extraKeywords.map((kw) =>
    executeGoogleNearbySearch(apiKey, {
      latitude,
      longitude,
      radiusMeters,
      keyword: kw,
    }).catch(() => ({ results: [], nextPageToken: null }))
  );

  const [primary, ...extras] = await Promise.all([primaryPromise, ...extraPromises]);

  const byPlaceId = new Map();
  for (const place of primary.results) {
    if (place?.place_id) byPlaceId.set(place.place_id, place);
  }
  for (const batch of extras) {
    for (const place of batch.results) {
      if (place?.place_id && !byPlaceId.has(place.place_id)) {
        byPlaceId.set(place.place_id, place);
      }
    }
  }

  const mergedPlaces = Array.from(byPlaceId.values());
  return {
    opportunities: mergedPlaces.map(googlePlaceToOpportunity),
    nextPageToken: primary.nextPageToken,
  };
}

/**
 * Builds a logo URL from the nonprofit's website domain.
 * Unavatar resolves the public logo/favicon for that domain (no API key).
 * For guaranteed artwork, set `imageUrl` on an opportunity to a direct HTTPS image URL.
 */
function resolveLogoUri(opp) {
  if (opp.imageUrl && typeof opp.imageUrl === 'string') return opp.imageUrl.trim();
  if (opp.logoDomain && typeof opp.logoDomain === 'string') {
    const host = opp.logoDomain.trim().replace(/^https?:\/\//, '').split('/')[0];
    if (!host) return null;
    return `https://unavatar.io/${encodeURIComponent(host)}`;
  }
  return null;
}

/** Shows org logo from network, or a cyan icon if the URL fails to load. */
function VolunteerLogo({ uri, isRemote }) {
  const [failed, setFailed] = useState(false);
  // If the parent passes a new uri (e.g. data refresh), try loading again
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (failed || !uri) {
    return (
      <View style={styles.logoPlaceholder} accessibilityLabel="Organization logo unavailable">
        <Ionicons name={isRemote ? 'globe-outline' : 'heart-outline'} size={22} color="#00ffff" />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={styles.logoImage}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityIgnoresInvertColors
    />
  );
}

const INTEREST_OPTIONS = [
  { id: 'animals', label: 'Animals' },
  { id: 'environment', label: 'Environment' },
  { id: 'youth', label: 'Youth' },
  { id: 'seniors', label: 'Seniors' },
  { id: 'food', label: 'Food / hunger' },
  { id: 'health', label: 'Health' },
  { id: 'education', label: 'Education' },
  { id: 'community', label: 'Community' },
];

/**
 * Curated fallback rows (merged with Google Places). Same shape as `googlePlaceToOpportunity`.
 * Replace with API / Supabase when ready. `latitude`/`longitude` are rough city centers for distance.
 */
const VOLUNTEER_OPPORTUNITIES = [
  {
    id: 'curated-volunteermatch',
    title: 'Find a role on VolunteerMatch',
    organization: 'VolunteerMatch',
    description:
      'Search virtual and in-person volunteer openings across the U.S. Filter by cause, skills, and time commitment.',
    locationLabel: 'Remote / nationwide',
    isRemote: true,
    applyUrl: 'https://www.volunteermatch.org/',
    tags: ['community', 'education', 'health', 'youth'],
    logoDomain: 'volunteermatch.org',
    source: 'curated',
  },
  {
    id: 'curated-redcross',
    title: 'American Red Cross volunteering',
    organization: 'American Red Cross',
    description: 'Blood drives, disaster response, and community support — local and remote options.',
    locationLabel: 'Nationwide chapters',
    isRemote: true,
    applyUrl: 'https://www.redcross.org/volunteer',
    tags: ['health', 'community', 'seniors'],
    logoDomain: 'redcross.org',
    source: 'curated',
  },
  {
    id: 'curated-feeding-america',
    title: 'Food bank & pantry volunteering',
    organization: 'Feeding America',
    description: 'Locate a member food bank for sorting, packing, and distribution shifts near you.',
    locationLabel: 'United States',
    latitude: 41.8781,
    longitude: -87.6298,
    isRemote: false,
    applyUrl: 'https://www.feedingamerica.org/find-your-local-foodbank',
    tags: ['food', 'community'],
    logoDomain: 'feedingamerica.org',
    source: 'curated',
  },
  {
    id: 'curated-idealist',
    title: 'Idealist — nonprofit jobs & volunteer',
    organization: 'Idealist',
    description: 'Browse volunteer listings from nonprofits worldwide, including many remote roles.',
    locationLabel: 'Remote / global',
    isRemote: true,
    applyUrl: 'https://www.idealist.org/en/?type=VOLUNTEER',
    tags: ['community', 'education', 'environment'],
    logoDomain: 'idealist.org',
    source: 'curated',
  },
];

export default function VolunteerOpportunitiesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [maxDistanceMiles, setMaxDistanceMiles] = useState(30);
  const [selectedTags, setSelectedTags] = useState([]);
  const [includeRemote, setIncludeRemote] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [googleOpportunities, setGoogleOpportunities] = useState([]);
  const [isFetchingGoogle, setIsFetchingGoogle] = useState(false);
  const [isFetchingMoreGoogle, setIsFetchingMoreGoogle] = useState(false);
  const [googleFetchError, setGoogleFetchError] = useState('');
  const [googleNextPageToken, setGoogleNextPageToken] = useState(null);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [eventDraft, setEventDraft] = useState(null);

  const openVolunteerAsCommunityEvent = useCallback((opp) => {
    setEventDraft(volunteerToEventInitialValues(opp));
    setEventModalVisible(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [milesRaw, tagsRaw, remoteRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_MAX_MILES),
          AsyncStorage.getItem(STORAGE_TAGS),
          AsyncStorage.getItem(STORAGE_INCLUDE_REMOTE),
        ]);
        if (cancelled) return;
        if (milesRaw != null) {
          const n = Number(milesRaw);
          if (!Number.isNaN(n) && n >= 5 && n <= 200) setMaxDistanceMiles(n);
        }
        if (tagsRaw) {
          const parsed = JSON.parse(tagsRaw);
          if (Array.isArray(parsed)) setSelectedTags(parsed.filter((t) => typeof t === 'string'));
        }
        if (remoteRaw != null) setIncludeRemote(remoteRaw === '1');
      } catch (e) {
        console.warn('[Volunteer] load prefs', e);
      } finally {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistMaxMiles = useCallback(async (value) => {
    setMaxDistanceMiles(value);
    try {
      await AsyncStorage.setItem(STORAGE_MAX_MILES, String(Math.round(value)));
    } catch (e) {
      console.warn('[Volunteer] save miles', e);
    }
  }, []);

  const toggleTag = useCallback(async (id) => {
    setSelectedTags((prev) => {
      const next = prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id];
      AsyncStorage.setItem(STORAGE_TAGS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setRemotePref = useCallback(async (value) => {
    setIncludeRemote(value);
    try {
      await AsyncStorage.setItem(STORAGE_INCLUDE_REMOTE, value ? '1' : '0');
    } catch (e) {
      console.warn('[Volunteer] save remote', e);
    }
  }, []);

  const refreshLocation = useCallback(async () => {
    setLocationStatus('loading');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setUserLocation(null);
        setLocationStatus('denied');
        Alert.alert(
          'Location off',
          'Turn on location to rank nearby roles by distance. You can still browse by interest.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUserLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setLocationStatus('granted');
    } catch (e) {
      console.warn('[Volunteer] location', e);
      setUserLocation(null);
      setLocationStatus('error');
    }
  }, []);

  useEffect(() => {
    refreshLocation();
  }, [refreshLocation]);

  useEffect(() => {
    let active = true;

    const runFetch = async () => {
      if (!userLocation) return;
      setIsFetchingGoogle(true);
      setGoogleFetchError('');
      setGoogleNextPageToken(null);
      try {
        const fetched = await fetchGoogleVolunteerPlaces({
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          maxDistanceMiles,
          selectedTags,
        });
        if (!active) return;
        setGoogleOpportunities(fetched.opportunities);
        setGoogleNextPageToken(fetched.nextPageToken);
      } catch (error) {
        if (!active) return;
        console.warn('[Volunteer] google places fetch', error);
        setGoogleOpportunities([]);
        setGoogleNextPageToken(null);
        setGoogleFetchError('Could not load live nearby listings right now.');
      } finally {
        if (active) setIsFetchingGoogle(false);
      }
    };

    runFetch();
    return () => {
      active = false;
    };
  }, [userLocation, maxDistanceMiles, selectedTags]);

  const handleLoadMoreGoogle = useCallback(async () => {
    if (!userLocation || !googleNextPageToken || isFetchingMoreGoogle) return;
    setIsFetchingMoreGoogle(true);
    setGoogleFetchError('');
    try {
      const fetched = await fetchGoogleVolunteerPlaces({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        maxDistanceMiles,
        selectedTags,
        pageToken: googleNextPageToken,
      });

      setGoogleOpportunities((prev) => {
        const merged = [...prev, ...fetched.opportunities];
        return merged.filter((item, idx, all) => all.findIndex((x) => x.id === item.id) === idx);
      });
      setGoogleNextPageToken(fetched.nextPageToken);
    } catch (error) {
      console.warn('[Volunteer] load more google places', error);
      setGoogleFetchError(error?.message || 'Unable to load more Google results right now.');
    } finally {
      setIsFetchingMoreGoogle(false);
    }
  }, [googleNextPageToken, isFetchingMoreGoogle, maxDistanceMiles, selectedTags, userLocation]);

  const results = useMemo(
    () =>
      findVolunteerOpportunities(
        [...googleOpportunities, ...VOLUNTEER_OPPORTUNITIES].filter(
          (item, idx, all) => all.findIndex((x) => x.id === item.id) === idx
        ),
        {
        userLocation,
        preferredTags: selectedTags,
        maxDistanceMiles,
        includeRemote,
      }
      ),
    [googleOpportunities, userLocation, selectedTags, maxDistanceMiles, includeRemote]
  );

  const openApply = (url) => {
    if (!url) return;
    Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', 'Please try again in a moment.');
    });
  };

  const paddingTop = Math.max(insets.top, Platform.OS === 'ios' ? 8 : 12);

  if (!prefsLoaded) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator color="#00ffff" />
        <Text style={styles.muted}>Loading preferences…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Volunteer opportunities</Text>
          <Text style={styles.subtitle}>
            Matched to your interests{userLocation ? ' and distance' : ''}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="location-outline" size={22} color="#00ffff" />
            <Text style={styles.cardTitle}>Your location</Text>
            <TouchableOpacity onPress={refreshLocation} style={styles.refreshBtn}>
              <Text style={styles.refreshText}>Refresh</Text>
            </TouchableOpacity>
          </View>
          {locationStatus === 'loading' && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color="#00ffff" size="small" />
              <Text style={styles.muted}>Finding your position…</Text>
            </View>
          )}
          {locationStatus === 'granted' && userLocation && (
            <Text style={styles.bodyText}>
              Using your current location to filter within{' '}
              <Text style={styles.accent}>{Math.round(maxDistanceMiles)} mi</Text>.
            </Text>
          )}
          {locationStatus === 'denied' && (
            <Text style={styles.bodyText}>
              Location permission denied — showing roles by interest only. Enable location in settings
              for mile-based matching.
            </Text>
          )}
          {(locationStatus === 'idle' || locationStatus === 'error') && !userLocation && (
            <Text style={styles.bodyText}>Location unavailable — browse by interest below.</Text>
          )}
          {isFetchingGoogle && (
            <View style={styles.rowCenter}>
              <ActivityIndicator color="#00ffff" size="small" />
              <Text style={styles.muted}>Loading nearby results from Google Places…</Text>
            </View>
          )}
          {!!googleFetchError && <Text style={styles.warningText}>{googleFetchError}</Text>}
          {!isFetchingGoogle && !googleFetchError && userLocation && (
            <Text style={styles.mutedSmall}>
              {googleOpportunities.length} live nearby result(s) from Google Places.
            </Text>
          )}
          {!!googleNextPageToken && (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMoreGoogle}
              activeOpacity={0.85}
              disabled={isFetchingMoreGoogle}
            >
              {isFetchingMoreGoogle ? (
                <>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.loadMoreButtonText}>Loading more…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={16} color="#000" />
                  <Text style={styles.loadMoreButtonText}>Load more nearby</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Max distance (miles)</Text>
          <Text style={styles.sliderValue}>{Math.round(maxDistanceMiles)} mi</Text>
          {/*
            Slider: continuous value between min/max; onSlidingComplete fires when user releases,
            so we persist once (not every frame while dragging).
          */}
          <Slider
            style={styles.slider}
            minimumValue={5}
            maximumValue={200}
            step={5}
            value={maxDistanceMiles}
            onValueChange={setMaxDistanceMiles}
            onSlidingComplete={persistMaxMiles}
            minimumTrackTintColor="#00ffff"
            maximumTrackTintColor="rgba(255,255,255,0.15)"
            thumbTintColor="#00ffff"
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.muted}>5 mi</Text>
            <Text style={styles.muted}>200 mi</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Include remote roles</Text>
              <Text style={styles.mutedSmall}>Virtual or nationwide opportunities</Text>
            </View>
            <Switch
              value={includeRemote}
              onValueChange={setRemotePref}
              trackColor={{ false: '#333', true: 'rgba(0,255,255,0.35)' }}
              thumbColor={includeRemote ? '#00ffff' : '#888'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Interests (tap to filter)</Text>
          <View style={styles.chipWrap}>
            {INTEREST_OPTIONS.map((opt) => {
              const on = selectedTags.includes(opt.id);
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggleTag(opt.id)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedTags.length === 0 && (
            <Text style={styles.mutedSmall}>No selection = show all types within your distance.</Text>
          )}
        </View>

        <Text style={styles.resultsCount}>
          {results.length} match{results.length === 1 ? '' : 'es'}
        </Text>

        {results.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="search-outline" size={40} color="#666" />
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySub}>
              Try increasing max miles, turning on remote roles, or clearing some interest filters.
            </Text>
          </View>
        ) : (
          results.map((item) => (
            <View key={item.id} style={styles.oppCard}>
              <TouchableOpacity
                onPress={() => openApply(item.applyUrl)}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel={`Open details for ${item.title}`}
              >
                <View style={styles.oppTop}>
                  <VolunteerLogo
                    uri={resolveLogoUri(item)}
                    isRemote={item.isRemote}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.oppTitle}>{item.title}</Text>
                    <Text style={styles.oppOrg}>{item.organization}</Text>
                  </View>
                  <Ionicons name="open-outline" size={20} color="#00ffff" />
                </View>
                <Text style={styles.oppDesc}>{item.description}</Text>
                <View style={styles.oppMeta}>
                  <Ionicons name="pin-outline" size={14} color="#999" />
                  <Text style={styles.metaText}>{item.locationLabel}</Text>
                </View>
                {item.distanceMiles != null && (
                  <Text style={styles.distanceText}>~{item.distanceMiles.toFixed(1)} mi away</Text>
                )}
                {item.needsLocationForDistance && (
                  <Text style={styles.hintText}>Enable location to see distance and tighter filtering.</Text>
                )}
                {item.tagMatches > 0 && selectedTags.length > 0 && (
                  <View style={styles.badgeRow}>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.tagMatches} interest match{item.tagMatches > 1 ? 'es' : ''}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.postToCommunityBtn}
                onPress={() => openVolunteerAsCommunityEvent(item)}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color="#00ffff" />
                <Text style={styles.postToCommunityBtnText}>Post to community</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <AddEventModal
        visible={eventModalVisible}
        initialValues={eventDraft}
        onClose={() => {
          setEventModalVisible(false);
          setEventDraft(null);
        }}
        onSuccess={() => {
          setEventModalVisible(false);
          setEventDraft(null);
          // Land on Community → Feed so the new event is visible after the success alert.
          router.push('/(tabs)/community?tab=feed');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.12)',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#8ddddd',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  card: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  refreshBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  refreshText: {
    color: '#00ffff',
    fontWeight: '600',
    fontSize: 14,
  },
  bodyText: {
    color: '#d7fefe',
    fontSize: 14,
    lineHeight: 21,
  },
  warningText: {
    color: '#ff9f9f',
    fontSize: 12,
    marginTop: 8,
  },
  loadMoreButton: {
    marginTop: 10,
    backgroundColor: '#00ffff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadMoreButtonText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '700',
  },
  accent: {
    color: '#00ffff',
    fontWeight: '700',
  },
  muted: {
    color: '#999',
    fontSize: 13,
    marginLeft: 8,
  },
  mutedSmall: {
    color: '#777',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 4,
  },
  sliderValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#00ffff',
    marginTop: 4,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  section: {
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipOn: {
    borderColor: 'rgba(0, 255, 255, 0.5)',
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
  },
  chipText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextOn: {
    color: '#00ffff',
  },
  resultsCount: {
    color: '#666',
    fontSize: 13,
    marginBottom: 12,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySub: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  oppCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 15,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  postToCommunityBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    borderRadius: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.35)',
  },
  postToCommunityBtnText: {
    color: '#00ffff',
    fontSize: 14,
    fontWeight: '700',
  },
  oppTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 10,
  },
  logoImage: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  logoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  oppTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  oppOrg: {
    color: '#8ddddd',
    fontSize: 13,
    marginTop: 2,
  },
  oppDesc: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 10,
  },
  oppMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#999',
    fontSize: 13,
    flex: 1,
  },
  distanceText: {
    color: '#00ffff',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  hintText: {
    color: '#888',
    fontSize: 12,
    marginTop: 6,
    fontStyle: 'italic',
  },
  badgeRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  badge: {
    backgroundColor: 'rgba(0, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.25)',
  },
  badgeText: {
    color: '#00ffff',
    fontSize: 11,
    fontWeight: '600',
  },
});
