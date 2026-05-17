import { supabase } from "./supabase";

/**
 * All Supabase reads/writes for pastoral / spiritual school features.
 * UI components should import from here—not inline `.from()` calls.
 */

// --- Pulses (Ignatian consolation / desolation) ---

/** @param {{ orgId: string; state: 'consolation' | 'desolation'; intensity: number }} p */
export async function insertSpiritualPulse({ orgId, state, intensity }) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("spiritual_pulses")
    .insert({
      profile_id: user.id,
      org_id: orgId,
      state,
      intensity,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Prayer intentions ---

/**
 * @param {{ orgId: string; body: string; shareAnonymous: boolean }} p
 * `feed_approved` stays false until staff moderates (anonymous share path).
 */
export async function insertPrayerIntention({ orgId, body, shareAnonymous }) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("prayer_intentions")
    .insert({
      profile_id: user.id,
      org_id: orgId,
      body: body.trim(),
      share_anonymous: shareAnonymous,
      feed_approved: false,
      visible_on_wall: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Approved anonymous rows for the community prayer wall */
export async function fetchPrayerWallIntentions(orgId) {
  const { data, error } = await supabase
    .from("prayer_intentions")
    .select("id, body, created_at")
    .eq("org_id", orgId)
    .eq("share_anonymous", true)
    .eq("feed_approved", true)
    .eq("visible_on_wall", true)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

/** Staff queue: shared anonymously and awaiting moderation */
export async function fetchPendingSharedIntentions(orgId) {
  const { data, error } = await supabase
    .from("prayer_intentions")
    .select("id, profile_id, body, share_anonymous, feed_approved, visible_on_wall, created_at")
    .eq("org_id", orgId)
    .eq("share_anonymous", true)
    .eq("feed_approved", false)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/**
 * Staff approves feed + wall visibility (two toggles; often set together in UI).
 * @param {string} intentionId
 * @param {{ feedApproved: boolean; visibleOnWall: boolean }} patch
 */
export async function updateIntentionModeration(intentionId, { feedApproved, visibleOnWall }) {
  const { data, error } = await supabase
    .from("prayer_intentions")
    .update({
      feed_approved: feedApproved,
      visible_on_wall: visibleOnWall,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intentionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Staff declines publishing an anonymous request (keeps text private; removes from queue). */
export async function declineIntentionShare(intentionId) {
  const { error } = await supabase
    .from("prayer_intentions")
    .update({
      share_anonymous: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", intentionId);

  if (error) throw error;
}

// --- Service hours ---

export async function submitServiceHourLog({ orgId, hours, description }) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("service_hour_logs")
    .insert({
      student_id: user.id,
      org_id: orgId,
      hours,
      description: (description || "").trim(),
      status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPendingServiceHourLogsForStaff(orgId) {
  const { data, error } = await supabase.rpc("staff_list_pending_service_hour_logs", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data ?? [];
}

/** @param {'approve' | 'reject'} decision */
export async function reviewServiceHourLog(logId, decision) {
  const { data, error } = await supabase.rpc("review_service_hour_log", {
    p_log_id: logId,
    p_decision: decision,
  });

  if (error) throw error;
  return data;
}

export async function fetchMyTotalApprovedServiceHours() {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("profiles")
    .select("total_approved_service_hours")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  return Number(data?.total_approved_service_hours ?? 0);
}

// --- Live the Fourth prompts ---

export async function fetchLiveFourthPrompts(orgId) {
  const { data, error } = await supabase
    .from("live_the_fourth_prompts")
    .select("id, org_id, title, body, sort_order")
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertOrgLiveFourthPrompt({ orgId, title, body, sortOrder = 100 }) {
  const { data, error } = await supabase
    .from("live_the_fourth_prompts")
    .insert({
      org_id: orgId,
      title: title.trim(),
      body: body.trim(),
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLiveFourthPrompt(id) {
  const { error } = await supabase.from("live_the_fourth_prompts").delete().eq("id", id);
  if (error) throw error;
}

// --- Retreat tracks ---

export async function fetchRetreatTracks(orgId) {
  const { data, error } = await supabase
    .from("retreat_tracks")
    .select("id, org_id, slug, display_name, created_at")
    .or(`org_id.is.null,org_id.eq.${orgId}`)
    .order("display_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchRetreatTrackPrompts(trackId) {
  const { data, error } = await supabase
    .from("retreat_track_prompts")
    .select("id, track_id, kind, body, sort_order")
    .eq("track_id", trackId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function insertOrgRetreatTrack({ orgId, slug, displayName }) {
  const { data, error } = await supabase
    .from("retreat_tracks")
    .insert({
      org_id: orgId,
      slug: slug.trim().toLowerCase().replace(/\s+/g, "-"),
      display_name: displayName.trim(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function insertRetreatTrackPrompt({ trackId, kind, body, sortOrder = 0 }) {
  const { data, error } = await supabase
    .from("retreat_track_prompts")
    .insert({
      track_id: trackId,
      kind,
      body: body.trim(),
      sort_order: sortOrder,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteRetreatTrackPrompt(id) {
  const { error } = await supabase.from("retreat_track_prompts").delete().eq("id", id);
  if (error) throw error;
}

// --- Calendar ---

export async function fetchSpiritualCalendarEvents(orgId, { limit = 60 } = {}) {
  const { data, error } = await supabase
    .from("spiritual_calendar_events")
    .select("*")
    .eq("org_id", orgId)
    .gte("starts_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** Staff editor: include recent past rows for context. */
export async function fetchSpiritualCalendarEventsStaff(orgId, { limit = 80 } = {}) {
  const { data, error } = await supabase
    .from("spiritual_calendar_events")
    .select("*")
    .eq("org_id", orgId)
    .order("starts_at", { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function insertSpiritualCalendarEvent({
  orgId,
  title,
  body,
  kind,
  startsAtIso,
  endsAtIso,
}) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("spiritual_calendar_events")
    .insert({
      org_id: orgId,
      title: title.trim(),
      body: (body || "").trim(),
      kind: kind || "other",
      starts_at: startsAtIso,
      ends_at: endsAtIso || null,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSpiritualCalendarEvent(id) {
  const { error } = await supabase.from("spiritual_calendar_events").delete().eq("id", id);
  if (error) throw error;
}

// --- Bulletin ---

export async function fetchSpiritualBulletinApproved(orgId) {
  const { data, error } = await supabase
    .from("spiritual_bulletin_posts")
    .select("id, author_id, kind, body, starts_at, moderation_status, created_at")
    .eq("org_id", orgId)
    .eq("moderation_status", "approved")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) throw error;
  return data ?? [];
}

export async function insertSpiritualBulletinPost({ orgId, kind, body, startsAt }) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("spiritual_bulletin_posts")
    .insert({
      author_id: user.id,
      org_id: orgId,
      kind,
      body: body.trim(),
      starts_at: startsAt || null,
      moderation_status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPendingBulletinPosts(orgId) {
  const { data, error } = await supabase
    .from("spiritual_bulletin_posts")
    .select("*")
    .eq("org_id", orgId)
    .eq("moderation_status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** @param {'approved' | 'rejected'} status */
export async function moderateBulletinPost(postId, status) {
  const { data, error } = await supabase
    .from("spiritual_bulletin_posts")
    .update({ moderation_status: status })
    .eq("id", postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
