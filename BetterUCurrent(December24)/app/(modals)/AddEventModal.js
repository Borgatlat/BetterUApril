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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';

/** Format a Date for the date field (MM/DD/YYYY) */
function formatDateForForm(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${m}/${day}/${y}`;
}

/** Parse date string (MM/DD/YYYY) to Date; invalid/empty returns today */
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

/** Format a Date for the time field (HH:MM 24h) */
function formatTimeForForm(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Parse time string (HH:MM or H:MM) to Date (today at that time) */
function parseTimeFromForm(s) {
  const base = new Date();
  if (!s?.trim()) return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
  const [h, m] = s.trim().split(':').map((n) => parseInt(n, 10));
  if (!isNaN(h) && !isNaN(m)) return new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0, 0);
}

/** Convert form date (MM/DD/YYYY) to YYYY-MM-DD for group_events.event_date */
function formDateToIsoDate(formDateStr) {
  const d = parseDateFromForm(formDateStr || '');
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const EVENT_FIELDS = [
  { key: 'title', label: 'Event Title', placeholder: 'e.g. Group run', required: true },
  { key: 'description', label: 'Description', placeholder: 'Add details...', multiline: true },
  { key: 'date', label: 'Date', placeholder: 'MM/DD/YYYY', required: true },
  { key: 'time', label: 'Time', placeholder: 'HH:MM (e.g. 18:00)', required: true },
  { key: 'location', label: 'Location', placeholder: 'Optional' },
];

export default function AddEventModal({ visible, onClose, onSuccess, initialValues = null }) {
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
  });
  const [creating, setCreating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [userGroups, setUserGroups] = useState([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sharingToGroups, setSharingToGroups] = useState(false);
  const [createdEventData, setCreatedEventData] = useState(null);

  const updateField = (key, value) => {
    setEventForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForm = () => {
    setEventForm({ title: '', description: '', date: '', time: '', location: '' });
    setCreatedEventData(null);
    setSelectedGroupIds([]);
  };

  // When opened from Volunteer (or elsewhere), prefill fields; empty open from Community resets form.
  useEffect(() => {
    if (!visible) return;
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
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-apply when opening or draft identity changes
  }, [visible, initialValues]);

  useEffect(() => {
    if (!showShareModal) return;
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
  }, [showShareModal]);

  const toggleGroupSelection = (groupId) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const shareEventToGroups = async () => {
    if (!selectedGroupIds?.length) {
      finishShareFlow();
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
      finishShareFlow();
      return;
    }
    const eventDate = formDateToIsoDate(eventForm.date);
    const eventTime = (eventForm.time || '').trim() || '12:00';
    try {
      setSharingToGroups(true);
      for (const groupId of selectedGroupIds) {
        const { data: groupEvent, error: insertErr } = await supabase
          .from('group_events')
          .insert({
            group_id: groupId,
            title: (eventForm.title || '').trim(),
            description: (eventForm.description || '').trim() || null,
            event_date: eventDate,
            event_time: eventTime,
            created_by: user.id,
          })
          .select('id')
          .single();

        if (insertErr) {
          console.error('Error sharing event to group', groupId, insertErr);
          continue;
        }
        await supabase.from('group_event_attendees').insert({
          event_id: groupEvent.id,
          user_id: user.id,
        });
      }
      Alert.alert('Success', `Event shared to ${selectedGroupIds.length} group(s).`);
    } catch (err) {
      console.error('Error sharing to groups:', err);
      Alert.alert('Error', err.message || 'Failed to share to some groups.');
    } finally {
      setSharingToGroups(false);
      finishShareFlow();
    }
  };

  const finishShareFlow = () => {
    setShowShareModal(false);
    const data = createdEventData;
    resetForm();
    onClose();
    if (onSuccess) onSuccess(data);
  };


  const createEvent = async () => {
    const { title, date, time } = eventForm;
    if (!title?.trim()) {
      Alert.alert('Missing field', 'Event title is required.');
      return;
    }
    if (!date?.trim()) {
      Alert.alert('Missing field', 'Date is required.');
      return;
    }
    if (!time?.trim()) {
      Alert.alert('Missing field', 'Time is required.');
      return;
    }
    
        


    try {
      setCreating(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        setCreating(false);
        Alert.alert('Error', 'You must be signed in to create an event.');
        return;
      }

      const insertPayload = {
        title: eventForm.title.trim(),
        description: (eventForm.description || '').trim() || null,
        date: eventForm.date.trim(),
        time: eventForm.time.trim(),
        location: (eventForm.location || '').trim() || null,
        creator_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const EVENT_INSERT_TIMEOUT_MS = 15000;
      const insertPromise = supabase
        .from('events')
        .insert(insertPayload)
        .select()
        .single();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Check your connection and that the events table exists in Supabase.')), EVENT_INSERT_TIMEOUT_MS)
      );
      const { data, error } = await Promise.race([insertPromise, timeoutPromise]);

      if (error) throw error;
      setCreatedEventData(data);
      setShowShareModal(true);
    } catch (err) {
      console.error('Error creating event:', err);
      const msg = err?.message || 'Failed to create event. Please try again.';
      const hint = Platform.OS === 'web'
        ? ' On web, ensure you ran the events migration in Supabase (SQL Editor) and you are signed in.'
        : '';
      Alert.alert('Error', msg + hint);
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating && !sharingToGroups) {
      setShowShareModal(false);
      resetForm();
      onClose();
    }
  };

  return (
    <>
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Add event to feed</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} disabled={creating}>
              <Ionicons name="close" size={24} color="#00ffff" />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="on-drag"
          >
            {EVENT_FIELDS.map(({ key, label, placeholder, required, multiline }) => (
              <View key={key} style={styles.formGroup}>
                <Text style={styles.label}>
                  {label} {required ? '*' : ''}
                </Text>
                {key === 'date' ? (
                  Platform.OS === 'web' ? (
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, styles.inputInner]}
                        value={eventForm[key]}
                        onChangeText={(text) => updateField(key, text)}
                        placeholder={placeholder}
                        placeholderTextColor="#666"
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.inputWrapper}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.input, styles.inputInner, styles.inputDisplayText, !eventForm[key] && styles.inputDisplayPlaceholder]}>
                        {eventForm[key] || placeholder}
                      </Text>
                    </TouchableOpacity>
                  )
                ) : key === 'time' ? (
                  Platform.OS === 'web' ? (
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={[styles.input, styles.inputInner]}
                        value={eventForm[key]}
                        onChangeText={(text) => updateField(key, text)}
                        placeholder={placeholder}
                        placeholderTextColor="#666"
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.inputWrapper}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.input, styles.inputInner, styles.inputDisplayText, !eventForm[key] && styles.inputDisplayPlaceholder]}>
                        {eventForm[key] || placeholder}
                      </Text>
                    </TouchableOpacity>
                  )
                ) : key === 'location' ? (
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.input, styles.inputInner]}
                      value={eventForm[key]}
                      onChangeText={(text) => updateField(key, text)}
                      placeholder={placeholder}
                      placeholderTextColor="#666"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                ) : key === 'title' ? (
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.input, styles.inputInner]}
                      value={eventForm[key]}
                      onChangeText={(text) => updateField(key, text)}
                      placeholder={placeholder}
                      placeholderTextColor="#666"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                ) : key === 'description' ? (
                  <View style={[styles.inputWrapper, styles.inputWrapperMultiline]}>
                    <TextInput
                      style={[styles.input, styles.inputInner, styles.inputMultiline]}
                      value={eventForm[key]}
                      onChangeText={(text) => updateField(key, text)}
                      placeholder={placeholder}
                      placeholderTextColor="#666"
                      underlineColorAndroid="transparent"
                    />
                  </View>
                ) : null}
              </View>
            ))}
            <TouchableOpacity
              style={[styles.submitButton, creating && styles.submitButtonDisabled]}
              onPress={createEvent}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={22} color="#000" style={{ marginRight: 8 }} />
                  <Text style={styles.submitButtonText}>Create Event</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
          {showDatePicker && (
            <Modal visible transparent animationType="slide">
              <TouchableOpacity
                style={styles.pickerOverlay}
                activeOpacity={1}
                onPress={() => setShowDatePicker(false)}
              >
                <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
                  <DateTimePicker
                    value={parseDateFromForm(eventForm.date)}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      const dismissed = event?.type === 'dismissed' || event?.type === 'neutralButtonPressed';
                      if (!dismissed && selectedDate) {
                        updateField('date', formatDateForForm(selectedDate));
                      }
                      setShowDatePicker(false);
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setShowDatePicker(false)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </Modal>
          )}
          {showTimePicker && (
            <Modal visible transparent animationType="slide">
              <TouchableOpacity
                style={styles.pickerOverlay}
                activeOpacity={1}
                onPress={() => setShowTimePicker(false)}
              >
                <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
                  <DateTimePicker
                    value={parseTimeFromForm(eventForm.time)}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      const dismissed = event?.type === 'dismissed' || event?.type === 'neutralButtonPressed';
                      if (!dismissed && selectedDate) {
                        updateField('time', formatTimeForForm(selectedDate));
                      }
                      setShowTimePicker(false);
                    }}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity style={styles.pickerDoneButton} onPress={() => setShowTimePicker(false)}>
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            </Modal>
          )}
        </View>
      </View>
    </Modal>

    {showShareModal && (
      <Modal
        visible={showShareModal}
        animationType="slide"
        transparent
        onRequestClose={finishShareFlow}
      >
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>Share event to groups</Text>
              <TouchableOpacity
                onPress={finishShareFlow}
                style={styles.closeBtn}
                disabled={sharingToGroups}
              >
                <Ionicons name="close" size={24} color="#00ffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.shareModalSubtitle}>
              Select groups to post this event to. You can also skip.
            </Text>
            {loadingGroups ? (
              <ActivityIndicator size="small" color="#00ffff" style={{ marginVertical: 24 }} />
            ) : userGroups.length === 0 ? (
              <Text style={styles.label}>You are not in any groups yet.</Text>
            ) : (
              <ScrollView
                style={styles.shareModalList}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {userGroups.map((group) => {
                  const isSelected = selectedGroupIds.includes(group.id);
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.shareModalRow, isSelected && styles.shareModalRowSelected]}
                      onPress={() => toggleGroupSelection(group.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={isSelected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={isSelected ? '#00ffff' : '#666'}
                      />
                      <Text style={styles.shareModalGroupName}>{group.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={styles.shareModalActions}>
              <TouchableOpacity
                style={[styles.submitButton, sharingToGroups && styles.submitButtonDisabled]}
                onPress={shareEventToGroups}
                disabled={sharingToGroups}
              >
                {sharingToGroups ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="share-social" size={22} color="#000" style={{ marginRight: 8 }} />
                    <Text style={styles.submitButtonText}>
                      Share to {selectedGroupIds.length ? selectedGroupIds.length : 0} group(s)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.skipButton}
                onPress={finishShareFlow}
                disabled={sharingToGroups}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,

  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a5a5a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ffff',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    maxHeight: 420,
    minHeight: 200,
    gap: 10,
    paddingBottom: 20,
    marginTop: 20,
    width: '100%',
    backgroundColor: '',

  },

  contentContainer: {
    paddingBottom: 24,
    minHeight: 200,
    gap: 10,
    paddingBottom: 20,
    marginTop: 20,
    width: '100%',
    backgroundColor: '',
    borderRadius: 20,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  formGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
  },
  /* Wrapper draws a single solid border so we avoid white/black banding when focused */
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a5a5a',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  inputWrapperMultiline: {
    height: 88,
  },
  input: {
    backgroundColor: 'transparent',
    borderRadius: 11,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
  },
  inputInner: {
    borderWidth: 0,
  },
  inputDisplayText: {
    color: '#fff',
  },
  inputDisplayPlaceholder: {
    color: '#666',
  },
  inputMultiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00ffff',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitIcon: {
    marginRight: 8,
  },
  submitButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContainer: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
    alignItems: 'center',
  },
  pickerDoneButton: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: '#00ffff',
    borderRadius: 12,
  },
  pickerDoneText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareModalSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 16,
  },
  shareModalList: {
    maxHeight: 220,
    width: '100%',
    marginBottom: 16,
  },
  shareModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a5a5a',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  shareModalRowSelected: {
    borderColor: '#00ffff',
    backgroundColor: 'rgba(0,255,255,0.08)',
  },
  shareModalGroupName: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  shareModalActions: {
    width: '100%',
    gap: 10,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  skipButtonText: {
    color: '#94a3b8',
    fontSize: 15,
  },
});
