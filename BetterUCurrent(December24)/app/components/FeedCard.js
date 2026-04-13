import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Vibration, Dimensions, Alert, Linking, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from '../../lib/MapView';
import { Video } from 'expo-av'; // Import Video component for video playback
import { supabase } from '../../lib/supabase';
import { useNotifications } from '../../context/NotificationContext';
import { createLikeNotification } from '../../utils/notificationHelpers';
import { useRouter } from 'expo-router';
import CommentsModal from '../(modals)/CommentsModal';
import ReportModal from '../../components/ReportModal';
import { PremiumAvatar } from './PremiumAvatar';

const { width } = Dimensions.get('window');

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
  initialKudosCount = 0,
  initialHasKudoed = false,
  initialCommentCount = 0,
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
  borderColor, // Custom border color for workout posts (set with Sparks)
  kudosUsers = [], // Optional: array of { user_id } to show who gave kudos
  profileMap = {}, // Optional: map of user id to { avatar_url } for kudos avatars
}) => {
  const [kudosCount, setKudosCount] = useState(initialKudosCount);
  const [hasKudoed, setHasKudoed] = useState(initialHasKudoed);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showKudosFeedback, setShowKudosFeedback] = useState(false);

  // Map-related state
  const [mapRegion, setMapRegion] = useState(null);
  const [mapLoading, setMapLoading] = useState(false);
  
  const router = useRouter();
  const { createNotification } = useNotifications();

  // Map utility functions
  const parseRunPath = (pathString) => {
    console.log('[FeedCard] parseRunPath called with:', {
      pathString,
      type: typeof pathString,
      isString: typeof pathString === 'string',
      isArray: Array.isArray(pathString),
      length: pathString ? pathString.length : 0
    });
    
    try {
      if (typeof pathString === 'string') {
        const parsed = JSON.parse(pathString);
        console.log('[FeedCard] Successfully parsed string path:', parsed);
        return parsed;
      }
      const result = pathString || [];
      console.log('[FeedCard] Returning non-string path:', result);
      return result;
    } catch (error) {
      console.error('[FeedCard] Error parsing run path:', error, 'Input:', pathString);
      return [];
    }
  };

  const calculateMapRegion = (coordinates) => {
    if (!coordinates || coordinates.length === 0) return null;
    
    const lats = coordinates.map(coord => coord.latitude);
    const lngs = coordinates.map(coord => coord.longitude);
    
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.2; // Add 20% padding
    const lngDelta = (maxLng - minLng) * 1.2;
    
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.01), // Minimum zoom level
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  };

