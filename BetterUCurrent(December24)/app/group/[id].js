import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Modal, FlatList, TextInput, SafeAreaView, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useUser } from '../../context/UserContext';
import { Ionicons } from '@expo/vector-icons';
import { PremiumAvatar } from '../components/PremiumAvatar';
import { GroupAvatar } from '../components/GroupAvatar';
import * as ImagePicker from 'expo-image-picker';
import { Haptics } from 'expo-haptics';


const { width, height } = Dimensions.get('window');

const GroupDetailScreen = () => {
 const { id } = useLocalSearchParams();
 const router = useRouter();
 const { userProfile } = useUser();
 const [group, setGroup] = useState(null);
 const [members, setMembers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [isMember, setIsMember] = useState(false);
 const [userRole, setUserRole] = useState(null);
 const [showInviteModal, setShowInviteModal] = useState(false);
 const [friends, setFriends] = useState([]);
 const [inviting, setInviting] = useState({});
 const [joinRequests, setJoinRequests] = useState([]);
 const [loadingRequests, setLoadingRequests] = useState(true);
 const [hasPendingRequest, setHasPendingRequest] = useState(false);
 const [invitations, setInvitations] = useState([]);
 const [pendingInvitations, setPendingInvitations] = useState([]);
 const [outgoingInvitations, setOutgoingInvitations] = useState([]);
 const [groupActivities, setGroupActivities] = useState([]);
 const [loadingActivities, setLoadingActivities] = useState(false);
 const [activityCounts, setActivityCounts] = useState({
   workouts: 0,
   mentalSessions: 0,
   runs: 0
 });

 // Post creation state variables
 const [postText, setPostText] = useState('');
 const [postUrl, setPostUrl] = useState(null);
 const [uploading, setUploading] = useState(false);
 const [selectedImage, setSelectedImage] = useState(null);

 // Challenge creation state variables
 const [showCreateChallengeModal, setShowCreateChallengeModal] = useState(false);
 const [challengeForm, setChallengeForm] = useState({
   name: '',
   description: '',
   challengeType: 'workout', // 'workout', 'mental', 'run', 'custom'
   startDate: new Date().toISOString().split('T')[0],
   endDate: '',
   goal: '',
   unit: 'count' // 'count', 'minutes', 'miles', 'km'
 });
 const [creatingChallenge, setCreatingChallenge] = useState(false);
 const [challenges, setChallenges] = useState([]);

 // Group events state variables
 const [groupEvents, setGroupEvents] = useState([]);
 const [loadingEvents, setLoadingEvents] = useState(false);
 const [showCreateEventModal, setShowCreateEventModal] = useState(false);
 const [eventTitle, setEventTitle] = useState('');
 const [eventDescription, setEventDescription] = useState('');
 const [eventDate, setEventDate] = useState('');
 const [eventTime, setEventTime] = useState('');
 const [creatingEvent, setCreatingEvent] = useState(false);

 // Animation state variables
 const fadeAnim = useRef(new Animated.Value(0)).current;
 const slideAnim = useRef(new Animated.Value(50)).current;
 const scaleAnim = useRef(new Animated.Value(0.9)).current;

 useEffect(() => {
   fetchGroupDetails();
   // Initialize animations
   Animated.parallel([
     Animated.timing(fadeAnim, {
       toValue: 1,
       duration: 800,
       useNativeDriver: true,
     }),
     Animated.timing(slideAnim, {
       toValue: 0,
       duration: 800,
       useNativeDriver: true,
     }),
     Animated.timing(scaleAnim, {
       toValue: 1,
       duration: 800,
       useNativeDriver: true,
     })
   ]).start();
 },
 [id]);

 const fetchGroupDetails = async () => {
   try {
     // Fetch group details
     const { data: groupData, error: groupError } = await supabase
       .from('groups')
       .select('*')
       .eq('id', id)
       .single();


     if (groupError) throw groupError;
     setGroup(groupData);


     // First fetch members
     const { data: memberData, error: memberError } = await supabase
       .from('group_members')
       .select('*')
       .eq('group_id', id);


     if (memberError) throw memberError;


     // Then fetch user profiles for all members
     const userIds = memberData?.map(member => member.user_id) || [];
     const { data: userData, error: userError } = await supabase
       .from('profiles')
       .select('id, username, avatar_url, full_name')
       .in('id', userIds);


     if (userError) throw userError;


     // Combine member data with user profiles
     const profileById = new Map(
       (userData || []).map(user => [user.id, user])
     );
     const defaultProfile = (userId) => ({
       id: userId,
       username: 'Unknown user',
       avatar_url: null,
       full_name: null
     });
     const membersWithProfiles = memberData?.map(member => ({
       ...member,
       profiles: profileById.get(member.user_id) || defaultProfile(member.user_id)
     })) || [];

     setMembers(membersWithProfiles);

    // Fetch activity counts after we have the member IDs
    const [workouts, mentalSessions, runs] = await Promise.all([
      supabase
        .from('user_workout_logs')
        .select('id', { count: 'exact' })
        .in('user_id', userIds),
      supabase
        .from('mental_session_logs')
        .select('id', { count: 'exact' })
        .in('profile_id', userIds),
       supabase
         .from('runs')
         .select('id', { count: 'exact' })
         .in('user_id', userIds)
     ]);



     setActivityCounts({
       workouts: workouts.count || 0,
       mentalSessions: mentalSessions.count || 0,
       runs: runs.count || 0
     });


     // Check if current user is a member or owner
     const currentUserMember = membersWithProfiles.find(m => m.user_id === userProfile?.id);
     const isOwner = groupData.created_by === userProfile?.id;
    
     // Set membership status - user is a member if they are either a member or the owner
     setIsMember(!!currentUserMember || isOwner);
     setUserRole(currentUserMember?.role || (isOwner ? 'owner' : null));


     // Check for pending join request
     await checkPendingRequest();


     // If user is owner, fetch join requests
     if (groupData.created_by === userProfile?.id) {
       await fetchJoinRequests();
     }


    // Fetch pending invitations
    await fetchPendingInvitations();

    // Fetch group events if user is a member
    if (!!currentUserMember || isOwner) {
      await fetchGroupEvents();
    }
  } catch (error) {
    console.error('Error fetching group details:', error);
  } finally {
    setLoading(false);
  }
};


 const handleJoinGroup = async () => {
   try {
     // Add haptic feedback
     try {
       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
     } catch (error) {
       console.log('Haptics not available:', error);
     }

     // Check if there's already a pending request
     if (hasPendingRequest) {
       Alert.alert('Already Requested', 'You have already requested to join this group.');
       return;
     }


     if (group.is_public) {
       // For public groups, join directly
     const { error } = await supabase
       .from('group_members')
       .insert({
         group_id: id,
         user_id: userProfile.id,
         role: 'member'
       });


     if (error) throw error;
     setIsMember(true);
     setUserRole('member');
     fetchGroupDetails(); // Refresh members list
       Alert.alert('Success', 'Joined group successfully!');
       
       // Success haptic feedback
       try {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
       } catch (error) {
         console.log('Haptics not available:', error);
       }
     } else {
       // For private groups, create a join request
       const { data, error } = await supabase
         .from('join_requests')
         .insert({
           group_id: id,
           user_id: userProfile.id,
           status: 'pending'
         })
         .select()
         .single();


       if (error) throw error;
       setHasPendingRequest(true);
       Alert.alert('Success', 'Join request sent! The group owner will review your request.');
       
       // Success haptic feedback
       try {
         Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
       } catch (error) {
         console.log('Haptics not available:', error);
       }
     }
   } catch (error) {
     console.error('Error joining group:', error);
     Alert.alert('Error', 'Failed to join group. Please try again.');
     
     // Error haptic feedback
     try {
       Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
     } catch (error) {
       console.log('Haptics not available:', error);
     }
   }
 };


 const handleLeaveGroup = async () => {
   try {
     const { error } = await supabase
       .from('group_members')
       .delete()
       .eq('group_id', id)
       .eq('user_id', userProfile.id);


     if (error) throw error;
     setIsMember(false);
     setUserRole(null);
     fetchGroupDetails(); // Refresh members list
   } catch (error) {
     console.error('Error leaving group:', error);
   }
 };


 const handleDeleteGroup = async () => {
   try {
     // Confirm deletion
     Alert.alert(
       'Delete Group',
       'Are you sure you want to delete this group? This action cannot be undone.',
       [
         {
           text: 'Cancel',
           style: 'cancel'
         },
         {
           text: 'Delete',
           style: 'destructive',
           onPress: async () => {
             const { error } = await supabase
               .from('groups')
               .delete()
               .eq('id', id)
               .eq('created_by', userProfile.id);


             if (error) {
               console.error('Error deleting group:', error);
               Alert.alert('Error', 'Failed to delete group. Please try again.');
               return;
             }


             // Navigate back and refresh the groups list
             router.push({
               pathname: '/(tabs)/community',
               params: { refresh: true }
             });
           }
         }
       ]
     );
   } catch (error) {
     console.error('Error in delete group:', error);
     Alert.alert('Error', 'An unexpected error occurred. Please try again.');
   }
 };


 // Add function to fetch friends
 const fetchFriends = async () => {
   try {
     // First get all accepted friendships
     const { data: accepted, error: acceptedError } = await supabase
       .from('friends')
       .select(`
         *,
         friend:friend_id (
           id,
           username,
           avatar_url,
           full_name
         ),
         user:user_id (
           id,
           username,
           avatar_url,
           full_name
         )
       `)
       .or(`user_id.eq.${userProfile.id},friend_id.eq.${userProfile.id}`)
       .eq('status', 'accepted');


     if (acceptedError) throw acceptedError;
     console.log('Accepted friendships with profiles:', accepted);


     // Extract friend profiles and remove duplicates using a Map to ensure uniqueness by ID
     const friendMap = new Map();
     accepted.forEach(f => {
       const friend = f.user_id === userProfile.id ? f.friend : f.user;
       if (friend && !friendMap.has(friend.id)) {
         friendMap.set(friend.id, friend);
       }
     });
     const friendProfiles = Array.from(friendMap.values());


     console.log('Friend profiles:', friendProfiles);


     if (friendProfiles.length > 0) {
       // Get current group members
       const { data: currentMembers, error: membersError } = await supabase
         .from('group_members')
         .select('user_id')
         .eq('group_id', id);


       if (membersError) throw membersError;
       console.log('Current members:', currentMembers);


       // Get pending invitations
       const { data: pendingInvitations, error: invitationsError } = await supabase
         .from('group_invitations')
         .select('invited_user_id')
         .eq('group_id', id)
         .eq('status', 'pending');


       if (invitationsError) throw invitationsError;
       console.log('Pending invitations:', pendingInvitations);


       const memberIds = new Set(currentMembers.map(m => m.user_id));
       const invitedIds = new Set(pendingInvitations.map(i => i.invited_user_id));


       console.log('Member IDs:', Array.from(memberIds));
       console.log('Invited IDs:', Array.from(invitedIds));


       // Filter out friends who are already members or have pending invitations
       const availableFriends = friendProfiles.filter(
         friend => !memberIds.has(friend.id) && !invitedIds.has(friend.id)
       );


       console.log('Available friends:', availableFriends);
       setFriends(availableFriends);
     } else {
       setFriends([]);
     }
   } catch (error) {
     console.error('Error fetching friends:', error);
     Alert.alert('Error', 'Failed to fetch friends. Please try again.');
   }
 };


 // Add function to handle inviting friends
 const handleInviteFriend = async (friendId) => {
   try {
     setInviting(prev => ({ ...prev, [friendId]: true }));


     // First check if there's already a pending invitation
     const { data: existingInvitation, error: checkError } = await supabase
       .from('group_invitations')
       .select('*')
       .eq('group_id', id)
       .eq('invited_user_id', friendId)
       .eq('status', 'pending')
       .single();


     if (checkError && checkError.code !== 'PGRST116') throw checkError;


     if (existingInvitation) {
       Alert.alert('Already Invited', 'This user has already been invited to the group.');
       return;
     }


     const { error } = await supabase
       .from('group_invitations')
       .insert({
         group_id: id,
         invited_user_id: friendId,
         invited_by_id: userProfile.id,
         status: 'pending'
       });


     if (error) throw error;


     // Update both friends list and outgoing invitations
     await Promise.all([
       fetchFriends(),
       fetchOutgoingInvitations()
     ]);
    
     Alert.alert('Success', 'Invitation sent successfully!');
   } catch (error) {
     console.error('Error inviting friend:', error);
     Alert.alert('Error', 'Failed to send invitation. Please try again.');
   } finally {
     setInviting(prev => ({ ...prev, [friendId]: false }));
   }
 };


 // Update useEffect to fetch friends when invite modal is shown
 useEffect(() => {
   if (showInviteModal) {
     fetchFriends();
   }
 }, [showInviteModal]);


 // Add function to fetch join requests
 const fetchJoinRequests = async () => {
   try {
     setLoadingRequests(true);
     console.log('Fetching join requests for group:', id);
    
     // First get the join requests
     const { data: requests, error: requestsError } = await supabase
       .from('join_requests')
       .select('*')
       .eq('group_id', id)
       .eq('status', 'pending');


     if (requestsError) {
       console.error('Error fetching requests:', requestsError);
       throw requestsError;
     }


     console.log('Fetched join requests:', requests);


     if (!requests || requests.length === 0) {
       setJoinRequests([]);
       return;
     }


     // Then get the user profiles for these requests
     const userIds = requests.map(request => request.user_id);
     const { data: profiles, error: profilesError } = await supabase
       .from('profiles')
       .select('id, username, avatar_url, full_name')
       .in('id', userIds);


     if (profilesError) {
       console.error('Error fetching profiles:', profilesError);
       throw profilesError;
     }


     console.log('Fetched profiles:', profiles);


     // Combine the data
     const requestsWithProfiles = requests.map(request => ({
       ...request,
       profiles: profiles.find(profile => profile.id === request.user_id)
     }));


     console.log('Combined requests with profiles:', requestsWithProfiles);
     setJoinRequests(requestsWithProfiles);
   } catch (error) {
     console.error('Error in fetchJoinRequests:', error);
     setJoinRequests([]);
   } finally {
     setLoadingRequests(false);
   }
 };


 // Add this function to handle profile navigation
 const handleProfilePress = (userId) => {
   router.push(`/profile/${userId}`);
 };


 // Add function to check if user has pending request
 const checkPendingRequest = async () => {
   try {
     const { data, error } = await supabase
       .from('join_requests')
       .select('*')
       .eq('group_id', id)
       .eq('user_id', userProfile.id)
       .eq('status', 'pending')
       .single();


     if (error && error.code !== 'PGRST116') throw error;
     setHasPendingRequest(!!data);
   } catch (error) {
     console.error('Error checking pending request:', error);
   }
 };


 // Add function to handle join request
 const handleJoinRequest = async (requestId, accept) => {
   try {
     if (accept) {
       // Get the request details
       const { data: request, error: requestError } = await supabase
         .from('join_requests')
         .select('*')
         .eq('id', requestId)
         .single();


       if (requestError) throw requestError;


       // Add user to group members
       const { error: memberError } = await supabase
         .from('group_members')
         .insert({
           group_id: request.group_id,
           user_id: request.user_id,
           role: 'member'
         });


       if (memberError) throw memberError;


       // Update request status to accepted
       const { error: updateError } = await supabase
         .from('join_requests')
         .update({ status: 'accepted' })
         .eq('id', requestId);


       if (updateError) throw updateError;
     } else {
       // Delete the request if denied
       const { error: deleteError } = await supabase
         .from('join_requests')
         .delete()
         .eq('id', requestId);


       if (deleteError) throw deleteError;
     }


     // Refresh requests
     fetchJoinRequests();
     // Refresh members if accepted
     if (accept) {
       fetchGroupDetails();
     }
   } catch (error) {
     console.error('Error handling join request:', error);
     Alert.alert('Error', 'Failed to process request. Please try again.');
   }
 };


 // Add these functions after the existing functions
 const handlePromoteMember = async (memberId) => {
   try {
     // Confirm promotion
     Alert.alert(
       'Promote Member',
       'Are you sure you want to promote this member to admin?',
       [
         {
           text: 'Cancel',
           style: 'cancel'
         },
         {
           text: 'Promote',
           style: 'default',
           onPress: async () => {
             // First check if the user is the group owner
             if (!isOwner) {
               Alert.alert('Error', 'Only group owners can promote members.');
               return;
             }


             // First verify the current role
             const { data: currentMember, error: fetchError } = await supabase
               .from('group_members')
               .select('role')
               .eq('group_id', id)
               .eq('user_id', memberId)
               .single();


             if (fetchError) {
               console.error('Error fetching member:', fetchError);
               throw fetchError;
             }


             if (currentMember.role === 'admin') {
               Alert.alert('Error', 'Member is already an admin.');
               return;
             }


             const { error } = await supabase
               .from('group_members')
               .update({ role: 'admin' })
               .eq('group_id', id)
               .eq('user_id', memberId);


             if (error) {
               console.error('Error promoting member:', error);
               throw error;
             }


             // Refresh members list
             await fetchGroupDetails();
             Alert.alert('Success', 'Member promoted to admin successfully!');
           }
         }
       ]
     );
   } catch (error) {
     console.error('Error promoting member:', error);
     Alert.alert('Error', 'Failed to promote member. Please try again.');
   }
 };


 const handleKickMember = async (memberId) => {
   try {
     // Confirm kick
     Alert.alert(
       'Remove Member',
       'Are you sure you want to remove this member from the group?',
       [
         {
           text: 'Cancel',
           style: 'cancel'
         },
         {
           text: 'Remove',
           style: 'destructive',
           onPress: async () => {
             const { error } = await supabase
               .from('group_members')
               .delete()
               .eq('group_id', id)
               .eq('user_id', memberId);


             if (error) throw error;


             // Refresh members list
             fetchGroupDetails();
             Alert.alert('Success', 'Member removed successfully!');
           }
         }
       ]
     );
   } catch (error) {
     console.error('Error removing member:', error);
     Alert.alert('Error', 'Failed to remove member. Please try again.');
   }
 };


 // Add this function to fetch invitations
 const fetchInvitations = async () => {
   try {
     const { data, error } = await supabase
       .from('group_invitations')
       .select(`
         *,
         group:group_id (
           id,
           name,
           avatar_url
         ),
         inviter:invited_by_id (
           id,
           username,
           avatar_url,
           full_name
         )
       `)
       .eq('invited_user_id', userProfile.id)
       .eq('status', 'pending');


     if (error) throw error;
     setInvitations(data || []);
   } catch (error) {
     console.error('Error fetching invitations:', error);
   }
 };


 // Update useEffect to fetch invitations
 useEffect(() => {
   fetchGroupDetails();
   fetchInvitations();
 }, [id]);


 // Add function to handle invitation response
 const handleInvitationResponse = async (invitationId, accept) => {
   try {
     if (accept) {
       // Get the invitation details
       const { data: invitation, error: invitationError } = await supabase
         .from('group_invitations')
         .select('*')
         .eq('id', invitationId)
         .single();


       if (invitationError) throw invitationError;


       // Add user to group members
       const { error: memberError } = await supabase
         .from('group_members')
         .insert({
           group_id: invitation.group_id,
           user_id: userProfile.id,
           role: 'member'
         });


       if (memberError) throw memberError;
     }


     // Update invitation status
     const { error: updateError } = await supabase
       .from('group_invitations')
       .update({ status: accept ? 'accepted' : 'rejected' })
       .eq('id', invitationId);


     if (updateError) throw updateError;


     // Refresh data
     fetchInvitations();
     if (accept) {
       fetchGroupDetails();
     }
   } catch (error) {
     console.error('Error handling invitation:', error);
     Alert.alert('Error', 'Failed to process invitation. Please try again.');
   }
 };


 // Add function to handle demoting admin
 const handleDemoteAdmin = async (memberId) => {
   try {
     // Confirm demotion
     Alert.alert(
       'Demote Admin',
       'Are you sure you want to demote this admin to member?',
       [
         {
           text: 'Cancel',
           style: 'cancel'
         },
         {
           text: 'Demote',
           style: 'default',
           onPress: async () => {
             // First check if the user is the group owner
             if (!isOwner) {
               Alert.alert('Error', 'Only group owners can demote admins.');
               return;
             }


             // First verify the current role
             const { data: currentMember, error: fetchError } = await supabase
               .from('group_members')
               .select('role')
               .eq('group_id', id)
               .eq('user_id', memberId)
               .single();


             if (fetchError) {
               console.error('Error fetching member:', fetchError);
               throw fetchError;
             }


             if (currentMember.role !== 'admin') {
               Alert.alert('Error', 'Member is not an admin.');
               return;
             }


             const { error } = await supabase
               .from('group_members')
               .update({ role: 'member' })
               .eq('group_id', id)
               .eq('user_id', memberId);


             if (error) {
               console.error('Error demoting admin:', error);
               throw error;
             }


             // Refresh members list
             await fetchGroupDetails();
             Alert.alert('Success', 'Admin demoted to member successfully!');
           }
         }
       ]
     );
   } catch (error) {
     console.error('Error demoting admin:', error);
     Alert.alert('Error', 'Failed to demote admin. Please try again.');
   }
 };


 // Add function to cancel invitation
 const handleCancelInvitation = async (invitationId) => {
   try {
     console.log('Cancelling invitation:', invitationId);
    
     const { error } = await supabase
       .from('group_invitations')
       .delete()
       .eq('id', invitationId);


     if (error) {
       console.error('Error deleting invitation:', error);
       throw error;
     }


     // Update the outgoingInvitations state directly
     setOutgoingInvitations(prev => prev.filter(inv => inv.id !== invitationId));
    
     // Refresh the friends list
     await fetchFriends();
    
     Alert.alert('Success', 'Invitation cancelled successfully!');
   } catch (error) {
     console.error('Error cancelling invitation:', error);
     Alert.alert('Error', 'Failed to cancel invitation. Please try again.');
   }
 };


 // Add function to fetch pending invitations
 const fetchPendingInvitations = async () => {
   try {
     const { data, error } = await supabase
       .from('group_invitations')
       .select(`
         *,
         group:group_id (
           id,
           name,
           avatar_url
         ),
         inviter:invited_by_id (
           id,
           username,
           avatar_url,
           full_name
         )
       `)
       .eq('invited_user_id', userProfile.id)
       .eq('status', 'pending');


     if (error) throw error;
     setPendingInvitations(data || []);
   } catch (error) {
     console.error('Error fetching pending invitations:', error);
   }
 };


 // Add this function after fetchPendingInvitations
 const fetchOutgoingInvitations = async () => {
   try {
     console.log('Fetching outgoing invitations for group:', id);
     console.log('Current user ID:', userProfile.id);
    
     const { data, error } = await supabase
       .from('group_invitations')
       .select(`
         *,
         invited_user:invited_user_id (
           id,
           username,
           avatar_url,
           full_name
         )
       `)
       .eq('group_id', id)
       .eq('invited_by_id', userProfile.id)
       .eq('status', 'pending');


     if (error) {
       console.error('Error in fetchOutgoingInvitations:', error);
       throw error;
     }


     console.log('Fetched outgoing invitations:', data);
     setOutgoingInvitations(data || []);
   } catch (error) {
     console.error('Error fetching outgoing invitations:', error);
   }
 };


 // Update useEffect to fetch outgoing invitations when modal opens
 useEffect(() => {
   if (showInviteModal) {
     console.log('Modal opened, fetching data...');
     fetchFriends();
     fetchOutgoingInvitations();
   }
 }, [showInviteModal]);

// Function to handle photo selection from gallery
const handlePhotoSelection = async () => {
  try {
    // Check current permission status first
    const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    
    let finalStatus = currentStatus;
    
    // If permission is not granted, request it
    if (currentStatus !== 'granted') {
      const { status: requestedStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      finalStatus = requestedStatus;
    }
    
    // If still not granted, show alert with settings option
    if (finalStatus !== 'granted') {
      Alert.alert(
        'Permission Required', 
        'Please allow access to your photos to upload images. You can enable this in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => ImagePicker.requestMediaLibraryPermissionsAsync() }
        ]
      );
      return;
    }
    
    // Launch image picker with specific options
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Only allow images, not videos
      allowsEditing: true, // Allow user to crop/edit the image
      aspect: [4, 3], // Set aspect ratio for editing
      quality: 0.8, // Compress image to 80% quality for faster upload
    });

    // Check if user canceled or if no image was selected
    if (result.canceled || !result.assets || !result.assets[0]?.uri) {
      return; // User canceled, do nothing
    }

    // Store the selected image URI for preview
    setSelectedImage(result.assets[0].uri);
  } catch (error) {
    console.error('Error selecting photo:', error);
    Alert.alert('Error', 'Failed to select photo. Please try again.');
  }
};

