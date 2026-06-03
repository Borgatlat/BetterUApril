/**
 * Emmaus Companion Network — DB enums and client payloads.
 */

export type SupportType =
  | "listen_only"
  | "prayer_request"
  | "seeking_advice"
  | "silent_prayer_only"
  | "casual_hangout";

export type StruggleCategory =
  | "academic_stress"
  | "social_isolation"
  | "grief_loss"
  | "general_wellbeing";

export type InteractionFormat = "text_chat" | "in_person_casual" | "sacramental_chapel";

export type UrgencyTier = "routine_check_in" | "urgent_today";

export type CompanionStatus =
  | "unassigned"
  | "active_chat"
  | "converted_to_in_person"
  | "resolved";

export interface CompanionRequest {
  id: string;
  org_id: string;
  student_id: string;
  mentor_id: string | null;
  support_type: SupportType;
  category: StruggleCategory;
  format_preference: InteractionFormat;
  urgency_tier: UrgencyTier;
  student_notes: string | null;
  status: CompanionStatus;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/** Unassigned queue — no student identity (RPC staff_list_companion_queue_anon). */
export interface CompanionRequestAnon {
  id: string;
  category: StruggleCategory;
  support_type: SupportType;
  format_preference: InteractionFormat;
  urgency_tier: UrgencyTier;
  student_notes_preview: string | null;
  created_at: string;
}

export interface CompanionRequestEnriched {
  id: string;
  org_id: string;
  student_id: string;
  student_full_name: string;
  student_email: string;
  mentor_id: string | null;
  mentor_full_name: string | null;
  support_type: SupportType;
  category: StruggleCategory;
  format_preference: InteractionFormat;
  urgency_tier: UrgencyTier;
  student_notes: string | null;
  status: CompanionStatus;
  created_at: string;
  updated_at: string;
}

export interface CompanionMessage {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

export interface CreateCompanionRequestPayload {
  orgId: string;
  supportType: SupportType;
  category: StruggleCategory;
  formatPreference?: InteractionFormat;
  urgencyTier?: UrgencyTier;
  studentNotes?: string;
}

/** In-memory wizard state before submit. */
export interface EmmausWizardDraft {
  category: StruggleCategory | null;
  supportType: SupportType | null;
  formatPreference: InteractionFormat;
  urgencyTier: UrgencyTier;
  studentNotes: string;
}

export const EMMAUS_DEFAULT_DRAFT: EmmausWizardDraft = {
  category: null,
  supportType: null,
  formatPreference: "text_chat",
  urgencyTier: "routine_check_in",
  studentNotes: "",
};
