import { supabase } from "./supabase";

/**
 * @typedef {import("../types/schoolWellness").AdministrativeAssignmentRow} AdministrativeAssignmentRow
 * @typedef {import("../types/schoolWellness").AdministrativeAssignmentEnriched} AdministrativeAssignmentEnriched
 * @typedef {import("../types/schoolWellness").AdminAssignmentType} AdminAssignmentType
 */

/**
 * Student: fetch the highest-priority pending assignment (due soonest).
 *
 * @returns {Promise<AdministrativeAssignmentRow | null>}
 */
export async function fetchPendingAssignmentForStudent() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("administrative_assignments")
    .select("*")
    .eq("student_id", user.id)
    .eq("status", "assigned")
    .order("due_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Student: submit a reflective response (status → submitted).
 *
 * @param {string} assignmentId
 * @param {string} responseText
 * @returns {Promise<AdministrativeAssignmentRow>}
 */
export async function submitAssignmentResponse(assignmentId, responseText) {
  const trimmed = responseText?.trim();
  if (!trimmed) throw new Error("Response cannot be empty");

  const { data, error } = await supabase
    .from("administrative_assignments")
    .update({
      student_response: trimmed,
      status: "submitted",
    })
    .eq("id", assignmentId)
    .eq("status", "assigned")
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Staff: fetch active assignments queue (assigned + submitted, not approved).
 *
 * @param {string} orgId
 * @returns {Promise<AdministrativeAssignmentEnriched[]>}
 */
export async function fetchStaffAssignments(orgId) {
  const { data, error } = await supabase.rpc("staff_list_administrative_assignments", {
    p_org_id: orgId,
  });
  if (error) throw error;
  return data ?? [];
}

/**
 * Staff: mark a submitted assignment as approved.
 *
 * @param {string} assignmentId
 * @returns {Promise<AdministrativeAssignmentRow>}
 */
export async function approveAssignment(assignmentId) {
  const { data, error } = await supabase
    .from("administrative_assignments")
    .update({ status: "approved_by_admin" })
    .eq("id", assignmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Staff: create a new reflective assignment for a student.
 *
 * @param {{
 *   orgId: string;
 *   studentId: string;
 *   assignmentType?: AdminAssignmentType;
 *   promptText: string;
 *   dueAt: string;
 * }} args
 * @returns {Promise<AdministrativeAssignmentRow>}
 */
export async function createAdministrativeAssignment({
  orgId,
  studentId,
  assignmentType = "reflective_journal",
  promptText,
  dueAt,
}) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("administrative_assignments")
    .insert({
      org_id: orgId,
      student_id: studentId,
      assigned_by: user.id,
      assignment_type: assignmentType,
      prompt_text: promptText.trim(),
      due_at: dueAt,
      status: "assigned",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Realtime subscription for org assignment queue (staff dashboard).
 *
 * @param {string} orgId
 * @param {() => void} onChange
 */
export function subscribeToAdministrativeAssignments(orgId, onChange) {
  const channel = supabase
    .channel(`admin_assignments:${orgId}:${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "administrative_assignments",
        filter: `org_id=eq.${orgId}`,
      },
      () => onChange(),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "administrative_assignments",
        filter: `org_id=eq.${orgId}`,
      },
      () => onChange(),
    )
    .subscribe((status) => {
      if (__DEV__) console.log("[admin_assignments] channel status:", status);
    });

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

/**
 * Realtime for student: notified when a new assignment is assigned to them.
 *
 * @param {string} studentId
 * @param {() => void} onChange
 */
export function subscribeToStudentAssignments(studentId, onChange) {
  const channel = supabase
    .channel(`admin_assignments:student:${studentId}:${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "administrative_assignments",
        filter: `student_id=eq.${studentId}`,
      },
      () => onChange(),
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
