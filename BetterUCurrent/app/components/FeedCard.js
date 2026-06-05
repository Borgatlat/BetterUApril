import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RunRouteMap from '../../components/RunRouteMap';
import { hasDrawableRunPath } from '../../utils/runPathMap';
import { Video } from 'expo-av'; // Import Video component for video playback
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../context/NotificationContext';
import { useRouter } from 'expo-router';
import { toggleKudos, supportsKudos } from '../../utils/kudosService';
import { createKudosNotification } from '../../utils/notificationHelpers';
import { useAuth } from '../../context/AuthContext';
import { COMMUNITY_THEME } from '../../config/communityTheme';
import { formatApiError } from '../../lib/formatApiError';
import { shareActivityLink } from '../../lib/shareLinks';

const KUDOS_ACCENT = COMMUNITY_THEME.communityAccent;
import CommentsModal from '../(modals)/CommentsModal';
import ReportModal from '../../components/ReportModal';
import { PremiumAvatar } from './PremiumAvatar';

const { width } = Dimensions.get('window');

/** Add https:// for bare www. links so Linking can open them. */
function hrefForOpen(raw) {
  const t = String(raw || '').trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  return t;
}

/** Split copy into plain segments + URL segments (http(s)://… or www.…). */
function splitTextWithUrls(text) {
  const s = String(text ?? '');
  if (!s) return [{ type: 'text', value: '' }];
  const re = /(https?:\/\/[^\s<>"']+)|(www\.[^\s<>"']+)/gi;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) parts.push({ type: 'text', value: s.slice(last, m.index) });
    parts.push({ type: 'link', value: m[0], href: hrefForOpen(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ type: 'text', value: s.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: s }];
}

function openUrlFromFeed(url) {
  const u = hrefForOpen(url);
  if (!u) return;
  Linking.canOpenURL(u)
    .then((ok) => {
      if (ok) return Linking.openURL(u);
      Alert.alert('Cannot open link', 'This address could not be opened from the app.');
    })
    .catch(() => Alert.alert('Cannot open link', 'Please try again in a moment.'));
}

/**
 * Renders description with tappable URLs (volunteer “Sign up / details: …”, pasted links, etc.).
 * Nested `Text` + `onPress` is the standard React Native pattern for inline links.
 */
function LinkableDescription({ text, baseStyle, linkStyle, numberOfLines }) {
  const parts = useMemo(() => splitTextWithUrls(text), [text]);
  return (
    <Text style={baseStyle} numberOfLines={numberOfLines}>
      {parts.map((p, i) =>
        p.type === 'link' && p.href ? (
          <Text
            key={`l-${i}`}
            style={linkStyle}
            onPress={() => openUrlFromFeed(p.href)}
            accessibilityRole="link"
          >
            {p.value}
          </Text>
        ) : (
          <Text key={`t-${i}`}>{p.value}</Text>
        )
      )}
    </Text>
  );
}

const FeedCard = ({
  avatarUrl,
  name,
  date,
  title,
  description,
  stats, // array of { label, value, highlight? }
  type, // 'workout' | 'mental' | 'pr' | 'run' | 'event'
  targetId, // id of the workout/mental session
  isOwner,
  onEdit,
  style,
  userId,
  photoUrl,
  initialCommentCount = 0,
  initialKudos = [],
  username,
  spotifyTracksPreview = [],
  spotifyTrackCount = 0,
  eventData, // { id, title, description, date, event_date?, time?, event_time?, location, attendees? }
  isEventJoined = false, // whether current user is attending (for Join/Leave button state)
  onJoinEvent, // () => void - called when user taps Join Event
  onLeaveEvent, // () => void - called when user taps Leave Event
  // New props for run data
  runData, // { path, distance_meters, duration_seconds, start_time, end_time }
  showMapToOthers = true, // Whether to show the map to others
  enableInlineMap = true, // uses non-interactive RunRouteMap in feeds to avoid native scroll crashes
  borderColor, // Custom border color for workout posts (set with Sparks)
}) => {
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [kudosList, setKudosList] = useState(Array.isArray(initialKudos) ? initialKudos : []);
  const [kudosBusy, setKudosBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user: authUser } = useAuth();
  const currentUserId = authUser?.id ?? null;
  const [showComments, setShowComments] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const router = useRouter();
  const { createNotification } = useNotifications();

// Event card data shape. Use this structure when passing event data to the feed.
// Event: { id, title, description, date, time, location, attendees, likes, comments, created_at, updated_at }
// EventAttendee: { id, name, avatar_url, is_premium, full_name, username }
// EventLike: { id, event_id, user_id, created_at }
// EventComment: { id, event_id, user_id, comment, created_at, updated_at }





  useEffect(() => {
    setCommentCount(initialCommentCount);
  }, [initialCommentCount]);

  const initialKudosKey = useMemo(
    () =>
      (Array.isArray(initialKudos) ? initialKudos : [])
        .map((k) => k.user_id)
        .sort()
        .join(','),
    [initialKudos]
  );

  useEffect(() => {
    setKudosList(Array.isArray(initialKudos) ? initialKudos : []);
  }, [targetId, initialKudosKey]);

  // Share post - defined at component level so it can be used by the share button in JSX
  const sharePost = useCallback(async () => {
    if (!targetId || !type) return;
    try {
      await shareActivityLink({
        id: targetId,
        type,
        title: title || undefined,
      });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  }, [targetId, type, title]);

  const showInteractRow = type === 'workout' || type === 'mental' || type === 'run';
  const hasKudosed = currentUserId
    ? kudosList.some((k) => k.user_id === currentUserId)
    : false;
  const kudosCount = kudosList.length;

  const handleKudos = useCallback(async () => {
    if (kudosBusy) return;

    if (!supportsKudos(type)) {
      Alert.alert('Likes', 'Likes are available on workouts, runs, and mental sessions.');
      return;
    }

    if (!targetId) {
      Alert.alert('Likes', 'This post cannot be liked right now.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Sign in required', 'Sign in to like posts from your friends.');
      return;
    }

    const wasKudosed = hasKudosed;
    setKudosBusy(true);

    if (wasKudosed) {
      setKudosList((prev) => prev.filter((k) => k.user_id !== currentUserId));
    } else {
      setKudosList((prev) => [...prev, { user_id: currentUserId, created_at: new Date().toISOString() }]);
    }

    try {
      const { kudosed } = await toggleKudos(type, targetId, currentUserId);

      if (kudosed && currentUserId !== userId && userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, full_name')
          .eq('id', currentUserId)
          .single();
        const giverName = profile?.username || profile?.full_name || 'Someone';
        try {
          await createKudosNotification(currentUserId, userId, giverName, type, targetId);
        } catch (notifyErr) {
          console.warn('[FeedCard] kudos notification:', notifyErr?.message ?? notifyErr);
        }
      }
    } catch (error) {
      console.error('[FeedCard] kudos error:', error);
      if (wasKudosed) {
        setKudosList((prev) => [...prev, { user_id: currentUserId }]);
      } else {
        setKudosList((prev) => prev.filter((k) => k.user_id !== currentUserId));
      }
      Alert.alert('Could not update like', formatApiError(error));
    } finally {
      setKudosBusy(false);
    }
  }, [currentUserId, targetId, type, kudosBusy, hasKudosed, userId]);

  const navigateToActivity = useCallback(() => {
    if (type === 'event') return;
    if (!targetId) {
      console.error('No target ID provided for navigation');
      return;
    }
    try {
      router.push(`/activity/${targetId}`);
    } catch (error) {
      console.error('Error navigating to activity:', error);
    }
  }, [router, targetId, type]);

  const getIcon = () => {
    switch (type) {
      case 'workout':
        return 'barbell-outline';
      case 'mental':
        return 'leaf-outline';
      case 'pr':
        return 'trophy-outline';
      case 'run':
        return 'fitness-outline';
      case 'event':
        return 'calendar-outline';
      case 'bond':
      case 'bond_purchased':
      case 'bond_withdrawn':
        return 'trending-up-outline';
      default:
        return 'fitness-outline';
        
    }
  };

  const previewTracks = Array.isArray(spotifyTracksPreview) ? spotifyTracksPreview.slice(0, 3) : [];

  const openSpotifyTrack = useCallback(async (track) => {
    const trackId = typeof track?.track_id === 'string' ? track.track_id.trim() : '';
    if (!trackId) {
      Alert.alert('Track unavailable', 'We could not find a Spotify link for this song.');
      return;
    }

    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;

    try {
      const supported = await Linking.canOpenURL(spotifyUrl);
      if (!supported) {
        Alert.alert('Spotify unavailable', 'Spotify could not be opened on this device.');
        return;
      }

      await Linking.openURL(spotifyUrl);
    } catch (error) {
      console.error('Failed to open Spotify track link from feed:', error);
      Alert.alert('Error', 'Something went wrong while opening Spotify.');
    }
  }, []);

  // Neon blue accent for event cards so they stand out in the feed
  const EVENT_BORDER_COLOR = '#00ffff';
  const eventCardStyle = type === 'event' ? {
    borderWidth: 3,
    borderColor: EVENT_BORDER_COLOR,
    shadowColor: EVENT_BORDER_COLOR,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  } : null;

  const cardStyle = [
    styles.card,
    style,
    eventCardStyle,
    !eventCardStyle &&
      borderColor && {
        borderWidth: 3,
        borderColor: borderColor,
        shadowColor: borderColor,
        shadowOpacity: 0.4,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: 5,
      },
  ];

  const isBondActivity = type === 'bond' || type === 'bond_purchased' || type === 'bond_withdrawn';
  const canOpenActivity = !isBondActivity && type !== 'event' && Boolean(targetId);
  const CardBody = canOpenActivity ? TouchableOpacity : View;
  const cardBodyProps = canOpenActivity
    ? {
        onPress: navigateToActivity,
        activeOpacity: 0.9,
        accessibilityRole: 'button',
        accessibilityLabel: 'Open activity details',
      }
    : {};

  return (
    <View style={cardStyle}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <TouchableOpacity onPress={() => {
            try {
              if (userId) {
                router.push(`/profile/${userId}`);
              } else {
                console.error('No user ID provided for profile navigation');
              }
            } catch (error) {
              console.error('Error navigating to profile:', error);
            }
          }}>
            <PremiumAvatar
              userId={userId}
              source={avatarUrl ? { uri: avatarUrl } : null}
              size={44}
              style={styles.avatar}
              username={username}
              fullName={name}
            />
          </TouchableOpacity>
          <View>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.date}>{date}</Text>
          </View>
        </View>
        {isOwner && onEdit && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Ionicons name="pencil" size={20} color="#00ffff" />
          </TouchableOpacity>
        )}
      </View>

      <CardBody {...cardBodyProps}>
      <View style={styles.titleContainer}>
        <Ionicons name={getIcon()} size={24} color="#00ffff" style={styles.titleIcon} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {description ? (
        <LinkableDescription
          text={String(description)}
          baseStyle={styles.description}
          linkStyle={styles.descriptionLink}
        />
      ) : null}

      {/* TEMPORARILY DISABLED: Music visibility on feed cards
      {type === 'workout' && previewTracks.length > 0 && (
        <TouchableOpacity
          style={styles.spotifyPreviewContainer}
          activeOpacity={0.88}
          onPress={() => {
            try {
              if (targetId) {
                router.push(`/activity/${targetId}`);
              }
            } catch (error) {
              console.error('Error navigating to activity from Spotify preview:', error);
            }
          }}
        >
          <View style={styles.spotifyPreviewHeader}>
            <View style={styles.spotifyPreviewHeaderLeft}>
              <Ionicons name="musical-notes-outline" size={18} color="#00ffff" />
              <Text style={styles.spotifyPreviewHeaderText}>Songs Played</Text>
            </View>
            <View style={styles.spotifyPreviewHeaderRight}>
              <Text style={styles.spotifyPreviewCount}>
                {spotifyTrackCount} {spotifyTrackCount === 1 ? 'song' : 'songs'}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="#00ffff" />
            </View>
          </View>
          <View style={styles.spotifyPreviewList}>
            {previewTracks.map((track, index) => (
              <TouchableOpacity
                key={`${track.track_id || track.played_at || index}-${index}`}
                style={styles.spotifyPreviewListItem}
                activeOpacity={0.85}
                onPress={() => openSpotifyTrack(track)}
              >
                {track.album_image_url ? (
                  <Image source={{ uri: track.album_image_url }} style={styles.spotifyPreviewAlbumArt} />
                ) : (
                  <View style={styles.spotifyPreviewAlbumFallback}>
                    <Ionicons name="musical-notes-outline" size={16} color="#00ffff" />
                  </View>
                )}
                <View style={styles.spotifyTrackInfo}>
                  <Text style={styles.spotifyTrackTitle} numberOfLines={1} ellipsizeMode="tail">
                    {track.track_name || 'Unknown Track'}
                  </Text>
                  {track.artist_name ? (
                    <Text style={styles.spotifyTrackArtist} numberOfLines={1} ellipsizeMode="tail">
                      {track.artist_name}
                    </Text>
                  ) : null}
                  {track.album_name ? (
                    <Text style={styles.spotifyTrackAlbum} numberOfLines={1} ellipsizeMode="tail">
                      {track.album_name}
                    </Text>
                  ) : null}
                </View>
                {track.played_at ? (
                  <Text style={styles.spotifyPreviewTime}>
                    {new Date(track.played_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
          {spotifyTrackCount > previewTracks.length && (
            <Text style={styles.spotifyPreviewMore}>Tap to view all songs</Text>
          )}
        </TouchableOpacity>
      )}
      */}

      {/* Show photo or video for workout/mental/run posts */}
      {(type === 'workout' || type === 'mental' || type === 'run') && photoUrl && (
        <View style={styles.photoContainer}>
          {/* Check if it's a video by checking the URL extension or Cloudinary resource type */}
          {photoUrl.includes('.mp4') || photoUrl.includes('.mov') || photoUrl.includes('/video/') || photoUrl.includes('resource_type=video') ? (
            // Video player - shows video with native controls
            <Video
              source={{ uri: photoUrl }}
              style={styles.activityPhoto}
              resizeMode="cover"
              shouldPlay={false} // Don't autoplay - user must tap to play
              useNativeControls // Show native play/pause/seek controls
              isLooping={false} // Don't loop by default
            />
          ) : (
            // Image display for photos
            <Image 
              source={{ uri: photoUrl }} 
              style={styles.activityPhoto}
              resizeMode="cover"
            />
          )}
        </View>
      )}

      {/* Event card: date, time, location and Join / Leave buttons */}
      {type === 'event' && eventData && (
        <View style={styles.eventContainer}>
          <View style={styles.eventDetailsRow}>
            <View style={styles.eventDateTimeRow}>
              <Ionicons name="calendar-outline" size={16} color="#00ffff" style={{ marginRight: 6 }} />
              <Text style={styles.eventDateText}>
                {eventData.event_date ? new Date(eventData.event_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : (eventData.date || '—')}
              </Text>
            </View>
            <View style={styles.eventDateTimeRow}>
              <Ionicons name="time-outline" size={16} color="#00ffff" style={{ marginRight: 6 }} />
              <Text style={styles.eventTimeText}>{eventData.event_time || eventData.time || '—'}</Text>
            </View>
            
            {(eventData.location && eventData.location.trim()) ? (
              <View style={styles.eventDateTimeRow}>
                <Ionicons name="location-outline" size={16} color="#00ffff" style={{ marginRight: 6 }} />
                <LinkableDescription
                  text={String(eventData.location).trim()}
                  baseStyle={styles.eventLocationText}
                  linkStyle={styles.descriptionLink}
                  numberOfLines={2}
                />
              </View>
            ) : null}
          </View>
          {(eventData.attendeesWhoAreFriends && eventData.attendeesWhoAreFriends.length > 0) ? (
            <View style={styles.eventAttendeesRow}>
              <Text style={styles.eventAttendeesLabel}>Friends going: </Text>
              <View style={styles.eventAttendeesAvatars}>
                {eventData.attendeesWhoAreFriends.slice(0, 5).map((attendee, index) => (
                  <TouchableOpacity
                    key={attendee.user_id}
                    onPress={() => router.push(`/profile/${attendee.user_id}`)}
                    style={[styles.eventAttendeeAvatar, { marginLeft: index > 0 ? -10 : 0 }]}
                  >
                    <Image
                      source={{ uri: attendee.avatar_url || 'https://placehold.co/40x40/333/fff?text=?' }}
                      style={styles.eventAttendeeAvatarImage}
                    />
                  </TouchableOpacity>
                ))}
                {eventData.attendeesWhoAreFriends.length > 5 && (
                  <View style={[styles.eventAttendeeAvatar, styles.eventAttendeeMore, { marginLeft: -10 }]}>
                    <Text style={styles.eventAttendeeMoreText}>+{eventData.attendeesWhoAreFriends.length - 5}</Text>
                  </View>
                )}
              </View>
            </View>
          ) : null}
          {(onJoinEvent || onLeaveEvent) ? (
            isEventJoined ? (
              <TouchableOpacity
                onPress={onLeaveEvent}
                style={styles.leaveEventButton}
                accessibilityLabel="Leave event"
                accessibilityRole="button"
              >
                <Ionicons name="close-outline" size={20} color="#ff6b6b" style={{ marginRight: 8 }} />
                <Text style={styles.leaveEventButtonText}>Leave Event</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={onJoinEvent}
                style={styles.joinEventButton}
                accessibilityLabel="Join event"
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-outline" size={20} color="#00ffff" style={{ marginRight: 8 }} />
                <Text style={styles.joinEventButtonText}>Join Event</Text>
              </TouchableOpacity>
            )
          ) : null}
        </View>
      )}
      {/* Route preview — non-interactive map avoids ScrollView/FlatList native crashes */}
      {enableInlineMap &&
        type === 'run' &&
        runData &&
        showMapToOthers &&
        hasDrawableRunPath(runData.path) && (
        <View style={styles.mapContainer}>
          <View style={styles.interactiveMapContainer}>
            <RunRouteMap
              path={runData.path}
              style={styles.interactiveMap}
              interactable={false}
            />
          </View>
        </View>
      )}

      <View style={styles.statsContainer}>
        {stats?.map((stat, index) => (
          <View key={index} style={styles.statItem}>
            <Text style={[styles.statValue, stat.highlight && styles.highlightedStat]}>
              {stat.value}
            </Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      </CardBody>

      {showInteractRow && (
        <View style={styles.actionsContainer}>
          <View style={styles.topActionsRow}>
            <TouchableOpacity
              onPress={handleKudos}
              style={[styles.kudosButton, hasKudosed && styles.kudosButtonActive]}
              disabled={kudosBusy}
              accessibilityLabel={
                kudosCount > 0
                  ? `Liked, ${kudosCount} ${kudosCount === 1 ? 'like' : 'likes'}`
                  : 'Like post'
              }
              accessibilityRole="button"
              accessibilityState={{ selected: hasKudosed }}
            >
              <Ionicons
                name={hasKudosed ? 'thumbs-up' : 'thumbs-up-outline'}
                size={26}
                color={hasKudosed ? KUDOS_ACCENT : '#6b7280'}
              />
              {kudosCount > 0 ? (
                <Text style={[styles.kudosCountText, hasKudosed && styles.kudosCountTextActive]}>
                  {kudosCount}
                </Text>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={sharePost}
              style={styles.shareButton}
              accessibilityLabel="Share post"
              accessibilityRole="button"
            >
              <Ionicons name="share-outline" size={24} color="#00ffff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentsButton}
              onPress={() => router.push({
                pathname: '/(modals)/CommentsScreen',
                params: { activityId: targetId, activityType: type }
              })}
              accessibilityLabel={`Comments, ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="#00ffff" />
              {commentCount > 0 ? (
                <Text style={styles.commentsText}>({commentCount})</Text>
              ) : null}
            </TouchableOpacity>
            {userId !== currentUserId && (
              <TouchableOpacity
                style={styles.reportButton}
                onPress={() => setShowReportModal(true)}
                accessibilityLabel="Report post"
                accessibilityRole="button"
              >
                <Ionicons name="flag-outline" size={24} color="#dc3545" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Report Modal - rendered outside actionsContainer so it overlays the whole screen */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={userId}
        reportedContent={`${type} by ${name}`}
        contentType={type}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  kudosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
    minHeight: 44,
    gap: 4,
  },
  kudosButtonActive: {
    backgroundColor: 'rgba(0,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,255,0.45)',
  },
  kudosCountText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
  kudosCountTextActive: {
    color: KUDOS_ACCENT,
  },
  shareButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,255,255,0.04)',
    minHeight: 44,
    marginLeft: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#18191b',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
  },
  avatarIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  date: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  editButton: {
    padding: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 2,
  },
  titleIcon: {
    marginRight: 8,
  },
  title: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 19,
  },
  description: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  descriptionLink: {
    color: '#00ffff',
    textDecorationLine: 'underline',
    fontSize: 14,
    lineHeight: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 2,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 17,
  },
  statLabel: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  // Event card: container and detail rows
  eventContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 255, 255, 0.2)',
  },
  eventDetailsRow: {
    marginBottom: 12,
  },
  eventDateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventDateText: {
    color: '#ccc',
    fontSize: 14,
  },
  eventTimeText: {
    color: '#ccc',
    fontSize: 14,
  },
  eventLocationText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  eventAttendeesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  eventAttendeesLabel: {
    color: '#888',
    fontSize: 13,
    marginRight: 8,
  },
  eventAttendeesAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventAttendeeAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#18191b',
    overflow: 'hidden',
  },
  eventAttendeeAvatarImage: {
    width: '100%',
    height: '100%',
  },
  eventAttendeeMore: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventAttendeeMoreText: {
    color: '#00ffff',
    fontSize: 11,
    fontWeight: '600',
  },
  joinEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#00ffff',
  },
  joinEventButtonText: {
    color: '#00ffff',
    fontSize: 16,
    fontWeight: '600',
  },
  leaveEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#ff6b6b',
  },
  leaveEventButtonText: {
    color: '#ff6b6b',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsContainer: {
    marginTop: 10,
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    width: '100%',
  },
  highlightedStat: {
    color: '#00ffff',
  },
  commentsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,255,255,0.04)',
    minHeight: 44,
    marginLeft: 10,
    gap: 4,
  },
  commentsText: {
    color: '#00ffff',
    fontWeight: '600',
    fontSize: 14,
  },
  spotifyPreviewContainer: {
    marginTop: 12,
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    gap: 12
  },
  spotifyPreviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  spotifyPreviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  spotifyPreviewHeaderText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600'
  },
  spotifyPreviewHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  spotifyPreviewCount: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600'
  },
  spotifyPreviewList: {
    gap: 12
  },
  spotifyPreviewListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  spotifyTrackInfo: {
    flex: 1,
    minWidth: 0
  },
  spotifyPreviewAlbumArt: {
    width: 44,
    height: 44,
    borderRadius: 8
  },
  spotifyPreviewAlbumFallback: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  spotifyTrackTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1
  },
  spotifyTrackArtist: {
    color: '#00ffff',
    fontSize: 13,
    flexShrink: 1
  },
  spotifyTrackAlbum: {
    color: '#777',
    fontSize: 12,
    flexShrink: 1
  },
  spotifyPreviewTime: {
    color: '#888',
    fontSize: 12
  },
  spotifyPreviewMore: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600'
  },
  photoContainer: {
    marginVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  activityPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  mapContainer: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
  },
  mapLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapLoadingText: {
    color: '#00ffff',
    fontSize: 16,
    marginTop: 10,
  },
  interactiveMapContainer: {
    position: 'relative',
    height: 200,
  },
  interactiveMap: {
    height: 200,
  },
  reportButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(220, 53, 69, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 53, 69, 0.2)',
    marginLeft: 0, // Removed marginLeft since we're using gap now
    minWidth: 40, // Add minimum width for consistency
    alignItems: 'center', // Center the icon
    justifyContent: 'center', // Center the icon
  },
  startMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00ffff',
    borderWidth: 2,
    borderColor: '#fff',
  },
  endMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ff0055',
    borderWidth: 2,
    borderColor: '#fff',
  },
});

export default FeedCard; 