// Event card data shape. Use this structure when passing event data to the feed.
// Event: { id, title, description, date, time, location, attendees, likes, comments, created_at, updated_at }
// EventAttendee: { id, name, avatar_url, is_premium, full_name, username }
// EventLike: { id, event_id, user_id, created_at }
// EventComment: { id, event_id, user_id, comment, created_at, updated_at }





  // Handle run data processing
  useEffect(() => {
    if (type === 'run' && runData) {
      console.log('[FeedCard] Processing run data:', {
        runData,
        path: runData.path,
        pathType: typeof runData.path,
        pathLength: runData.path ? runData.path.length : 0
      });
      
      setMapLoading(true);
      
      try {
        const coordinates = parseRunPath(runData.path);
        console.log('[FeedCard] Parsed coordinates:', {
          coordinates,
          coordinatesLength: coordinates.length,
          firstCoord: coordinates[0],
          lastCoord: coordinates[coordinates.length - 1]
        });
        
        if (coordinates.length > 0) {
          // Calculate map region for interactive map
          const region = calculateMapRegion(coordinates);
          console.log('[FeedCard] Calculated map region:', region);
          setMapRegion(region);
        } else {
          console.log('[FeedCard] No coordinates found');
        }
      } catch (error) {
        console.error('[FeedCard] Error processing run data:', error);
      } finally {
        setMapLoading(false);
      }
    }
  }, [type, runData]);

  // Update state when props change
  useEffect(() => {
    setKudosCount(initialKudosCount);
    setHasKudoed(initialHasKudoed);
    setCommentCount(initialCommentCount);
  }, [initialKudosCount, initialHasKudoed, initialCommentCount]);

  // Determine table and target column based on type
  let table = null;
  let targetColumn = null;
  let commentTable = null;
  let commentColumn = null;
  if (type === 'workout') {
    table = 'workout_kudos';
    targetColumn = 'workout_id';
    commentTable = 'workout_comments';
    commentColumn = 'workout_id';
  } else if (type === 'mental') {
    table = 'mental_session_kudos';
    targetColumn = 'session_id';
    commentTable = 'mental_session_comments';
    commentColumn = 'session_id';
  } else if (type === 'run') {
    table = 'run_kudos';
    targetColumn = 'run_id';
    commentTable = 'run_comments';
    commentColumn = 'run_id';
  }

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getCurrentUser();
  }, []);

  // Share post - defined at component level so it can be used by the share button in JSX
  const sharePost = useCallback(async () => {
    try {
      await Share.share({
        message: 'Check out this post on BetterU',
        url: `https://betteru.app/post/${targetId}`
      });
    } catch (error) {
      console.error('Error sharing post:', error);
    }
  }, [targetId]);

  const handleKudos = async () => {
    if (!table || !targetColumn || !currentUserId || !targetId) return;
    
    // Optimistic update - update UI immediately
    const newHasKudoed = !hasKudoed;
    const newKudosCount = hasKudoed ? kudosCount - 1 : kudosCount + 1;
    setHasKudoed(newHasKudoed);
    setKudosCount(newKudosCount);
    
    // Very light tap feedback
    Vibration.vibrate(5);

    try {
      // Check if kudos already exists
      const { data: existingKudos, error: fetchError } = await supabase
        .from(table)
        .select('*')
        .eq(targetColumn, targetId)
        .eq('user_id', currentUserId);

      if (fetchError) {
        // Revert optimistic update if there's an error
        setHasKudoed(!newHasKudoed);
        setKudosCount(!newKudosCount);
        throw fetchError;
      }

      if (existingKudos && existingKudos.length > 0) {
        // If kudos exists, remove it
        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq(targetColumn, targetId)
          .eq('user_id', currentUserId);

        if (deleteError) {
          // Revert optimistic update if there's an error
          setHasKudoed(!newHasKudoed);
          setKudosCount(!newKudosCount);
          throw deleteError;
        }
      } else {
        // If no kudos exists, add it
        const { error: insertError } = await supabase
          .from(table)
          .insert([{
            [targetColumn]: targetId,
            user_id: currentUserId
          }]);

        if (insertError) {
          // Revert optimistic update if there's an error
          setHasKudoed(!newHasKudoed);
          setKudosCount(!newKudosCount);
          throw insertError;
        }

        // Create push notification for the post owner (only if not the same user)
        if (currentUserId !== userId) {
          try {
            // Get the current user's name for the notification
            const { data: currentUserProfile, error: profileError } = await supabase
              .from('profiles')
              .select('username, full_name')
              .eq('id', currentUserId)
              .single();

            if (!profileError && currentUserProfile) {
              const kudosGiverName = currentUserProfile.full_name || currentUserProfile.username;
              
              console.log('🎯 Sending like notification:', {
                fromUserId: currentUserId,
                toUserId: userId,
                fromUserName: kudosGiverName,
                itemType: type,
                itemId: targetId
              });

              // Send push notification using our new system
              await createLikeNotification(
                currentUserId,    // Who liked it
                userId,          // Who owns the post (receives notification)
                kudosGiverName,  // Display name
                type,            // Type of item (run, workout, mental, pr)
                targetId         // ID of the item
              );
            }
          } catch (notificationError) {
            console.error('Error creating kudos push notification:', notificationError);
          }
        }
        setShowKudosFeedback(true);
        setTimeout(() => setShowKudosFeedback(false), 2500);
      }
    } catch (error) {
      console.error('Error toggling kudos:', error);
    }
  };

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

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        style,
        // Event cards: special neon blue border
        eventCardStyle,
        // Apply custom border color if provided (for workout posts) - only when not event
        !eventCardStyle && borderColor && {
          borderWidth: 3,
          borderColor: borderColor,
          shadowColor: borderColor,
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          elevation: 5,
        }
      ]}
      onPress={() => {
        // Event cards don't navigate to activity; join/leave are handled by buttons
        if (type === 'event') return;
        try {
          if (targetId) {
            router.push(`/activity/${targetId}`);
          } else {
            console.error('No target ID provided for navigation');
          }
        } catch (error) {
          console.error('Error navigating to activity:', error);
        }
      }}
      activeOpacity={0.9}
    >  
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

      <View style={styles.titleContainer}>
        <Ionicons name={getIcon()} size={24} color="#00ffff" style={styles.titleIcon} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {description ? (
        <Text style={styles.description}>{description}</Text>
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
                <Text style={styles.eventLocationText} numberOfLines={1}>{eventData.location}</Text>
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
      {/* Run Map Component - Only show if path has coordinates */}
      {type === 'run' && runData && showMapToOthers && mapRegion && parseRunPath(runData.path).length > 1 && (
        <View style={styles.mapContainer}>
          {mapLoading ? (
            <View style={styles.mapLoadingContainer}>
              <ActivityIndicator size="large" color="#00ffff" />
              <Text style={styles.mapLoadingText}>Loading route...</Text>
            </View>
          ) : (
            <View style={styles.interactiveMapContainer}>
              {mapRegion && (
                <MapView
                  style={styles.interactiveMap}
                  region={mapRegion}
                  provider={PROVIDER_GOOGLE}
                  showsUserLocation={false}
                  showsMyLocationButton={false}
                  showsCompass={true}
                  showsScale={true}
                  scrollEnabled={true}
                  zoomEnabled={true}
                  rotateEnabled={true}
                  pitchEnabled={true}
                >
                  {parseRunPath(runData.path).length > 1 && (
                    <Polyline
                      coordinates={parseRunPath(runData.path)}
                      strokeColor="#00ffff"
                      strokeWidth={4}
                      lineDashPattern={[1]}
                      zIndex={1}
                      lineCap="round"
                      lineJoin="round"
                      geodesic={true}
                    />
                  )}
                  {parseRunPath(runData.path).length > 0 && (
                    <>
                      <Marker
                        coordinate={parseRunPath(runData.path)[0]}
                        title="Start"
                      >
                        <View style={styles.startMarker} />
                      </Marker>
                      {parseRunPath(runData.path).length > 1 && (
                        <Marker
                          coordinate={parseRunPath(runData.path)[parseRunPath(runData.path).length - 1]}
                          title="End"
                        >
                          <View style={styles.endMarker} />
                        </Marker>
                      )}
                    </>
                  )}
                </MapView>
              )}
            </View>
          )}
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
      
      {table && targetColumn && (
        <View style={styles.actionsContainer}>
          {/* Top row: Kudos and Report buttons */}
          <View style={styles.topActionsRow}>
            <TouchableOpacity 
              style={[styles.kudosButton, hasKudoed && styles.kudosButtonActive]} 
              onPress={handleKudos}
              disabled={loading}
              accessibilityLabel={`Give kudos, ${kudosCount} ${kudosCount === 1 ? 'kudo' : 'kudos'}`}
              accessibilityRole="button"
            >
              <Ionicons 
                name={hasKudoed ? "heart" : "heart-outline"} 
                size={32}
                color={hasKudoed ? "#ff0055" : "#00ffff"} 
              />
              <Text style={[styles.kudosCount, hasKudoed && styles.kudosCountActive]}>
                {kudosCount}
              </Text>
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
              <Ionicons name="chatbubble-ellipses-outline" size={28} color="#00ffff" />
              <Text style={styles.commentsText}>{commentCount > 0 ? `(${commentCount})` : ''}</Text>
            </TouchableOpacity>
            {/* Report Button */}
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
          {kudosCount > 0 && kudosUsers.length > 0 && Object.keys(profileMap).length > 0 && (
            <View style={styles.kudosAvatarsRow}>
              {[...new Set(kudosUsers.map((k) => k.user_id))].slice(0, 3).map((uid) => {
                const profile = profileMap[uid];
                const avatarUrl = profile?.avatar_url;
                return (
                  <View key={uid} style={styles.kudosAvatarWrap}>
                    {avatarUrl ? (
                      <Image source={{ uri: avatarUrl }} style={styles.kudosAvatar} />
                    ) : (
                      <View style={[styles.kudosAvatar, styles.kudosAvatarPlaceholder]}>
                        <Text style={styles.kudosAvatarInitial}>
                          {(profile?.full_name || profile?.username || '?').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          {showKudosFeedback && (
            <Text style={styles.kudosFeedbackText}>You supported {name}!</Text>
          )}
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
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
    justifyContent: 'space-between', // Spread kudos and report across full width
    alignItems: 'center',
    marginBottom: 12, // Space between top and bottom rows
    width: '100%', // Take up full width
  },
  kudosFeedbackText: {
    color: 'rgba(0, 255, 255, 0.9)',
    fontSize: 13,
    marginTop: -4,
    marginBottom: 4,
  },
  kudosAvatarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  kudosAvatarWrap: {
    marginRight: -8,
  },
  kudosAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  kudosAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  kudosAvatarInitial: {
    color: '#00ffff',
    fontSize: 10,
    fontWeight: '600',
  },
  kudosButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
    paddingVertical: 6,
    paddingHorizontal: 12, // Reduced from 14 to 12
    borderRadius: 16,
    backgroundColor: 'rgba(0,255,255,0.04)',
    minWidth: 60, // Add minimum width for consistency
  },
  kudosButtonActive: {
    backgroundColor: 'rgba(255,0,85,0.04)',
  },
  kudosCount: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 6,
  },
  kudosCountActive: {
    color: '#00ffff',
  },
  highlightedStat: {
    color: '#00ffff',
  },
  commentsButton: {
   
    alignItems: 'center',
    justifyContent: 'center', // Center the content within the button
    paddingVertical: 8, // Slightly increased padding
    paddingHorizontal: 16, // Increased padding for better appearance
    borderRadius: 16,
    minHeight: 44,
    marginLeft: 10,
    backgroundColor: 'rgba(0,255,255,0.04)',  // Consistent height for better touch targets
  },
  commentsText: {
    color: '#00ffff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 6,
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