// Function to upload photo to Cloudinary
const uploadPhotoToCloudinary = async (imageUri) => {
  try {
    setUploading(true);
    
    // Create FormData object for file upload
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri, // The local URI of the selected image
      type: 'image/jpeg', // Specify file type
      name: 'post.jpg', // Give it a name
    });
    formData.append('upload_preset', 'profilepics'); // Cloudinary upload preset

    // Upload to Cloudinary
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
    
    return data.secure_url; // Return the uploaded image URL
  } catch (error) {
    console.error('Error uploading photo:', error);
    Alert.alert('Upload Failed', 'Failed to upload photo. Please try again.');
    throw error; // Re-throw so calling function knows upload failed
  } finally {
    setUploading(false);
  }
};

// Function to create a group post
const createGroupPost = async (text, imageUrl = null) => {
  try {
    // Insert the post into the group_posts table
    const { data, error } = await supabase
      .from('group_posts')
      .insert([
        {
          group_id: id,
          user_id: userProfile.id,
          content: text,
          image_url: imageUrl,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Refresh the group activities to show the new post
    fetchGroupActivities();
    
    // Clear the form
    setPostText('');
    setPostUrl(null);
    setSelectedImage(null);
    
    Alert.alert('Success', 'Post shared successfully!');
  } catch (error) {
    console.error('Error creating post:', error);
    Alert.alert('Error', 'Failed to create post. Please try again.');
  }
};

// Main function to handle post upload (text + optional photo)
const handlePostUpload = async () => {
  // Check if there's text or an image to post
  if (!postText.trim() && !selectedImage) {
    Alert.alert('Empty Post', 'Please add some text or select a photo to share.');
    return;
  }

  try {
    let imageUrl = null;
    
    // If user selected an image, upload it first
    if (selectedImage) {
      imageUrl = await uploadPhotoToCloudinary(selectedImage);
    }

    // Create the post with text and optional image
    await createGroupPost(postText.trim(), imageUrl);
    
  } catch (error) {
    console.error('Error in post upload process:', error);
    // Error messages are already handled in the individual functions
  }
};

// Fetch only events shared to this group (from group_events table)
const fetchGroupEvents = async () => {
  try {
    setLoadingEvents(true);

    const today = new Date().toISOString().split('T')[0];

    const { data: events, error } = await supabase
      .from('group_events')
      .select(`
        *,
        group_event_attendees(
          user_id,
          profiles!group_event_attendees_user_id_fkey(
            id,
            username,
            avatar_url,
            full_name
          )
        )
      `)
      .eq('group_id', id)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });

    if (error) throw error;

    const processedEvents = (events || []).map((event) => {
      const attendees = event.group_event_attendees || [];
      const attendeeProfiles = (attendees
        .map((a) => a.profiles)
        .filter(Boolean)
        .slice(0, 3)) || [];
      return {
        ...event,
        attendees: attendees.map((a) => ({ user_id: a.user_id })),
        attendeeCount: attendees.length,
        attendeeProfiles,
      };
    });

    setGroupEvents(processedEvents);
  } catch (error) {
    console.error('Error fetching group events:', error);
    setGroupEvents([]);
  } finally {
    setLoadingEvents(false);
  }
};

// Add function to create group event
const createGroupEvent = async () => {
  try {
    if (!eventTitle.trim() || !eventDate || !eventTime) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setCreatingEvent(true);

    const { data, error } = await supabase
      .from('group_events')
      .insert({
        group_id: id,
        title: eventTitle.trim(),
        description: eventDescription.trim() || null,
        event_date: eventDate,
        event_time: eventTime,
        created_by: userProfile.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as attendee
    await supabase
      .from('group_event_attendees')
      .insert({
        event_id: data.id,
        user_id: userProfile.id,
      });

    // Refresh events
    await fetchGroupEvents();

    // Reset form and close modal
    setEventTitle('');
    setEventDescription('');
    setEventDate('');
    setEventTime('');
    setShowCreateEventModal(false);

    Alert.alert('Success', 'Event created successfully!');
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.log('Haptics not available');
    }
  } catch (error) {
    console.error('Error creating event:', error);
    Alert.alert('Error', 'Failed to create event. Please try again.');
  } finally {
    setCreatingEvent(false);
  }
};

// Add function to toggle event attendance
const toggleEventAttendance = async (eventId, isAttending) => {
  try {
    if (isAttending) {
      // Remove attendance
      const { error } = await supabase
        .from('group_event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userProfile.id);

      if (error) throw error;
    } else {
      // Add attendance
      const { error } = await supabase
        .from('group_event_attendees')
        .insert({
          event_id: eventId,
          user_id: userProfile.id,
        });

      if (error) throw error;
    }

    // Refresh events
    await fetchGroupEvents();

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.log('Haptics not available');
    }
  } catch (error) {
    console.error('Error toggling attendance:', error);
    Alert.alert('Error', 'Failed to update attendance. Please try again.');
  }
};

// Add function to fetch group activities
 const fetchGroupActivities = async () => {
   try {
     setLoadingActivities(true);
     
     // Get all member IDs
     const memberIds = members.map(member => member.user_id);
     
     console.log('Fetching activities for member IDs:', memberIds);
     
     if (memberIds.length === 0) {
       console.log('No members found, setting empty activities');
       setGroupActivities([]);
       return;
     }

    // Fetch recent activities from all members
    const [workouts, mentalSessions, runs] = await Promise.all([
      supabase
        .from('user_workout_logs')
        .select(`
          id,
          user_id,
          workout_name,
          duration,
          completed_at,
          created_at
        `)
        .in('user_id', memberIds)
        .order('completed_at', { ascending: false })
        .limit(5),
      supabase
        .from('mental_session_logs')
        .select(`
          id,
          profile_id,
          session_name,
          session_type,
          duration,
          completed_at,
          created_at
        `)
        .in('profile_id', memberIds)
        .order('completed_at', { ascending: false })
        .limit(5),
       supabase
         .from('runs')
         .select(`
           id,
           user_id,
           distance,
           duration,
           pace,
           created_at
         `)
         .in('user_id', memberIds)
         .order('created_at', { ascending: false })
         .limit(5)
     ]);

     // Fetch user profiles separately
     const { data: profiles } = await supabase
       .from('profiles')
       .select('id, username, full_name, avatar_url')
       .in('id', memberIds);

    // Debug: Log the raw data
    console.log('Workouts data:', workouts.data);
    console.log('Mental sessions data:', mentalSessions.data);
    console.log('Runs data:', runs.data);
    console.log('Profiles data:', profiles);
    
    // Check for errors
    if (workouts.error) {
      console.error('Error fetching workouts:', workouts.error);
    }
    if (mentalSessions.error) {
      console.error('Error fetching mental sessions:', mentalSessions.error);
    }
    if (runs.error) {
      console.error('Error fetching runs:', runs.error);
    }

     // Helper function to find user profile
     const findUserProfile = (userId) => {
       return profiles?.find(profile => profile.id === userId) || {
         id: userId,
         username: 'Unknown User',
         full_name: 'Unknown User',
         avatar_url: null
       };
     };

     // Combine and sort all activities by creation date
     const allActivities = [
       ...(workouts.data || []).map(workout => ({
         ...workout,
         type: 'workout',
         displayName: workout.workout_name,
         subtitle: `${workout.duration} min • Completed`,
         user: findUserProfile(workout.user_id),
         created_at: workout.completed_at || workout.created_at
       })),
       ...(mentalSessions.data || []).map(session => ({
         ...session,
         type: 'mental',
         displayName: session.session_name || session.session_type,
         subtitle: `${session.duration} min • ${session.session_type}`,
         user: findUserProfile(session.profile_id),
         created_at: session.completed_at || session.created_at
       })),
       ...(runs.data || []).map(run => ({
         ...run,
         type: 'run',
         displayName: `${(run.distance / 1000).toFixed(1)}km Run`,
         subtitle: `${run.duration} min • ${run.pace} pace`,
         user: findUserProfile(run.user_id)
       }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 20); // Show top 20 most recent activities

     console.log('Combined activities:', allActivities);
     setGroupActivities(allActivities);
   } catch (error) {
     console.error('Error fetching group activities:', error);
   } finally {
     setLoadingActivities(false);
   }
 };
// Function to fetch challenges
const fetchChallenges = async () => {
  try {
    const { data, error } = await supabase
      .from('group_challenges')
      .select(`
        *,
        created_by:profiles!group_challenges_created_by_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `)
      .eq('group_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setChallenges(data || []);
  } catch (error) {
    console.error('Error fetching challenges:', error);
  }
};

// Complete createChallenge function with validation and error handling
const createChallenge = async () => {
  try {
    // Validation checks
    if (!userProfile?.id) {
      Alert.alert('Error', 'Please log in to create a challenge');
      return;
    }

    if (!challengeForm.name || challengeForm.name.trim().length < 3) {
      Alert.alert('Error', 'Challenge name must be at least 3 characters long');
      return;
    }

    if (!challengeForm.description || challengeForm.description.trim().length < 10) {
      Alert.alert('Error', 'Challenge description must be at least 10 characters long');
      return;
    }

    if (!challengeForm.startDate) {
      Alert.alert('Error', 'Please select a start date');
      return;
    }

    if (!challengeForm.endDate) {
      Alert.alert('Error', 'Please select an end date');
      return;
    }

    // Check if end date is after start date
    if (new Date(challengeForm.endDate) <= new Date(challengeForm.startDate)) {
      Alert.alert('Error', 'End date must be after start date');
      return;
    }

    if (!challengeForm.goal || isNaN(Number(challengeForm.goal)) || Number(challengeForm.goal) <= 0) {
      Alert.alert('Error', 'Please enter a valid goal number');
      return;
    }

    // Check if user is a member/admin/owner of the group
    const userMembership = members.find(m => m.user_id === userProfile.id);
    if (!userMembership) {
      Alert.alert('Error', 'You must be a member of this group to create challenges');
      return;
    }

    setCreatingChallenge(true);

    // Create the challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('group_challenges')
      .insert({
        group_id: id,
        name: challengeForm.name.trim(),
        description: challengeForm.description.trim(),
        challenge_type: challengeForm.challengeType,
        start_date: challengeForm.startDate,
        end_date: challengeForm.endDate,
        goal: Number(challengeForm.goal),
        unit: challengeForm.unit,
        created_by: userProfile.id,
        status: 'active'
      })
      .select()
      .single();

    if (challengeError) {
      console.error('Challenge creation error:', challengeError);
      throw challengeError;
    }

    // Success - close modal and reset form
    setShowCreateChallengeModal(false);
    setChallengeForm({
      name: '',
      description: '',
      challengeType: 'workout',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      goal: '',
      unit: 'count'
    });

    // Refresh challenges list
    await fetchChallenges();

    // Show success message
    Alert.alert('Success', 'Challenge created successfully!', [
      {
        text: 'OK',
        onPress: () => {
          try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch (e) {
            console.log('Haptics not available');
          }
        }
      }
    ]);

  } catch (error) {
    console.error('Error creating challenge:', error);
    Alert.alert(
      'Error', 
      error.message || 'Failed to create challenge. Please try again.'
    );
  } finally {
    setCreatingChallenge(false);
  }
};


 // Update useEffect to fetch activities when members change
 useEffect(() => {
   if (members.length > 0) {
     fetchGroupActivities();
   }
 }, [members]);

 // Also fetch activities when group loads
 useEffect(() => {
   if (group && members.length > 0) {
     fetchGroupActivities();
   }
 }, [group, members]);

 // Fetch challenges when group loads and user is a member
 useEffect(() => {
   if (id && isMember) {
     fetchChallenges();
   }
 }, [id, isMember]);


 if (loading) {
   return (
     <View style={styles.loadingContainer}>
       <ActivityIndicator size="large" color="#00ffff" />
     </View>
   );
 }


 if (!group) {
   return (
     <View style={styles.errorContainer}>
       <Text style={styles.errorText}>Group not found</Text>
     </View>
   );
 }


 const isOwner = group.created_by === userProfile?.id;


 // Sort members by role (owner first, then admins, then members)
 const sortedMembers = [...members].sort((a, b) => {
   const roleOrder = { owner: 0, admin: 1, member: 2 };
   return roleOrder[a.role] - roleOrder[b.role];
 });


 const renderJoinRequests = () => {
   if (!isOwner) return null;


   return (
     <View style={styles.section}>
       <Text style={styles.sectionTitle}>Join Requests</Text>
       {loadingRequests ? (
         <ActivityIndicator color="#00ffff" style={{ marginTop: 16 }} />
       ) : joinRequests.length === 0 ? (
         <Text style={styles.emptyText}>No pending join requests</Text>
       ) : (
         joinRequests.map((request) => (
           <View key={request.id} style={styles.requestCard}>
             <TouchableOpacity
               onPress={() => handleProfilePress(request.user_id)}
               style={styles.requestAvatarContainer}
             >
               <Image
                 source={{ uri: request.profiles?.avatar_url || 'https://placehold.co/50x50' }}
                 style={styles.requestAvatar}
               />
             </TouchableOpacity>
             <View style={styles.requestInfo}>
               <TouchableOpacity onPress={() => handleProfilePress(request.user_id)}>
                 <Text style={styles.requestName}>
                   {request.profiles?.full_name || request.profiles?.username}
                 </Text>
               </TouchableOpacity>
               <Text style={styles.requestDate}>
                 {new Date(request.created_at).toLocaleDateString()}
               </Text>
             </View>
             <View style={styles.requestActions}>
               <TouchableOpacity
                 style={[styles.requestButton, styles.acceptButton]}
                 onPress={() => handleJoinRequest(request.id, true)}
               >
                 <Text style={styles.acceptButtonText}>Accept</Text>
               </TouchableOpacity>
               <TouchableOpacity
                 style={[styles.requestButton, styles.rejectButton]}
                 onPress={() => handleJoinRequest(request.id, false)}
               >
                 <Text style={styles.rejectButtonText}>Decline</Text>
               </TouchableOpacity>
             </View>
           </View>
         ))
       )}
     </View>
   );
 };


 const renderMember = (member) => (
   <Animated.View 
     key={member.id} 
     style={[
       styles.memberCard,
       {
         opacity: fadeAnim,
         transform: [{ translateY: slideAnim }]
       }
     ]}
   >
     <LinearGradient
       colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
       style={styles.memberCardGradient}
     >
       <View style={styles.memberCardContent}>
         <TouchableOpacity
           onPress={() => {
             try {
               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
             } catch (error) {
               console.log('Haptics not available:', error);
             }
             handleProfilePress(member.user_id);
           }}
           style={styles.memberAvatarContainer}
         >
           <PremiumAvatar
             userId={member.user_id}
             source={member.profiles?.avatar_url ? { uri: member.profiles.avatar_url } : null}
             size={52}
             style={styles.memberAvatar}
             isPremium={member.profiles?.is_premium}
             username={member.profiles?.username}
             fullName={member.profiles?.full_name}
           />
         </TouchableOpacity>
         
         <View style={styles.memberInfo}>
           <TouchableOpacity onPress={() => handleProfilePress(member.user_id)}>
             <Text style={styles.memberName} numberOfLines={1}>
               {member.profiles?.full_name || member.profiles?.username || 'Unknown User'}
             </Text>
           </TouchableOpacity>
           <View style={[
             styles.memberRoleContainer,
             member.role === 'owner' && styles.ownerRoleContainer,
             member.role === 'admin' && styles.adminRoleContainer
           ]}>
             <Text style={[
               styles.memberRole,
               member.role === 'owner' && styles.ownerRole,
               member.role === 'admin' && styles.adminRole
             ]}>
               {member.role === 'owner' ? '👑 Owner' : 
                member.role === 'admin' ? '⭐ Admin' : 
                '👤 Member'}
             </Text>
           </View>
         </View>
         
         {isOwner && member.user_id !== userProfile.id && (
           <View style={styles.memberActions}>
             {member.role === 'member' && (
               <TouchableOpacity
                 style={[styles.memberActionButton, styles.promoteButton]}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   handlePromoteMember(member.user_id);
                 }}
               >
                 <LinearGradient
                   colors={['#00ffff', '#00cccc']}
                   style={styles.actionButtonGradient}
                 >
                   <Ionicons name="arrow-up" size={16} color="#000" />
                 </LinearGradient>
               </TouchableOpacity>
             )}
             {member.role === 'admin' && (
               <TouchableOpacity
                 style={[styles.memberActionButton, styles.demoteButton]}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   handleDemoteAdmin(member.user_id);
                 }}
               >
                 <LinearGradient
                   colors={['#00ffff', '#00cccc']}
                   style={styles.actionButtonGradient}
                 >
                   <Ionicons name="arrow-down" size={16} color="#000" />
                 </LinearGradient>
               </TouchableOpacity>
             )}
             <TouchableOpacity
               style={[styles.memberActionButton, styles.kickButton]}
               onPress={() => {
                 try {
                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                 } catch (error) {
                   console.log('Haptics not available:', error);
                 }
                 handleKickMember(member.user_id);
               }}
             >
               <LinearGradient
                 colors={['#ff4444', '#cc0000']}
                 style={styles.actionButtonGradient}
               >
                 <Ionicons name="close" size={16} color="#fff" />
               </LinearGradient>
             </TouchableOpacity>
           </View>
         )}
       </View>
     </LinearGradient>
   </Animated.View>
 );


 return (
   <View style={styles.container}>
     {/* Enhanced Hero Section with Gradient Overlay */}
     {group?.avatar_url ? (
       <Animated.View 
         style={[
           styles.heroSection,
           {
             opacity: fadeAnim,
             transform: [{ scale: scaleAnim }]
           }
         ]}
       >
         <Image
           source={{ uri: group.avatar_url }}
           style={styles.bannerImage}
         />
         <LinearGradient
           colors={['rgba(0, 0, 0, 0.3)', 'rgba(0, 0, 0, 0.7)', 'rgba(0, 0, 0, 0.9)']}
           style={styles.heroGradient}
         />
         <View style={styles.heroOverlay}>
         </View>
       </Animated.View>
     ) : (
         <Animated.View 
           style={[
             styles.headerWithoutBanner,
             {
               opacity: fadeAnim,
               transform: [{ translateY: slideAnim }]
             }
           ]}
         >
         </Animated.View>
       )}

      {/* Back Button positioned above SafeAreaView but within safe area */}
      <TouchableOpacity
        style={styles.backButtonAbove}
        onPress={() => {
          try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          } catch (error) {
            console.log('Haptics not available:', error);
          }
          router.back();
          if (router.canGoBack()) {
            router.push({
              pathname: '/(tabs)/community',
              params: { refresh: true }
            });
          }
        }}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      <SafeAreaView style={styles.safeAreaContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
           {/* Enhanced Group Info Card */}
       <Animated.View 
         style={[
           styles.groupInfoCard,
           {
             opacity: fadeAnim,
             transform: [{ translateY: slideAnim }]
           }
         ]}
       >
         <LinearGradient
           colors={['rgba(0, 255, 255, 0.08)', 'rgba(0, 255, 255, 0.02)']}
           style={styles.groupInfoGradient}
         >
           <View style={styles.avatarContainer}>
             <View style={styles.avatarWrapper}>
               <GroupAvatar
                 groupName={group?.name}
                 size={90}
                 source={group?.avatar_url ? { uri: group.avatar_url } : null}
                 style={styles.groupAvatar}
               />
               <LinearGradient
                 colors={['#00ffff', '#00cccc']}
                 style={styles.avatarGlow}
               />
             </View>
             <View style={styles.groupBadge}>
               <LinearGradient
                 colors={['rgba(0, 255, 255, 0.2)', 'rgba(0, 255, 255, 0.1)']}
                 style={styles.badgeGradient}
               >
                 <Ionicons
                   name={group?.is_public ? 'globe' : 'lock-closed'}
                   size={16}
                   color="#00ffff"
                 />
                 <Text style={styles.badgeText}>
                   {group?.is_public ? 'Public' : 'Private'}
                 </Text>
               </LinearGradient>
             </View>
           </View>
           
           <Text style={styles.groupName}>{group?.name}</Text>
           <Text style={styles.groupDescription}>{group?.description || 'No description available'}</Text>
           
           {/* Enhanced Activity Stats */}
           <View style={styles.activityStats}>
             <View style={styles.statCard}>
               <LinearGradient
                 colors={['rgba(0, 255, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
                 style={styles.statCardGradient}
               >
                 <Ionicons name="barbell-outline" size={24} color="#00ffff" />
                 <Text style={styles.statValue}>{activityCounts.workouts}</Text>
                 <Text style={styles.statLabel}>Workouts</Text>
               </LinearGradient>
             </View>
             <View style={styles.statCard}>
               <LinearGradient
                 colors={['rgba(0, 255, 153, 0.1)', 'rgba(0, 255, 153, 0.05)']}
                 style={styles.statCardGradient}
               >
                 <Ionicons name="leaf-outline" size={24} color="#00ff99" />
                 <Text style={styles.statValue}>{activityCounts.mentalSessions}</Text>
                 <Text style={styles.statLabel}>Mental</Text>
               </LinearGradient>
             </View>
             <View style={styles.statCard}>
               <LinearGradient
                 colors={['rgba(0, 255, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
                 style={styles.statCardGradient}
               >
                 <Ionicons name="fitness-outline" size={24} color="#00ffff" />
                 <Text style={styles.statValue}>{activityCounts.runs}</Text>
                 <Text style={styles.statLabel}>Runs</Text>
               </LinearGradient>
             </View>
             <View style={styles.statCard}>
               <LinearGradient
                 colors={['rgba(0, 255, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
                 style={styles.statCardGradient}
               >
                 <Ionicons name="people" size={24} color="#00ffff" />
                 <Text style={styles.statValue}>{members.length}</Text>
                 <Text style={styles.statLabel}>Members</Text>
               </LinearGradient>
             </View>
           </View>
         </LinearGradient>
       </Animated.View>

       {/* Enhanced Action Buttons Section */}
       <Animated.View 
         style={[
           styles.actionSection,
           {
             opacity: fadeAnim,
             transform: [{ translateY: slideAnim }]
           }
         ]}
       >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionButtonScrollView}
        >
          {/* Activities Action */}
          <View style={styles.actionViewItem}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                try {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                } catch (error) {
                  console.log('Haptics not available:', error);
                }
                router.push({
                  pathname: `/group/${id}/feed`,
                  params: { name: group?.name }
                });
              }}
            >
              <Ionicons name="newspaper" size={28} color="#00ffff" />
            </TouchableOpacity>
            <Text style={styles.actionButtonText}>Activities</Text>
          </View>
          
          {/* Leaderboard Action */}
           <View style={styles.actionViewItem}>
             <TouchableOpacity
               style={styles.actionButton}
               onPress={() => {
                 try {
                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                 } catch (error) {
                   console.log('Haptics not available:', error);
                 }
                 router.push({
                   pathname: `/group/${id}/leaderboard`,
                   params: { name: group?.name }
                 });
               }}
             >
               <Ionicons name="trophy" size={28} color="#00ffff" />
             </TouchableOpacity>
             <Text style={styles.actionButtonText}>Leaderboard</Text>
           </View>

           {/* Create Challenge Action */}
           {isMember && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.actionButton}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   setShowCreateChallengeModal(true);
                 }}
               >
                 <Ionicons name="flag" size={28} color="#00ffff" />
               </TouchableOpacity>
               <Text style={styles.actionButtonText}>Challenge</Text>
             </View>
           )}

           {/* Create Event Action */}
           {isMember && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.actionButton}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   setShowCreateEventModal(true);
                 }}
               >
                 <Ionicons name="calendar" size={28} color="#00ffff" />
               </TouchableOpacity>
               <Text style={styles.actionButtonText}>Event</Text>
             </View>
           )}
           
           {/* Invite Friends Action */}
           {isMember && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.actionButton}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   setShowInviteModal(true);
                 }}
               >
                 <Ionicons name="person-add" size={28} color="#00ffff" />
               </TouchableOpacity>
               <Text style={styles.actionButtonText}>Invite</Text>
             </View>
           )}
           
           {/* Settings Action (for owners) */}
           {isOwner && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.actionButton}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   Alert.alert('Settings', 'Group settings coming soon!');
                 }}
               >
                 <Ionicons name="settings" size={28} color="#00ffff" />
               </TouchableOpacity>
               <Text style={styles.actionButtonText}>Settings</Text>
             </View>
           )}
           
           {/* Delete Group Action (for owners) */}
           {isOwner && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.dangerActionButton}
                 onPress={handleDeleteGroup}
               >
                 <Ionicons name="trash" size={28} color="#ff4444" />
               </TouchableOpacity>
               <Text style={styles.dangerActionButtonText}>Delete</Text>
             </View>
           )}
           
           {/* Leave Group Action (for members) */}
           {isMember && !isOwner && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.dangerActionButton}
                 onPress={handleLeaveGroup}
               >
                 <Ionicons name="exit-outline" size={28} color="#ff4444" />
               </TouchableOpacity>
               <Text style={styles.dangerActionButtonText}>Leave</Text>
             </View>
           )}
           
           {/* Join Group Action (for non-members) */}
           {!isMember && (
             <View style={styles.actionViewItem}>
               <TouchableOpacity
                 style={styles.actionButton}
                 onPress={handleJoinGroup}
               >
                 <Ionicons 
                   name={group?.is_public ? "add-circle" : "mail-outline"}
                   size={28} 
                   color={group?.is_public ? "#00ffff" : "rgba(0, 255, 255, 0.7)"} 
                 />
               </TouchableOpacity>
               <Text style={styles.actionButtonText}>
                 {group?.is_public ? 'Join' : 'Request'}
               </Text>
             </View>
           )}
         </ScrollView>
       </Animated.View>

       {/* Upcoming Events Section */}
       {isMember && (
         <View style={styles.section}>
           <View style={styles.eventsHeader}>
             <Text style={styles.sectionTitle}>Upcoming Events</Text>
             <TouchableOpacity
               style={styles.createEventButton}
               onPress={() => {
                 try {
                   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                 } catch (error) {
                   console.log('Haptics not available:', error);
                 }
                 setShowCreateEventModal(true);
               }}
             >
               <LinearGradient
                 colors={['#00ffff', '#00cccc']}
                 style={styles.createEventButtonGradient}
               >
                 <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                 <Text style={styles.createEventButtonText}>Create Event</Text>
               </LinearGradient>
             </TouchableOpacity>
           </View>
           {loadingEvents ? (
             <ActivityIndicator size="small" color="#00ffff" style={{ marginTop: 16 }} />
           ) : groupEvents.length === 0 ? (
             <Text style={styles.emptyText}>No upcoming events</Text>
           ) : (
             <FlatList
               horizontal
               showsHorizontalScrollIndicator={false}
               data={groupEvents}
               keyExtractor={(item) => item.id}
               renderItem={({ item: event }) => (
                 <Animated.View
                   style={[
                     styles.groupEventCard,
                     {
                       opacity: fadeAnim,
                       transform: [{ translateY: slideAnim }],
                     },
                   ]}
                 >
                   <LinearGradient
                     colors={['rgba(0, 255, 255, 0.08)', 'rgba(0, 255, 255, 0.02)']}
                     style={styles.groupEventCardGradient}
                   >
                     <View style={styles.eventDateBox}>
                       <Text style={styles.eventMonthText}>
                         {new Date(event.event_date).toLocaleString('en-US', { month: 'short' })}
                       </Text>
                       <Text style={styles.eventDayText}>
                         {new Date(event.event_date).getDate()}
                       </Text>
                       <Text style={styles.eventDayOfWeekText}>
                         {new Date(event.event_date).toLocaleString('en-US', { weekday: 'short' })}
                       </Text>
                     </View>
                     <View style={styles.eventContent}>
                       <Text style={styles.eventTitleText} numberOfLines={1}>
                         {event.title}
                       </Text>
                       <View style={styles.eventTimeContainer}>
                         <Ionicons name="time-outline" size={14} color="#888" />
                         <Text style={styles.eventTimeText}>{event.event_time}</Text>
                       </View>
                       <Text style={styles.eventDescriptionText} numberOfLines={2}>
                         {event.description || 'No description'}
                       </Text>
                       <View style={styles.eventAttendeesContainer}>
                         {(event.attendeeProfiles || []).map((attendee, index) => (
                           <View
                             key={attendee.id}
                             style={[
                               styles.eventAttendeeAvatar,
                               { marginLeft: index > 0 ? -8 : 0 },
                             ]}
                           >
                             <Image
                               source={{
                                 uri: attendee.avatar_url || 'https://placehold.co/40x40/666/fff?text=?',
                               }}
                               style={styles.eventAttendeeAvatarImage}
                             />
                           </View>
                         ))}
                         {event.attendeeCount > 3 && (
                           <View
                             style={[
                               styles.eventAttendeeAvatar,
                               styles.eventAttendeeCount,
                               { marginLeft: -8 },
                             ]}
                           >
                             <Text style={styles.eventAttendeeCountText}>
                               +{event.attendeeCount - 3}
                             </Text>
                           </View>
                         )}
                       </View>
                     </View>
                     <TouchableOpacity
                       style={styles.eventJoinButton}
                       onPress={() => {
                         const isAttending = event.attendees?.some(
                           (a) => a.user_id === userProfile.id
                         );
                         toggleEventAttendance(event.id, isAttending);
                       }}
                     >
                       <LinearGradient
                         colors={
                           event.attendees?.some((a) => a.user_id === userProfile.id)
                             ? ['rgba(255, 68, 68, 0.2)', 'rgba(255, 68, 68, 0.1)']
                             : ['#00ffff', '#00cccc']
                         }
                         style={styles.eventJoinButtonGradient}
                       >
                         <Ionicons
                           name={
                             event.attendees?.some((a) => a.user_id === userProfile.id)
                               ? 'checkmark'
                               : 'add'
                           }
                           size={16}
                           color="#fff"
                           style={{ marginRight: 6 }}
                         />
                         <Text style={styles.eventJoinButtonText}>
                           {event.attendees?.some((a) => a.user_id === userProfile.id)
                             ? 'Attending'
                             : 'Join Event'}
                         </Text>
                       </LinearGradient>
                     </TouchableOpacity>
                   </LinearGradient>
                 </Animated.View>
               )}
               contentContainerStyle={styles.eventsList}
             />
           )}
         </View>
       )}

       {/* Join Requests Section */}
       {renderJoinRequests()}

       {/* Members Section */}
       <View style={styles.section}>
         <Text style={styles.sectionTitle}>Members ({members.length})</Text>
         <View style={styles.membersGrid}>
           {members
             .sort((a, b) => {
               // Define role hierarchy: owner > admin > member
               const roleOrder = { owner: 0, admin: 1, member: 2 };
               const aOrder = roleOrder[a.role] ?? 3;
               const bOrder = roleOrder[b.role] ?? 3;
               return aOrder - bOrder;
             })
             .map((member) => renderMember(member))}
         </View>
       </View>

       {/* Group Feed Section - Enhanced with Real Activities */}
       <View style={styles.section}>
        <View style={styles.feedSectionHeader}>
          <Text style={styles.sectionTitle}>Group Activity</Text>
        </View>
        
        {/* Enhanced Post Creation Container */}
        <Animated.View 
          style={[
            styles.postContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(0, 255, 255, 0.08)', 'rgba(0, 255, 255, 0.02)']}
            style={styles.postContainerGradient}
          >
            {/* Image Preview */}
            {selectedImage && (
              <Animated.View 
                style={[
                  styles.imagePreviewContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: scaleAnim }]
                  }
                ]}
              >
                <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => {
                    try {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    } catch (error) {
                      console.log('Haptics not available:', error);
                    }
                    setSelectedImage(null);
                  }}
                >
                  <LinearGradient
                    colors={['rgba(255, 68, 68, 0.8)', 'rgba(255, 68, 68, 0.6)']}
                    style={styles.removeImageButtonGradient}
                  >
                    <Ionicons name="close-circle" size={26} color="#fff" />
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
            
            {/* Text Input and Action Buttons */}
            <View style={styles.inputRow}>
              <TextInput
                style={styles.postInput}
                placeholder="Share your thoughts with the group..."
                placeholderTextColor="#666"
                value={postText}
                onChangeText={setPostText}
                multiline
                maxLength={500}
              />
              
              {/* Photo Selection Button */}
              <TouchableOpacity 
                style={[
                  styles.photoButton,
                  selectedImage && styles.photoButtonActive
                ]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch (error) {
                    console.log('Haptics not available:', error);
                  }
                  handlePhotoSelection();
                }}
                disabled={uploading}
              >
                <LinearGradient
                  colors={selectedImage ? 
                    ['rgba(0, 255, 255, 0.2)', 'rgba(0, 255, 255, 0.1)'] :
                    ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']
                  }
                  style={styles.photoButtonGradient}
                >
                  <Ionicons 
                    name="images-outline" 
                    size={22} 
                    color={selectedImage ? "#00ffff" : "#00cccc"} 
                  />
                </LinearGradient>
              </TouchableOpacity>
              
              {/* Post Upload Button */}
              <TouchableOpacity 
                style={[
                  styles.postButton,
                  (!postText.trim() && !selectedImage) && styles.postButtonDisabled
                ]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  } catch (error) {
                    console.log('Haptics not available:', error);
                  }
                  handlePostUpload();
                }}
                disabled={uploading || (!postText.trim() && !selectedImage)}
              >
                <LinearGradient
                  colors={(!postText.trim() && !selectedImage) ? 
                    ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'] :
                    ['#00ffff', '#00cccc']
                  }
                  style={styles.postButtonGradient}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="arrow-up" size={22} color="#fff" />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
         
         {/* Real Group Activities */}
         {loadingActivities ? (
           <View style={styles.loadingActivities}>
             <ActivityIndicator size="small" color="#00ffff" />
             <Text style={styles.loadingText}>Loading activities...</Text>
           </View>
         ) : groupActivities.length === 0 ? (
           <Animated.View 
             style={[
               styles.noActivities,
               {
                 opacity: fadeAnim,
                 transform: [{ scale: scaleAnim }]
               }
             ]}
           >
             <LinearGradient
               colors={['rgba(0, 255, 255, 0.1)', 'rgba(0, 255, 255, 0.05)']}
               style={styles.noActivitiesGradient}
             >
               <View style={styles.noActivitiesIconContainer}>
                 <LinearGradient
                   colors={['#00ffff', '#00cccc']}
                   style={styles.noActivitiesIconGradient}
                 >
                   <Ionicons name="fitness-outline" size={48} color="#fff" />
                 </LinearGradient>
               </View>
               <Text style={styles.noActivitiesText}>No activities yet</Text>
               <Text style={styles.noActivitiesSubtext}>Be the first to share your workout!</Text>
               <TouchableOpacity 
                 style={styles.startActivityButton}
                 onPress={() => {
                   try {
                     Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                   } catch (error) {
                     console.log('Haptics not available:', error);
                   }
                   // Navigate to workout creation or activity feed
                 }}
               >
                 <LinearGradient
                   colors={['#00ffff', '#00cccc']}
                   style={styles.startActivityButtonGradient}
                 >
                   <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                   <Text style={styles.startActivityButtonText}>Start Activity</Text>
                 </LinearGradient>
               </TouchableOpacity>
             </LinearGradient>
           </Animated.View>
         ) : (
           <View style={styles.activitiesList}>
             {groupActivities.map((activity, index) => (
               <Animated.View 
                 key={`${activity.type}-${activity.id}`} 
                 style={[
                   styles.activityCard,
                   {
                     opacity: fadeAnim,
                     transform: [
                       { translateY: slideAnim },
                       { scale: scaleAnim }
                     ]
                   }
                 ]}
               >
                 <LinearGradient
                   colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
                   style={styles.activityCardGradient}
                 >
                   <View style={styles.activityHeader}>
                     <View style={styles.activityUser}>
                       <View style={styles.activityAvatarContainer}>
                         <Image
                           source={
                             activity.user?.avatar_url 
                               ? { uri: activity.user.avatar_url }
                               : { uri: 'https://placehold.co/72x72/666/fff?text=?' }
                           }
                           style={styles.activityAvatar}
                         />
                         <LinearGradient
                           colors={[
                             activity.type === 'workout' ? ['#00ffff', '#00cccc'] :
                             activity.type === 'mental' ? ['#00ff99', '#00cc7a'] :
                             ['#00ffff', '#00cccc']
                           ]}
                           style={styles.activityAvatarGlow}
                         />
                       </View>
                       <View style={styles.activityUserInfo}>
                         <Text style={styles.activityUsername}>
                           {activity.user?.full_name || activity.user?.username || 'Unknown User'}
                         </Text>
                         <Text style={styles.activityTime}>
                           {new Date(activity.created_at).toLocaleDateString('en-US', {
                             month: 'short',
                             day: 'numeric',
                             hour: '2-digit',
                             minute: '2-digit'
                           })}
                         </Text>
                       </View>
                     </View>
                     <View style={[
                       styles.activityTypeIcon,
                       activity.type === 'workout' && styles.workoutTypeIcon,
                       activity.type === 'mental' && styles.mentalTypeIcon,
                       activity.type === 'run' && styles.runTypeIcon
                     ]}>
                       <LinearGradient
                         colors={[
                           activity.type === 'workout' ? ['rgba(0, 255, 255, 0.2)', 'rgba(0, 255, 255, 0.1)'] :
                           activity.type === 'mental' ? ['rgba(0, 255, 153, 0.2)', 'rgba(0, 255, 153, 0.1)'] :
                           ['rgba(0, 255, 255, 0.2)', 'rgba(0, 255, 255, 0.1)']
                         ]}
                         style={styles.activityTypeGradient}
                       >
                         <Ionicons 
                           name={
                             activity.type === 'workout' ? 'barbell' :
                             activity.type === 'mental' ? 'leaf' :
                             'fitness'
                           } 
                           size={20} 
                           color={
                             activity.type === 'workout' ? '#00ffff' :
                             activity.type === 'mental' ? '#00ff99' :
                             '#00ffff'
                           } 
                         />
                       </LinearGradient>
                     </View>
                   </View>
                   
                   <View style={styles.activityContent}>
                     <Text style={styles.activityTitle}>{activity.displayName}</Text>
                     <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                   </View>
                 </LinearGradient>
               </Animated.View>
             ))}
           </View>
         )}
        </View>

       {/* Invitations Section */}
       {invitations.length > 0 && (
         <View style={styles.section}>
           <Text style={styles.sectionTitle}>Group Invitations</Text>
           {invitations.map((invitation) => (
             <View key={invitation.id} style={styles.invitationCard}>
               <GroupAvatar
                 groupName={invitation.group?.name}
                 size={50}
                 source={invitation.group?.avatar_url ? { uri: invitation.group.avatar_url } : null}
                 style={styles.invitationAvatar}
               />
               <View style={styles.invitationInfo}>
                 <Text style={styles.invitationName}>
                   {invitation.group?.name}
                 </Text>
                 <Text style={styles.invitationInviter}>
                   Invited by {invitation.inviter?.full_name || invitation.inviter?.username}
                 </Text>
               </View>
               <View style={styles.invitationActions}>
                 <TouchableOpacity
                   style={styles.acceptButton}
                   onPress={() => handleInvitationResponse(invitation.id, true)}
                 >
                   <Text style={styles.acceptButtonText}>Accept</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   style={styles.rejectButton}
                   onPress={() => handleInvitationResponse(invitation.id, false)}
                 >
                   <Text style={styles.rejectButtonText}>Decline</Text>
                 </TouchableOpacity>
               </View>
             </View>
           ))}
         </View>
       )}

       {/* Enhanced Invite Modal */}
       {showInviteModal && (
         <Modal
           visible={showInviteModal}
           animationType="slide"
           transparent={true}
           onRequestClose={() => setShowInviteModal(false)}
         >
           <View style={styles.modalOverlay}>
             <Animated.View 
               style={[
                 styles.modalContent,
                 {
                   opacity: fadeAnim,
                   transform: [{ scale: scaleAnim }]
                 }
               ]}
             >
               <LinearGradient
                 colors={['rgba(0, 255, 255, 0.08)', 'rgba(0, 255, 255, 0.02)']}
                 style={styles.modalGradient}
               >
                 <View style={styles.modalHeader}>
                   <View style={styles.modalTitleContainer}>
                     <LinearGradient
                       colors={['#00ffff', '#00cccc']}
                       style={styles.modalTitleIcon}
                     >
                       <Ionicons name="person-add" size={24} color="#fff" />
                     </LinearGradient>
                     <Text style={styles.modalTitle}>Invite Friends</Text>
                   </View>
                   <TouchableOpacity
                     onPress={() => {
                       try {
                         Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                       } catch (error) {
                         console.log('Haptics not available:', error);
                       }
                       setShowInviteModal(false);
                     }}
                     style={styles.closeButton}
                   >
                     <LinearGradient
                       colors={['rgba(255, 68, 68, 0.2)', 'rgba(255, 68, 68, 0.1)']}
                       style={styles.closeButtonGradient}
                     >
                       <Ionicons name="close" size={24} color="#ff4444" />
                     </LinearGradient>
                   </TouchableOpacity>
                 </View>
                 
                 <FlatList
                   data={friends}
                   keyExtractor={(item) => item.id}
                   renderItem={({ item }) => (
                     <Animated.View 
                       style={[
                         styles.friendCard,
                         {
                           opacity: fadeAnim,
                           transform: [{ translateY: slideAnim }]
                         }
                       ]}
                     >
                       <LinearGradient
                         colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.02)']}
                         style={styles.friendCardGradient}
                       >
                         <PremiumAvatar
                           userId={item.id}
                           source={item.avatar_url ? { uri: item.avatar_url } : null}
                           size={50}
                           username={item.username}
                           fullName={item.full_name}
                         />
                         <View style={styles.friendInfo}>
                           <Text style={styles.friendName}>
                             {item.full_name || item.username}
                           </Text>
                           <Text style={styles.friendSubtext}>Tap to invite</Text>
                         </View>
                         <TouchableOpacity
                           style={[
                             styles.inviteButton,
                             inviting[item.id] && styles.invitingButton
                           ]}
                           onPress={() => {
                             try {
                               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                             } catch (error) {
                               console.log('Haptics not available:', error);
                             }
                             handleInviteFriend(item.id);
                           }}
                           disabled={inviting[item.id]}
                         >
                           <LinearGradient
                             colors={inviting[item.id] ? 
                               ['rgba(102, 102, 102, 0.2)', 'rgba(102, 102, 102, 0.1)'] :
                               ['#00ffff', '#00cccc']
                             }
                             style={styles.inviteButtonGradient}
                           >
                             {inviting[item.id] ? (
                               <ActivityIndicator size="small" color="#fff" />
                             ) : (
                               <>
                                 <Ionicons name="add-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                                 <Text style={styles.inviteButtonText}>Invite</Text>
                               </>
                             )}
                           </LinearGradient>
                         </TouchableOpacity>
                       </LinearGradient>
                     </Animated.View>
                   )}
                   contentContainerStyle={styles.friendsList}
                 />
               </LinearGradient>
             </Animated.View>
           </View>
         </Modal>
       )}

       {/* Create Challenge Modal */}
       <Modal
         visible={showCreateChallengeModal}
         transparent={true}
         animationType="slide"
         onRequestClose={() => setShowCreateChallengeModal(false)}
       >
         <View style={styles.modalOverlay}>
           <Animated.View 
             style={[
               styles.modalContent,
               {
                 opacity: fadeAnim,
                 transform: [{ scale: scaleAnim }]
               }
             ]}
           >
             <LinearGradient
               colors={['rgba(0, 255, 255, 0.08)', 'rgba(0, 255, 255, 0.02)']}
               style={styles.modalGradient}
             >
               <View style={styles.modalHeader}>
                 <View style={styles.modalTitleContainer}>
                   <LinearGradient
                     colors={['#00ffff', '#00cccc']}
                     style={styles.modalTitleIcon}
                   >
                     <Ionicons name="flag" size={24} color="#fff" />
                   </LinearGradient>
                   <Text style={styles.modalTitle}>Create Group Challenge</Text>
                 </View>
                 <TouchableOpacity
                   onPress={() => {
                     try {
                       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                     } catch (error) {
                       console.log('Haptics not available:', error);
                     }
                     setShowCreateChallengeModal(false);
                   }}
                   style={styles.closeButton}
                 >
                   <LinearGradient
                    colors={['rgba(255, 68, 68, 0.2)', 'rgba(255, 68, 68, 0.1)']}
                    style={styles.closeButtonGradient}
                  >
                    <Ionicons name="close" size={24} color="#ff4444" />
                   </LinearGradient>
                 </TouchableOpacity>
               </View>

               <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                 {/* Challenge Name */}
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Challenge Name *</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="e.g., 30-Day Workout Challenge"
                     placeholderTextColor="#666"
                     value={challengeForm.name}
                     onChangeText={(text) => setChallengeForm({ ...challengeForm, name: text })}
                     maxLength={100}
                   />
                 </View>

                 {/* Description */}
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Description *</Text>
                   <TextInput
                     style={[styles.input, styles.textArea]}
                     placeholder="Describe the challenge and its goals..."
                     placeholderTextColor="#666"
                     value={challengeForm.description}
                     onChangeText={(text) => setChallengeForm({ ...challengeForm, description: text })}
                     multiline
                     numberOfLines={4}
                     maxLength={500}
                   />
                 </View>

                 {/* Challenge Type */}
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Challenge Type *</Text>
                   <View style={styles.typeSelector}>
                     {['workout', 'mental', 'run', 'custom'].map((type) => (
                       <TouchableOpacity
                         key={type}
                         style={[
                           styles.typeButton,
                           challengeForm.challengeType === type && styles.typeButtonActive
                         ]}
                         onPress={() => {
                           try {
                             Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                           } catch (e) {
                             console.log('Haptics not available');
                           }
                           setChallengeForm({ ...challengeForm, challengeType: type });
                         }}
                       >
                         <Text style={[
                           styles.typeButtonText,
                           challengeForm.challengeType === type && styles.typeButtonTextActive
                         ]}>
                           {type.charAt(0).toUpperCase() + type.slice(1)}
                         </Text>
                       </TouchableOpacity>
                     ))}
                   </View>
                 </View>

                 {/* Start Date */}
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Start Date *</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="YYYY-MM-DD"
                     placeholderTextColor="#666"
                     value={challengeForm.startDate}
                     onChangeText={(text) => setChallengeForm({ ...challengeForm, startDate: text })}
                   />
                 </View>

                 {/* End Date */}
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>End Date *</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="YYYY-MM-DD"
                     placeholderTextColor="#666"
                     value={challengeForm.endDate}
                     onChangeText={(text) => setChallengeForm({ ...challengeForm, endDate: text })}
                   />
                 </View>

                 {/* Goal */}
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Goal *</Text>
                   <View style={styles.goalInputContainer}>
                     <TextInput
                       style={[styles.input, styles.goalInput]}
                       placeholder="100"
                       placeholderTextColor="#666"
                       value={challengeForm.goal}
                       onChangeText={(text) => setChallengeForm({ ...challengeForm, goal: text })}
                       keyboardType="numeric"
                     />
                     <View style={styles.unitSelector}>
                       {['count', 'minutes', 'miles', 'km'].map((unit) => (
                         <TouchableOpacity
                           key={unit}
                           style={[
                             styles.unitButton,
                             challengeForm.unit === unit && styles.unitButtonActive
                           ]}
                           onPress={() => {
                             try {
                               Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                             } catch (e) {
                               console.log('Haptics not available');
                             }
                             setChallengeForm({ ...challengeForm, unit: unit });
                           }}
                         >
                           <Text style={[
                             styles.unitButtonText,
                             challengeForm.unit === unit && styles.unitButtonTextActive
                           ]}>
                             {unit}
                           </Text>
                         </TouchableOpacity>
                       ))}
                     </View>
                   </View>
                 </View>
               </ScrollView>

               {/* Submit Button */}
               <TouchableOpacity
                 style={[styles.submitButton, creatingChallenge && styles.submitButtonDisabled]}
                 onPress={createChallenge}
                 disabled={creatingChallenge}
               >
                 <LinearGradient
                   colors={['#00ffff', '#00cccc']}
                   style={styles.submitButtonGradient}
                 >
                   {creatingChallenge ? (
                     <ActivityIndicator size="small" color="#fff" />
                   ) : (
                     <>
                       <Ionicons name="trophy" size={20} color="#fff" style={{ marginRight: 8 }} />
                       <Text style={styles.submitButtonText}>Create Challenge</Text>
                     </>
                   )}
                 </LinearGradient>
               </TouchableOpacity>
             </LinearGradient>
           </Animated.View>
         </View>
       </Modal>

       {/* Create Event Modal */}
       <Modal
         visible={showCreateEventModal}
         transparent={true}
         animationType="slide"
         onRequestClose={() => setShowCreateEventModal(false)}
       >
         <View style={styles.modalOverlay}>
           <Animated.View 
             style={[
               styles.modalContent,
               {
                 opacity: fadeAnim,
                 transform: [{ scale: scaleAnim }]
               }
             ]}
           >
             <LinearGradient
               colors={['rgba(0, 255, 255, 0.08)', 'rgba(0, 255, 255, 0.02)']}
               style={styles.modalGradient}
             >
               <View style={styles.modalHeader}>
                 <View style={styles.modalTitleContainer}>
                   <LinearGradient
                     colors={['#00ffff', '#00cccc']}
                     style={styles.modalTitleIcon}
                   >
                     <Ionicons name="calendar" size={24} color="#fff" />
                   </LinearGradient>
                   <Text style={styles.modalTitle}>Create Event</Text>
                 </View>
                 <TouchableOpacity
                   onPress={() => {
                     try {
                       Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                     } catch (error) {
                       console.log('Haptics not available:', error);
                     }
                     setShowCreateEventModal(false);
                   }}
                   style={styles.closeButton}
                 >
                   <LinearGradient
                    colors={['rgba(255, 68, 68, 0.2)', 'rgba(255, 68, 68, 0.1)']}
                    style={styles.closeButtonGradient}
                  >
                    <Ionicons name="close" size={24} color="#ff4444" />
                   </LinearGradient>
                 </TouchableOpacity>
               </View>

               <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Event Title *</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="e.g., Group Workout Session"
                     placeholderTextColor="#666"
                     value={eventTitle}
                     onChangeText={setEventTitle}
                     maxLength={100}
                   />
                 </View>

                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Description</Text>
                   <TextInput
                     style={[styles.input, styles.textArea]}
                     placeholder="Add event details..."
                     placeholderTextColor="#666"
                     value={eventDescription}
                     onChangeText={setEventDescription}
                     multiline
                     numberOfLines={4}
                     maxLength={500}
                   />
                 </View>

                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Date *</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="YYYY-MM-DD"
                     placeholderTextColor="#666"
                     value={eventDate}
                     onChangeText={setEventDate}
                   />
                 </View>

                 <View style={styles.formGroup}>
                   <Text style={styles.label}>Time *</Text>
                   <TextInput
                     style={styles.input}
                     placeholder="HH:MM (e.g., 18:00)"
                     placeholderTextColor="#666"
                     value={eventTime}
                     onChangeText={setEventTime}
                   />
                 </View>
               </ScrollView>

               <TouchableOpacity
                 style={[styles.submitButton, creatingEvent && styles.submitButtonDisabled]}
                 onPress={createGroupEvent}
                 disabled={creatingEvent}
               >
                 <LinearGradient
                   colors={['#00ffff', '#00cccc']}
                   style={styles.submitButtonGradient}
                 >
                   {creatingEvent ? (
                     <ActivityIndicator size="small" color="#fff" />
                   ) : (
                     <>
                       <Ionicons name="calendar" size={20} color="#fff" style={{ marginRight: 8 }} />
                       <Text style={styles.submitButtonText}>Create Event</Text>
                     </>
                   )}
                 </LinearGradient>
               </TouchableOpacity>
             </LinearGradient>
           </Animated.View>
         </View>
       </Modal>
         </ScrollView>
       </SafeAreaView>
   </View>
 );
};



