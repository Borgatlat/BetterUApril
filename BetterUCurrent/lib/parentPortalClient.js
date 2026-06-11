import { supabase } from "./supabase";

export async function fetchParentLinkedStudents() {
  const { data, error } = await supabase.rpc("list_parent_linked_students");
  if (error) throw error;
  return data ?? [];
}

export async function fetchParentStudentSummary(studentId) {
  const { data, error } = await supabase.rpc("get_parent_student_summary", {
    p_student_id: studentId,
  });
  if (error) throw error;
  return data;
}
