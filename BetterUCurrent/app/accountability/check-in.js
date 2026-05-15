import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUser } from '../../context/UserContext';
import { PremiumAvatar } from '../components/PremiumAvatar';
import {
  getOrCreateCheckIn,
  submitCheckIn,
  submitCheckInReply,
  getCheckInsForPartnership,
  getAccountabilityPartners,
} from '../../utils/accountabilityService';
import { getWeekLabel, getWeekStartDate, getCheckInStreak } from '../../utils/accountabilityUtils';
import { supabase } from '../../lib/supabase';
import WeeklyReflection from '../(modals)/WeeklyReflection';

export default function CheckInScreen() {
  const { partnershipId, partnerId } = useLocalSearchParams();
  const { userProfile } = useUser();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [checkIn, setCheckIn] = useState(null);
  const [partnerCheckIn, setPartnerCheckIn] = useState(null);
  const [partnerProfile, setPartnerProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [goalsMet, setGoalsMet] = useState('');
  const [goalsTotal, setGoalsTotal] = useState('');
  const [consistencyRating, setConsistencyRating] = useState(null);
  const [biggestWin, setBiggestWin] = useState('');
  const [nextFocus, setNextFocus] = useState('');
  const [streak, setStreak] = useState(0);
  const [howYouCanHelp, setHowYouCanHelp] = useState('');
  const [messageToPartner, setMessageToPartner] = useState('');
  const [reply, setReply] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);

  useEffect(() => {
    if (!userProfile?.id || !partnershipId || !partnerId) return;
    (async () => {
      try {
        const [myCheckIn, partners] = await Promise.all([
          getOrCreateCheckIn(partnershipId, userProfile.id, partnerId),
          getAccountabilityPartners(userProfile.id),
        ]);
        setCheckIn(myCheckIn);
        const partner = partners.find((p) => p.partner_id === partnerId);
        setPartnerProfile(partner?.partner || null);

        const weekStart = getWeekStartDate();
        const { data: partnerRow } = await supabase
          .from('accountability_check_ins')
          .select('*')
          .eq('partnership_id', partnershipId)
          .eq('week_start_date', weekStart)
          .eq('user_id', partnerId)
          .maybeSingle();
        setPartnerCheckIn(partnerRow || null);

        const history = await getCheckInsForPartnership(partnershipId);
        setStreak(getCheckInStreak(history, userProfile.id));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile?.id, partnershipId, partnerId]);

  const statusLabels = {
    green: 'On Track',
    yellow: 'Okay',
    red: 'Struggling'
  };


  function AccountabilityCheckIn({ status, note, onChangeStatus }) {
    return (
      <View style={{ marginTop: 16 }}>
        <Text style={{ color: '#00ffff', fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
          Your status: {statusLabels[status] || 'Unknown'}
        </Text>
        {note ? (
          <Text
            style={{
              color: '#00ffff',
              fontSize: 14,
              textAlign: 'center',
              marginBottom: 10,
            }}
          >
            Note: {note}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => onChangeStatus('green')}>
            <Text>✅</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChangeStatus('yellow')}>
            <Text>🟡</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onChangeStatus('red')}>
            <Text>🔴</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (!checkIn) return;
    setSubmitting(true);
    try {
      await submitCheckIn(checkIn.id, {
        notes: notes || undefined,
        goals_met: goalsMet ? parseInt(goalsMet, 10) : undefined,
        goals_total: goalsTotal ? parseInt(goalsTotal, 10) : undefined,
        consistency_rating: consistencyRating ?? undefined,
        biggest_win: biggestWin || undefined,
        next_focus: nextFocus || undefined,
        how_you_can_help: howYouCanHelp || undefined,
        message_to_partner: messageToPartner || undefined,
      });
      Alert.alert(`Submitted`, `Your partner will be notified. You can come back to see ${partnerProfile?.full_name || partnerProfile?.username || 'Partner'} check-in.`);
      router.back();
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async () => {
    if (!partnerCheckIn?.id) return;
    setSubmittingReply(true);
    try {
      await submitCheckInReply(partnerCheckIn.id, reply.trim());
      const { data: updated } = await supabase
        .from('accountability_check_ins')
        .select('*')
        .eq('id', partnerCheckIn.id)
        .single();
      setPartnerCheckIn(updated || partnerCheckIn);
      setReply('');
      Alert.alert('Sent', 'Your reply has been sent to your partner.');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingReply(false);
    }
  };

  if (loading || !checkIn) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#00ffff" />
      </View>
    );
  }

  const weekLabel = getWeekLabel(checkIn.week_start_date);
  const name = partnerProfile?.full_name || partnerProfile?.username || 'Partner';
  const isSubmitted = checkIn.status === 'submitted';

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#00ffff" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Check-in</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.partnerHeader}>
        <PremiumAvatar uri={partnerProfile?.avatar_url} size={56} />
        <Text style={styles.partnerName}>{name}</Text>
        <Text style={styles.weekLabel}>{weekLabel}</Text>
        {streak > 0 && (
          <View style={styles.streakBadge}>
            <Ionicons name="flame" size={18} color="#ff9500" />
            <Text style={styles.streakText}>{streak} week streak</Text>
          </View>
        )}
      </View>

      {isSubmitted ? (
        <View style={styles.done}>
          <Ionicons name="checkmark-circle" size={48} color="#00ff00" />
          <Text style={styles.doneText}>You submitted your check-in for this week.</Text>
        </View>
      ) : (
        <>
          <Text style={styles.sectionTitle}>How did your week go?</Text>
          <TextInput
            style={styles.input}
            placeholder="Notes (optional)"
            placeholderTextColor="#666"
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
          />
          <Text style={styles.sectionTitle}>Goals (e.g. 3/4)</Text>
          <View style={styles.goalsRow}>
            <TextInput
              style={[styles.input, styles.goalsInput]}
              placeholder="Met"
              placeholderTextColor="#666"
              value={goalsMet}
              onChangeText={setGoalsMet}
              keyboardType="number-pad"
            />
            <Text style={styles.slash}>/</Text>
            <TextInput
              style={[styles.input, styles.goalsInput]}
              placeholder="Total"
              placeholderTextColor="#666"
              value={goalsTotal}
              onChangeText={setGoalsTotal}
              keyboardType="number-pad"
            />
          </View>
          <Text style={styles.sectionTitle}>Consistency (1–5)</Text>
          <Text style = {styles.sectionSubtitle}>1 = Not consistent at all, 5 = Very consistent</Text>
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((n) => (

              <TouchableOpacity
                key={n}
                style={[styles.ratingBtn, consistencyRating === n && styles.ratingBtnActive]}
                onPress={() => setConsistencyRating(n)}
              >
                <Text style={[styles.ratingText, consistencyRating === n && styles.ratingTextActive]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <Text style={styles.sectionTitle}>Biggest win?</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            placeholderTextColor="#666"
            value={biggestWin}
            onChangeText={setBiggestWin}
          />
          <Text style={styles.sectionTitle}>Focus for next week?</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional"
            placeholderTextColor="#666"
            value={nextFocus}
            onChangeText={setNextFocus}
          />
          <Text style={styles.sectionTitle}>Anything you want to say to {name}?</Text>
          <TextInput
            style={styles.input}
            placeholder="Optional – e.g. thanks, encouragement, a question"
            placeholderTextColor="#666"
            value={messageToPartner}
            onChangeText={setMessageToPartner}
            multiline
            numberOfLines={2}
          />
          <Text style={styles.sectionTitle}>How can your partner help you?</Text>
          <TextInput 
          style={styles.input}
          placeholder="Optional"
          placeholderTextColor="#666"
          value ={howYouCanHelp}
          onChangeText={setHowYouCanHelp}
          ></TextInput>
          
          <TouchableOpacity
            style={styles.reflectionBtn}
            onPress={() => setShowWeeklyReflection(true)}
          >
            <Text style={styles.reflectionBtnText}>Open weekly reflection</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>
              {submitting ? 'Submitting…' : 'Submit check-in'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      {partnerCheckIn && partnerCheckIn.status === 'submitted' && (
        <View style={styles.partnerSection}>
          <Text style={styles.sectionTitle}>Partner's check-in</Text>
          {partnerCheckIn.notes ? (
            <Text style={styles.partnerNotes}>{partnerCheckIn.notes}</Text>
          ) : null}
          {partnerCheckIn.goals_met != null && (
            <Text style={styles.partnerMeta}>
              Goals: {partnerCheckIn.goals_met}/{partnerCheckIn.goals_total ?? '?'}
            </Text>
          )}
          {partnerCheckIn.consistency_rating != null && (
            <Text style={styles.partnerMeta}>
              Consistency: {partnerCheckIn.consistency_rating}/5
            </Text>
          )}
          {partnerCheckIn.biggest_win ? (
            <Text style={styles.partnerMeta}>Win: {partnerCheckIn.biggest_win}</Text>
          ) : null}
          {partnerCheckIn.next_focus ? (
            <Text style={styles.partnerMeta}>Next: {partnerCheckIn.next_focus}</Text>
          ) : null}
          {partnerCheckIn.how_you_can_help ? (
            <Text style={styles.partnerMeta}>How I can help: {partnerCheckIn.how_you_can_help}</Text>
          ) : null}
          {partnerCheckIn.message_to_partner ? (
            <Text style={[styles.partnerMeta, { marginTop: 8, fontStyle: 'italic' }]}>
              Message for you: {partnerCheckIn.message_to_partner}
            </Text>
          ) : null}
          {partnerCheckIn.reply_by_partner ? (
            <View style={styles.replyFromYou}>
              <Text style={styles.sectionTitle}>Your reply</Text>
              <Text style={styles.partnerNotes}>{partnerCheckIn.reply_by_partner}</Text>
            </View>
          ) : (
            <View style={styles.replySection}>
              <Text style={styles.sectionTitle}>Reply to {name}&apos;s check-in</Text>
              <TextInput
                style={styles.input}
                placeholder="Write a short reply or encouragement..."
                placeholderTextColor="#666"
                value={reply}
                onChangeText={setReply}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={[styles.submitBtn, submittingReply && styles.submitBtnDisabled]}
                onPress={handleReplySubmit}
                disabled={submittingReply || !reply.trim()}
              >
                <Text style={styles.submitBtnText}>
                  {submittingReply ? 'Sending…' : 'Send reply'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
      </ScrollView>

      <WeeklyReflection
        visible={showWeeklyReflection}
        onClose={() => setShowWeeklyReflection(false)}
        onComplete={(reflection) => {
          // If the user fills the reflection, we gently merge it into the notes
          // so it is saved together with the check-in.
          const summary =
            `\n\nWeekly reflection:\n` +
            (reflection.whatWentWell ? `- Went well: ${reflection.whatWentWell}\n` : '') +
            (reflection.whatWentBad ? `- Went badly: ${reflection.whatWentBad}\n` : '') +
            (reflection.whatCanImprove ? `- Improve: ${reflection.whatCanImprove}\n` : '') +
            (reflection.changes ? `- Changes next week: ${reflection.changes}\n` : '');
          setNotes((prev) => (prev || '') + summary);
          setShowWeeklyReflection(false);
        }}
      />
    </>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { paddingHorizontal: 16 },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  sectionSubtitle: {
    color: '#888',
    marginTop: 4,
    fontSize: 12,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 255, 255, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: { padding: 8 },
  screenTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  headerRight: { width: 40 },
  partnerHeader: { alignItems: 'center', marginBottom: 24 },
  partnerName: { fontSize: 20, fontWeight: '700', color: '#fff', marginTop: 8 },
  weekLabel: { fontSize: 14, color: '#888', marginTop: 4 },
  streakBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  streakText: { marginLeft: 6, color: '#ff9500', fontWeight: '600' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ccc',
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    minHeight: 44,
  },
  goalsRow: { flexDirection: 'row', alignItems: 'center' },
  goalsInput: { flex: 1, minHeight: 44 },
  slash: { color: '#666', marginHorizontal: 8 },
  ratingRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  ratingBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBtnActive: { backgroundColor: '#00ffff' },
  ratingText: { color: '#888' },
  ratingTextActive: { color: '#000' },
  submitBtn: {
    backgroundColor: '#00ffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#000', fontWeight: '700' },
  done: { alignItems: 'center', paddingVertical: 24 },
  doneText: { color: '#888', marginTop: 12 },
  partnerSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  partnerNotes: { color: '#ccc', marginBottom: 8 },
  partnerMeta: { color: '#888', fontSize: 14, marginTop: 4 },
  replyFromYou: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#222' },
  replySection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#222' },
});