const styles = StyleSheet.create({
  actionButtonScrollView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    minWidth: '100%', // Ensure content can scroll horizontally
  },
  actionViewItem: {
    alignItems: 'center',
    minWidth: 80,
  },
  actionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  dangerActionButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 68, 68, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 12,
  },
  dangerActionButtonText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 68, 68, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeAreaContent: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
  },
  header: {
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    top: 60, // Better positioning for safe area
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  backButtonAbove: {
    position: 'absolute',
    top: 50, // Positioned to respect safe area (below status bar)
    left: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonGradient: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    width: '100%',
    height: 220,
    opacity: 0.8,
  },
  heroSection: {
    position: 'relative',
    height: 220,
    marginBottom: 20,
    overflow: 'hidden',
    marginTop: -50, // Extend into safe area
    paddingTop: 50, // Add padding to account for safe area
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  headerWithoutBanner: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#000',
  },
  groupInfoCard: {
    borderRadius: 15,
    marginHorizontal: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  groupInfoGradient: {
    padding: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  groupAvatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#00ffff',
  },
  avatarGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 49,
    opacity: 0.3,
    zIndex: -1,
  },
  groupBadge: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  badgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  badgeText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  groupName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  groupDescription: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    opacity: 0.8,
  },
  activityStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  statCardGradient: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  statValue: {
    color: '#00ffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
    textShadowColor: 'rgba(0, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    color: '#fff',
    fontSize: 11,
    marginTop: 2,
    opacity: 0.7,
    textAlign: 'center',
    numberOfLines: 1,
  },
  actionSection: {
    marginBottom: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    marginHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  feedSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  feedPreview: {
    marginBottom: 20,
  },
  feedPreviewCard: {
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  feedPreviewContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  feedPreviewIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
  },
  feedPreviewText: {
    flex: 1,
    marginRight: 16,
  },
  feedPreviewTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feedPreviewSubtitle: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  membersGrid: {
    paddingHorizontal: 0,
  },
  memberCard: {
    borderRadius: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  memberCardGradient: {
    borderRadius: 20,
  },
  memberCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  memberAvatarContainer: {
    marginRight: 16,
  },
  memberAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  memberInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  memberName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  memberRole: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  memberRoleContainer: {
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  ownerRoleContainer: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
  },
  adminRoleContainer: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
  },
  ownerRole: {
    color: '#00ffff',
  },
  adminRole: {
    color: '#00ffff',
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingVertical: 2, // Add small padding to prevent clipping
  },
  memberActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden', // Keep hidden for perfect circle
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 18, // Match the button's borderRadius
    justifyContent: 'center',
    alignItems: 'center',
  },
  promoteButton: {
    // Gradient handled in LinearGradient component
  },
  demoteButton: {
    // Gradient handled in LinearGradient component
  },
  kickButton: {
    // Gradient handled in LinearGradient component
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  requestAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  requestDate: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.7,
  },
  requestActions: {
    flexDirection: 'column',
    gap: 8,
    marginLeft: 12,
  },
  requestButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 90,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  acceptButton: {
    backgroundColor: '#00ff99',
  },
  rejectButton: {
    backgroundColor: '#ff4444',
  },
  acceptButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 255, 0.08)',
    padding: 16,
    borderRadius: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  invitationAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  invitationInviter: {
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    opacity: 0.7,
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  friendCard: {
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  friendCardGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },
  friendInfo: {
    flex: 1,
    marginLeft: 16,
  },
  friendName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  friendSubtext: {
    color: '#888',
    fontSize: 12,
  },
  inviteButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  inviteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  invitingButton: {
    // Gradient handled in LinearGradient component
  },
  inviteButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    fontSize: 16,
    marginVertical: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '85%',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  modalGradient: {
    borderRadius: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 255, 0.1)',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalTitleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  friendsList: {
    padding: 20,
  },
  loadingActivities: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(0, 255, 255, 0.05)',
    borderRadius: 15,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  noActivities: {
    borderRadius: 24,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  noActivitiesGradient: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noActivitiesIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 20,
    overflow: 'hidden',
  },
  noActivitiesIconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noActivitiesText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  noActivitiesSubtext: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  startActivityButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  startActivityButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  startActivityButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activitiesList: {
    paddingHorizontal: 0,
  },
  activityCard: {
    borderRadius: 15,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  activityCardGradient: {
    borderRadius: 20,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  activityUser: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activityAvatarGlow: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 22,
    opacity: 0.3,
    zIndex: -1,
  },
  activityUserInfo: {
    flexDirection: 'column',
  },
  activityUsername: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  activityTime: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  activityTypeIcon: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  activityTypeGradient: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutTypeIcon: {
    // Additional styling for workout type
  },
  mentalTypeIcon: {
    // Additional styling for mental type
  },
  runTypeIcon: {
    // Additional styling for run type
  },
  activityContent: {
    padding: 18,
  },
  activityTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  activitySubtitle: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  
  // Enhanced Post creation styles
  postContainer: {
    borderRadius: 15,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  postContainerGradient: {
    padding: 20,
  },
  
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 16,
    overflow: 'hidden',
  },
  removeImageButtonGradient: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  
  postInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 48,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.15)',
  },
  
  photoButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  photoButtonActive: {
    // Additional styling for active state
  },
  photoButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  postButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  postButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  postButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  
  // Challenge creation modal styles
  modalScrollView: {
    maxHeight: 400,
    paddingHorizontal: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  typeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  typeButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.15)',
    borderColor: 'rgba(0, 255, 255, 0.3)',
  },
  typeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  goalInputContainer: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  goalInput: {
    flex: 1,
  },
  unitSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  unitButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  unitButtonActive: {
    backgroundColor: 'rgba(0, 255, 255, 0.3)',
    borderColor: '#00ffff',
  },
  unitButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  unitButtonTextActive: {
    color: '#00ffff',
  },
  submitButton: {
    borderRadius: 20,
    overflow: 'hidden',
    margin: 20,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Event styles
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  createEventButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  createEventButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  createEventButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  eventsList: {
    paddingRight: 20,
  },
  groupEventCard: {
    width: 280,
    borderRadius: 15,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  groupEventCardGradient: {
    padding: 16,
  },
  eventDateBox: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.2)',
  },
  eventMonthText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  eventDayText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 4,
  },
  eventDayOfWeekText: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  eventContent: {
    marginBottom: 12,
  },
  eventTitleText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  eventTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  eventTimeText: {
    color: '#888',
    fontSize: 14,
  },
  eventDescriptionText: {
    color: '#999',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  eventAttendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventAttendeeAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#111',
    overflow: 'hidden',
  },
  eventAttendeeAvatarImage: {
    width: '100%',
    height: '100%',
  },
  eventAttendeeCount: {
    backgroundColor: 'rgba(0, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 32,
    minHeight: 32,
  },
  eventAttendeeCountText: {
    color: '#00ffff',
    fontSize: 12,
    fontWeight: '600',
  },
  eventJoinButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  eventJoinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  eventJoinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});


export default GroupDetailScreen;


