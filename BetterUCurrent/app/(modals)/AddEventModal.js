import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { notifyCommunityFeedUpdated } from '../../utils/feedPreloader';
import { shareEventToGroupIds, resolveRouteId } from '../../utils/groupEventHelpers';
import { COMMUNITY_THEME as T } from '../../config/communityTheme';
import { hexToRgba } from '../../utils/homePageCustomization';

const ACCENT = T.communityAccent;
const PICKER_TEXT_COLOR = '#ffffff';

function formatDateForForm(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${y}`;
}

function parseDateFromForm(s) {
  if (!s?.trim()) return new Date();
  const parts = s.trim().split(/[/-]/);
  if (parts.length >= 3) {
    const m = parseInt(parts[0], 10) - 1;
    const d = parseInt(parts[1], 10);
    const y = parseInt(parts[2], 10);
    if (!isNaN(m) && !isNaN(d) && !isNaN(y)) {
      const parsed = new Date(y, m, d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  return new Date();
}

function formatTimeForForm(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTimeFromForm(s) {
  const base = new Date();
  if (!s?.trim()) return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  const [h, m] = s.trim().split(':').map((n) => parseInt(n, 10));
  if (!isNaN(h) && !isNaN(m)) return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
}

function formDateToIsoDate(formDateStr) {
  const d = parseDateFromForm(formDateStr || '');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyForm() {
  const now = new Date();
  return {
    title: '',
    description: '',
    date: formatDateForForm(now),
    time: formatTimeForForm(now),
    location: '',
  };
}

export default function AddEventModal({
  visible,
  onClose,
  onSuccess,
  initialValues = null,
  /** When opened from a group page: auto-share here + pre-select on step 2 */
  contextGroupId = null,
  contextGroupName = null,
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState('form');
  const [eventForm, setEventForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sharingToGroups, setSharingToGroups] = useState(false);
  const [createdEventData, setCreatedEventData] = useState(null);
  const [alreadySharedGroupIds, setAlreadySharedGroupIds] = useState([]);

  const resolvedContextGroupId = resolveRouteId(contextGroupId);

  const updateField = (key, value) => {
    setEventForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetAll = () => {
    setEventForm(emptyForm());
    setCreatedEventData(null);
    setSelectedGroupIds([]);
    setAlreadySharedGroupIds([]);
    setStep('form');
  };

  useEffect(() => {
    if (!visible) return;
    setStep('form');
    if (resolvedContextGroupId) {
      setSelectedGroupIds([resolvedContextGroupId]);
    } else {
      setSelectedGroupIds([]);
    }
    setAlreadySharedGroupIds([]);
    if (initialValues && typeof initialValues === 'object') {
      const now = new Date();
      setEventForm({
        title: String(initialValues.title ?? '').trim().slice(0, 500),
        description: String(initialValues.description ?? ''),
        date: String(initialValues.date ?? '').trim() || formatDateForForm(now),
        time: String(initialValues.time ?? '').trim() || formatTimeForForm(now),
        location: String(initialValues.location ?? '').trim(),
      });
    } else {
      setEventForm(emptyForm());
    }
  }, [visible, initialValues, resolvedContextGroupId]);

  useEffect(() => {
    if (!visible || step !== 'share') return;
    if (resolvedContextGroupId) {
      setSelectedGroupIds((prev) =>
        prev.includes(resolvedContextGroupId) ? prev : [resolvedContextGroupId, ...prev]
      );
    }
    const fetchUserGroups = async () => {
      try {
        setLoadingGroups(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          setUserGroups([]);
          return;
        }
        const { data: memberships, error: memErr } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('user_id', user.id);
        if (memErr) throw memErr;
        const groupIds = (memberships || []).map((m) => m.group_id);
        if (groupIds.length === 0) {
          setUserGroups([]);
          return;
        }
        const { data: groups, error: grpErr } = await supabase
          .from('groups')
          .select('id, name')
          .in('id', groupIds);
        if (grpErr) throw grpErr;
        setUserGroups(groups || []);
      } catch (err) {
        console.error('Error fetching groups:', err);
        setUserGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchUserGroups();
  }, [visible, step]);

  const toggleGroupSelection = (groupId) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const finishShareFlow = (extra = {}) => {
    const data = { communityEvent: createdEventData, ...extra };
    resetAll();
    onClose();
    if (onSuccess) onSuccess(data);
  };

  const shareToGroups = async (groupIds) => {
    const toShare = [...new Set((groupIds || []).filter((gid) => gid && !alreadySharedGroupIds.includes(gid)))];
    if (toShare.length === 0) return { created: [], errors: [] };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return { created: [], errors: [] };

    const eventDate = formDateToIsoDate(eventForm.date);
    const eventTime = (eventForm.time || '').trim() || '12:00';
    const result = await shareEventToGroupIds(supabase, {
      groupIds: toShare,
      title: eventForm.title,
      description: eventForm.description,
      eventDate,
      eventTime,
      userId: user.id,
    });
    if (result.created.length > 0) {
      setAlreadySharedGroupIds((prev) => [
        ...prev,
        ...result.created.map((e) => e.group_id),
      ]);
    }
    return result;
  };

  const shareEventToGroups = async () => {
    const pending = selectedGroupIds.filter((gid) => !alreadySharedGroupIds.includes(gid));
    if (pending.length === 0) {
      finishShareFlow();
      return;
    }
    try {
      setSharingToGroups(true);
      const { errors } = await shareToGroups(pending);
      if (errors.length > 0) {
        const detail = errors[0]?.error?.message || errors[0]?.error?.code || 'Unknown error';
        Alert.alert(
          'Could not add to group',
          `${detail}\n\nRun RUN_GROUP_EVENTS_TABLES_IN_SUPABASE.sql in Supabase if you have not already.`
        );
      }
    } catch (err) {
      console.error('Error sharing to groups:', err);
      Alert.alert('Error', err.message || 'Failed to share to some groups.');
    } finally {
      setSharingToGroups(false);
      finishShareFlow({ groupIdsShared: selectedGroupIds });
    }
  };

  const createEvent = async () => {
    const { title, date, time } = eventForm;
    if (!title?.trim()) {
      Alert.alert('Add a title', 'Give your event a name so people know what it is.');
      return;
    }
    if (!date?.trim() || !time?.trim()) {
      Alert.alert('Add date & time', 'Tap the date and time fields to choose when the event happens.');
      return;
    }

    try {
      setCreating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        Alert.alert('Sign in required', 'You need to be signed in to post an event.');
        return;
      }

      const insertPayload = {
        title: eventForm.title.trim(),
        description: (eventForm.description || '').trim() || null,
        date: formDateToIsoDate(eventForm.date),
        time: eventForm.time.trim(),
        location: (eventForm.location || '').trim() || null,
        creator_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const EVENT_INSERT_TIMEOUT_MS = 15000;
      const insertPromise = supabase.from('events').insert(insertPayload).select().single();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timed out. Check your connection and try again.')),
          EVENT_INSERT_TIMEOUT_MS
        )
      );
      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) throw error;
      setCreatedEventData(data);
      notifyCommunityFeedUpdated();

      if (resolvedContextGroupId) {
        try {
          const { created, errors } = await shareToGroups([resolvedContextGroupId]);
          if (errors.length > 0 && created.length === 0) {
            const detail = errors[0]?.error?.message || 'Insert blocked or table missing';
            Alert.alert(
              'Posted to feed only',
              `Could not add to the group: ${detail}\n\nRun RUN_GROUP_EVENTS_TABLES_IN_SUPABASE.sql in Supabase SQL Editor, then create the event again.`
            );
          }
        } catch (shareErr) {
          console.error('Error auto-sharing to context group:', shareErr);
          Alert.alert('Group event failed', shareErr?.message || 'Could not save to group_events.');
        }
      }

      setStep('share');
    } catch (err) {
      console.error('Error creating event:', err);
      const msg = err?.message || 'Failed to create event. Please try again.';
      Alert.alert('Could not post', msg);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating && !sharingToGroups) {
      resetAll();
      onClose();
    }
  };

  const setQuickDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    updateField('date', formatDateForForm(d));
  };

  const renderPickerField = (key, label, placeholder, icon, onPress) => (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>
        {label} <Text style={styles.required}>*</Text>
      </Text>
      {Platform.OS === 'web' ? (
        <View style={styles.inputShell}>
          <TextInput
            style={styles.input}
            value={eventForm[key]}
            onChangeText={(text) => updateField(key, text)}
            placeholder={placeholder}
            placeholderTextColor={T.communityTextMuted}
          />
        </View>
      ) : (
        <TouchableOpacity style={styles.pickerBtn} onPress={onPress} activeOpacity={0.8}>
          <Ionicons name={icon} size={20} color={ACCENT} />
          <Text
            style={[
              styles.pickerBtnText,
              !eventForm[key] && styles.pickerBtnPlaceholder,
            ]}
          >
            {eventForm[key] || placeholder}
          </Text>
          <Ionicons name="chevron-down" size={18} color={T.communityTextMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  const bottomPad = Math.max(insets.bottom, 16);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: bottomPad }]}>
          <View style={styles.handle} />

          {step === 'form' ? (
            <>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <Ionicons name="calendar" size={22} color={ACCENT} />
                  </View>
                  <View style={styles.headerTextCol}>
                    <Text style={styles.title}>Create event</Text>
                    <Text style={styles.headerSubtitle}>
                      {contextGroupName
                        ? `Step 1 of 2 · Post to feed & ${contextGroupName}`
                        : 'Step 1 of 2 · Post to the Community feed'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={handleClose} hitSlop={12} disabled={creating}>
                  <Ionicons name="close-circle" size={30} color={T.communityTextMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.stepPills}>
                <View style={[styles.stepPill, styles.stepPillActive]}>
                  <Text style={styles.stepPillTextActive}>1 · Details</Text>
                </View>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillTextMuted}>2 · Groups (optional)</Text>
                </View>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.hintCard}>
                  <Ionicons name="information-circle-outline" size={20} color={ACCENT} />
                  <Text style={styles.hintText}>
                    {contextGroupName
                      ? `Posts to the Community feed and adds the event to ${contextGroupName} (upcoming events + group activity).`
                      : 'Fill in the title and when it happens. The big button at the bottom posts it to the feed for everyone.'}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>About the event</Text>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>
                    Title <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.inputShell}>
                    <TextInput
                      style={styles.input}
                      value={eventForm.title}
                      onChangeText={(text) => updateField('title', text)}
                      placeholder="e.g. Saturday group run"
                      placeholderTextColor={T.communityTextMuted}
                      maxLength={500}
                    />
                  </View>
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Description</Text>
                  <View style={[styles.inputShell, styles.inputShellTall]}>
                    <TextInput
                      style={[styles.input, styles.inputMultiline]}
                      value={eventForm.description}
                      onChangeText={(text) => updateField('description', text)}
                      placeholder="What should people know? (optional)"
                      placeholderTextColor={T.communityTextMuted}
                      multiline
                      textAlignVertical="top"
                    />
                  </View>
                </View>

                <Text style={styles.sectionTitle}>When & where</Text>
                <View style={styles.quickDateRow}>
                  <TouchableOpacity style={styles.quickChip} onPress={() => setQuickDate(0)}>
                    <Text style={styles.quickChipText}>Today</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.quickChip} onPress={() => setQuickDate(1)}>
                    <Text style={styles.quickChipText}>Tomorrow</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.dateTimeRow}>
                  <View style={styles.dateTimeCol}>
                    {renderPickerField('date', 'Date', 'Pick date', 'calendar-outline', () =>
                      setShowDatePicker(true)
                    )}
                  </View>
                  <View style={styles.dateTimeCol}>
                    {renderPickerField('time', 'Time', 'Pick time', 'time-outline', () =>
                      setShowTimePicker(true)
                    )}
                  </View>
                </View>

                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Location</Text>
                  <View style={styles.inputShell}>
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color={T.communityTextMuted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, styles.inputWithIcon]}
                      value={eventForm.location}
                      onChangeText={(text) => updateField('location', text)}
                      placeholder="Gym, park, or address (optional)"
                      placeholderTextColor={T.communityTextMuted}
                    />
                  </View>
                </View>
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[styles.primaryBtn, creating && styles.primaryBtnDisabled]}
                  onPress={createEvent}
                  disabled={creating}
                  activeOpacity={0.85}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="megaphone" size={22} color="#000" />
                      <Text style={styles.primaryBtnText}>
                        {contextGroupName
                          ? `Post to feed & ${contextGroupName}`
                          : 'Post to Community Feed'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} disabled={creating}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={[styles.headerIcon, styles.headerIconSuccess]}>
                    <Ionicons name="checkmark-circle" size={24} color="#00e676" />
                  </View>
                  <View style={styles.headerTextCol}>
                    <Text style={styles.title}>Posted to feed</Text>
                    <Text style={styles.headerSubtitle}>
                      {contextGroupName
                        ? `Step 2 of 2 · Also share to other groups (optional)`
                        : 'Step 2 of 2 · Share to your groups (optional)'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={finishShareFlow} hitSlop={12} disabled={sharingToGroups}>
                  <Ionicons name="close-circle" size={30} color={T.communityTextMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.stepPills}>
                <View style={[styles.stepPill, styles.stepPillDone]}>
                  <Text style={styles.stepPillTextDone}>1 · Details ✓</Text>
                </View>
                <View style={[styles.stepPill, styles.stepPillActive]}>
                  <Text style={styles.stepPillTextActive}>2 · Groups</Text>
                </View>
              </View>

              <View style={styles.successBanner}>
                <Text style={styles.successTitle}>{eventForm.title}</Text>
                <Text style={styles.successMeta}>
                  {eventForm.date} at {eventForm.time}
                  {eventForm.location ? ` · ${eventForm.location}` : ''}
                </Text>
              </View>

              <ScrollView
                style={styles.scrollShare}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                {loadingGroups ? (
                  <ActivityIndicator size="small" color={ACCENT} style={{ marginVertical: 24 }} />
                ) : userGroups.length === 0 ? (
                  <Text style={styles.emptyGroups}>
                    You are not in any groups yet. Tap Done below — your event is already on the
                    feed.
                  </Text>
                ) : (
                  userGroups.map((group) => {
                    const isSelected = selectedGroupIds.includes(group.id);
                    return (
                      <TouchableOpacity
                        key={group.id}
                        style={[styles.groupRow, isSelected && styles.groupRowSelected]}
                        onPress={() => toggleGroupSelection(group.id)}
                        activeOpacity={0.75}
                      >
                        <Ionicons
                          name={isSelected ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={isSelected ? ACCENT : T.communityTextMuted}
                        />
                        <Text style={styles.groupName}>{group.name}</Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>

              <View style={styles.footer}>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    (sharingToGroups ||
                      userGroups.length === 0 ||
                      selectedGroupIds.filter((gid) => !alreadySharedGroupIds.includes(gid))
                        .length === 0) &&
                      styles.primaryBtnDisabled,
                  ]}
                  onPress={shareEventToGroups}
                  disabled={
                    sharingToGroups ||
                    userGroups.length === 0 ||
                    selectedGroupIds.filter((gid) => !alreadySharedGroupIds.includes(gid))
                      .length === 0
                  }
                  activeOpacity={0.85}
                >
                  {sharingToGroups ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <>
                      <Ionicons name="people" size={22} color="#000" />
                      <Text style={styles.primaryBtnText}>
                        {(() => {
                          const n = selectedGroupIds.filter(
                            (gid) => !alreadySharedGroupIds.includes(gid)
                          ).length;
                          if (n === 0) return 'All selected groups updated';
                          return `Share to ${n} more group${n === 1 ? '' : 's'}`;
                        })()}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={finishShareFlow}
                  disabled={sharingToGroups}
                >
                  <Text style={styles.cancelBtnText}>Done — skip groups</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {showDatePicker && (
          <Modal visible transparent animationType="fade">
            <TouchableOpacity
              style={styles.pickerOverlay}
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            >
              <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
                <Text style={styles.pickerTitle}>Event date</Text>
                <DateTimePicker
                  value={parseDateFromForm(eventForm.date)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={PICKER_TEXT_COLOR}
                  themeVariant="dark"
                  accentColor={ACCENT}
                  onChange={(event, selectedDate) => {
                    const dismissed =
                      event?.type === 'dismissed' || event?.type === 'neutralButtonPressed';
                    if (!dismissed && selectedDate) {
                      updateField('date', formatDateForForm(selectedDate));
                    }
                    if (Platform.OS !== 'ios') setShowDatePicker(false);
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}

        {showTimePicker && (
          <Modal visible transparent animationType="fade">
            <TouchableOpacity
              style={styles.pickerOverlay}
              activeOpacity={1}
              onPress={() => setShowTimePicker(false)}
            >
              <View style={styles.pickerSheet} onStartShouldSetResponder={() => true}>
                <Text style={styles.pickerTitle}>Event time</Text>
                <DateTimePicker
                  value={parseTimeFromForm(eventForm.time)}
                  mode="time"
                  is24Hour={false}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  textColor={PICKER_TEXT_COLOR}
                  themeVariant="dark"
                  accentColor={ACCENT}
                  onChange={(event, selectedDate) => {
                    const dismissed =
                      event?.type === 'dismissed' || event?.type === 'neutralButtonPressed';
                    if (!dismissed && selectedDate) {
                      updateField('time', formatTimeForForm(selectedDate));
                    }
                    if (Platform.OS !== 'ios') setShowTimePicker(false);
                  }}
                />
                {Platform.OS === 'ios' && (
                  <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                    <Text style={styles.pickerDoneText}>Done</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: T.communityBorderActive,
    maxHeight: '92%',
    minHeight: 420,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 10,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: hexToRgba(ACCENT, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerIconSuccess: {
    backgroundColor: 'rgba(0, 230, 118, 0.12)',
  },
  headerTextCol: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: T.communityTextPrimary,
  },
  headerSubtitle: {
    fontSize: 13,
    color: T.communityTextSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  stepPills: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  stepPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: T.communityBorder,
  },
  stepPillActive: {
    backgroundColor: hexToRgba(ACCENT, 0.12),
    borderColor: hexToRgba(ACCENT, 0.35),
  },
  stepPillDone: {
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderColor: 'rgba(0, 230, 118, 0.25)',
  },
  stepPillTextActive: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  stepPillTextMuted: {
    color: T.communityTextMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  stepPillTextDone: {
    color: '#00e676',
    fontSize: 12,
    fontWeight: '600',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 380,
  },
  scrollShare: {
    flexShrink: 1,
    maxHeight: 280,
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: hexToRgba(ACCENT, 0.08),
    borderRadius: T.communityRadius,
    padding: 14,
    borderWidth: 1,
    borderColor: hexToRgba(ACCENT, 0.2),
    marginBottom: 18,
  },
  hintText: {
    flex: 1,
    color: T.communityTextSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    color: T.communityTextMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: T.communityTextSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  required: {
    color: '#ff7043',
  },
  inputShell: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.communityBorder,
    backgroundColor: T.communityCardBg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputShellTall: {
    minHeight: 96,
    alignItems: 'flex-start',
  },
  input: {
    flex: 1,
    color: T.communityTextPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: 12,
  },
  inputIcon: {
    marginLeft: 14,
  },
  inputWithIcon: {
    paddingLeft: 8,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.communityBorder,
    backgroundColor: T.communityCardBg,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  pickerBtnText: {
    flex: 1,
    color: T.communityTextPrimary,
    fontSize: 16,
    fontWeight: '500',
  },
  pickerBtnPlaceholder: {
    color: T.communityTextMuted,
    fontWeight: '400',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: hexToRgba(ACCENT, 0.1),
    borderWidth: 1,
    borderColor: hexToRgba(ACCENT, 0.25),
  },
  quickChipText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateTimeCol: {
    flex: 1,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: T.communityBorder,
    backgroundColor: '#0a0a0a',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: T.communityTextSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  successBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 230, 118, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 230, 118, 0.2)',
  },
  successTitle: {
    color: T.communityTextPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  successMeta: {
    color: T.communityTextSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  emptyGroups: {
    color: T.communityTextSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingVertical: 16,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.communityBorder,
    backgroundColor: T.communityCardBg,
    marginBottom: 8,
    gap: 12,
  },
  groupRowSelected: {
    borderColor: hexToRgba(ACCENT, 0.45),
    backgroundColor: hexToRgba(ACCENT, 0.08),
  },
  groupName: {
    color: T.communityTextPrimary,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.communityBorder,
  },
  pickerTitle: {
    color: T.communityTextPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
  },
  pickerDone: {
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 40,
    backgroundColor: ACCENT,
    borderRadius: 12,
  },
  pickerDoneText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
