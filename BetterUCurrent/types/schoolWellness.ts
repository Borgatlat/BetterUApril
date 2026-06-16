/**
 * School wellness / two-door B2B2C types.
 * DB uses snake_case (Postgres); UI may use camelCase via mappers.
 */

export type AccountType = "public" | "student" | "counselor" | "admin";

export type Workspace = "anon" | "public" | "student" | "staff";

export interface EmergencyContact {
  title: string;
  phone: string;
}

/** organizations.id is the slug (e.g. jesuit-houston) */
export interface OrgEnabledModules {
  spiritual?: boolean;
  nutrition?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  domain_lock: string;
  emergency_contacts: EmergencyContact[];
  enabled_modules?: OrgEnabledModules;
  created_at: string;
}

export interface UserProfileSchoolFields {
  account_type: AccountType;
  org_id: string | null;
  is_peer_mentor?: boolean;
}

export interface DailyPulseLog {
  id: string;
  profile_id: string;
  org_id: string | null;
  logged_date: string;
  mood: number;
  stress_level: number;
  sleep_quality: number;
  anonymize_aggregate: boolean;
  created_at: string;
}

export type CounselorAlertStatus = "pending" | "acknowledged" | "resolved";

export interface CounselorAlert {
  id: string;
  org_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  status: CounselorAlertStatus;
  created_at: string;
}

/** get_org_pulse_sentinel RPC JSON */
export interface SentinelMetrics {
  mood_avg_7d: number | null;
  stress_avg_7d: number | null;
  sleep_avg_7d: number | null;
  sample_size_7d: number | null;
  stress_avg_last_48h: number | null;
  stress_avg_prev_48h_block: number | null;
  stress_spike_warning: boolean;
}

/** State / district style youth wellness reporting export row (no PHI) */
export interface WeeklyWellnessExportRow {
  reporting_period_end: string;
  org_slug: string;
  metric: "mood" | "stress_level" | "sleep_quality";
  seven_day_mean: number | null;
  sample_size: number;
  systemic_stress_spike_flag: boolean;
  data_classification: "aggregated_deidentified";
}

/** Spiritual / pastoral (Supabase tables) */

export type SpiritualPulseState = "consolation" | "desolation";

export interface SpiritualPulseRow {
  id: string;
  profile_id: string;
  org_id: string;
  state: SpiritualPulseState;
  intensity: number;
  created_at: string;
}

export interface PrayerIntentionRow {
  id: string;
  profile_id: string;
  org_id: string;
  body: string;
  share_anonymous: boolean;
  feed_approved: boolean;
  visible_on_wall: boolean;
  created_at: string;
  updated_at: string;
}

export type ServiceHourStatus = "pending" | "approved" | "rejected";

export interface ServiceHourLogRow {
  id: string;
  student_id: string;
  org_id: string;
  hours: number;
  description: string;
  status: ServiceHourStatus;
  reviewer_id?: string | null;
  created_at: string;
  reviewed_at?: string | null;
}

export interface LiveFourthPromptRow {
  id: string;
  org_id: string | null;
  title: string;
  body: string;
  sort_order: number;
}

export interface RetreatTrackRow {
  id: string;
  org_id: string | null;
  slug: string;
  display_name: string;
  created_at: string;
}

export interface RetreatTrackPromptRow {
  id: string;
  track_id: string;
  kind: "challenge" | "journal" | "reminder";
  body: string;
  sort_order: number;
}

export type SpiritualCalendarKind = "confession" | "rosary" | "mass" | "other";

export interface SpiritualCalendarEventRow {
  id: string;
  org_id: string;
  title: string;
  body: string;
  kind: SpiritualCalendarKind;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  created_at: string;
}

export type BulletinPostKind = "intention_request" | "event_notice";

export type BulletinModerationStatus = "pending" | "approved" | "rejected";

export interface SpiritualBulletinPostRow {
  id: string;
  author_id: string;
  org_id: string;
  kind: BulletinPostKind;
  body: string;
  starts_at: string | null;
  moderation_status: BulletinModerationStatus;
  created_at: string;
}

/** -------------------------------------------------------------------------
 * Phase: FERPA board report + counselor triage + focus mode
 * ----------------------------------------------------------------------- */

/** MTSS risk tier on a counselor_triage_queue ticket. */
export type RiskTier = "tier_1" | "tier_2" | "tier_3";

/** Lifecycle status of a counselor_triage_queue ticket. */
export type TriageStatus = "pending" | "assigned" | "resolved";

/** Raw row shape of public.counselor_triage_queue. */
export interface CounselorTriageRow {
  id: string;
  org_id: string;
  student_id: string;
  risk_tier: RiskTier;
  status: TriageStatus;
  assigned_counselor_id: string | null;
  trigger_reason: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

/** Enriched row returned by RPC staff_list_triage_queue (joins profiles). */
export interface CounselorTriageRowEnriched extends CounselorTriageRow {
  student_full_name: string;
  student_email: string;
  student_grade_level: string | null;
  assigned_counselor_name: string | null;
}

/** Row returned by RPC get_anonymized_weekly_trends. */
export interface BoardReportRow {
  org_id: string;
  grade_level: string;
  week_start: string;
  avg_mood: number | null;
  avg_stress: number | null;
  avg_sleep: number | null;
  sample_size: number;
  data_classification: "aggregated_deidentified";
}

/** Row returned by RPC get_anonymized_weekly_spiritual_trends. */
export interface BoardReportSpiritualRow {
  org_id: string;
  grade_level: string;
  week_start: string;
  avg_intensity: number | null;
  consolation_count: number;
  desolation_count: number;
  sample_size: number;
  data_classification: "aggregated_deidentified";
}

/** Shape of the formatted board-report payload (lib/boardReportExport.js). */
export interface FormattedBoardReportCohort {
  grade_level: string;
  week_start: string;
  avg_mood: number | null;
  avg_stress: number | null;
  avg_sleep: number | null;
  sample_size: number;
}

export interface FormattedBoardReport {
  school: string;
  reporting_period: {
    start: string;
    end: string;
    weeks_included: number;
  };
  generated_at: string;
  data_classification: "aggregated_deidentified";
  ferpa_notice: string;
  k_anonymity_floor: number;
  grade_cohorts: FormattedBoardReportCohort[];
  spiritual_cohorts: Array<{
    grade_level: string;
    week_start: string;
    avg_intensity: number | null;
    consolation_count: number;
    desolation_count: number;
    sample_size: number;
  }>;
}

/** Reason a focus session was forfeited (mirrors SQL CHECK list). */
export type FocusForfeitReason =
  | "app_backgrounded"
  | "app_inactive"
  | "user_ended_early"
  | "system_crash";

/** Raw row shape of public.focus_sessions. */
export interface FocusSessionRow {
  id: string;
  student_id: string;
  org_id: string | null;
  duration_minutes: number;
  points_earned: number;
  completed_successfully: boolean;
  forfeit_reason: FocusForfeitReason | null;
  started_at: string;
  ended_at: string | null;
}

/** Payload returned by RPC increment_student_rewards_points. */
export interface FocusRewardResult {
  ok: boolean;
  already_awarded: boolean;
  points: number;
  total_focus_points?: number;
}

/** -------------------------------------------------------------------------
 * Grad at Grad (Profile of the Graduate at Graduation) pillar tracking
 * ----------------------------------------------------------------------- */

export type GradAtGradPillar =
  | "open_to_growth"
  | "intellectually_competent"
  | "religious"
  | "loving"
  | "committed_to_justice";

export interface GradAtGradLogRow {
  id: string;
  student_id: string;
  org_id: string;
  pillar: GradAtGradPillar;
  source_activity: string;
  source_record_id: string | null;
  points_allocated: number;
  created_at: string;
}

/** Row returned by RPC get_student_grad_at_grad_summary. */
export interface GradAtGradPillarSummary {
  pillar: GradAtGradPillar;
  total_points: number;
}

/** -------------------------------------------------------------------------
 * JSN accreditation aggregates (org-level, de-identified)
 * ----------------------------------------------------------------------- */

export interface JsnAccreditationMetricsRow {
  org_id: string;
  academic_year_start: string;
  academic_year_end: string;
  total_communal_service_hours: number;
  daily_examen_adoption_pct: number | null;
  prayer_wall_engagements: number;
  enrolled_students: number;
  data_classification: "aggregated_deidentified";
}

/** -------------------------------------------------------------------------
 * Reflective disciplinary portal
 * ----------------------------------------------------------------------- */

export type AdminAssignmentType = "reflective_journal" | "restorative_plan";

export type AdminAssignmentStatus = "assigned" | "submitted" | "approved_by_admin";

export interface AdministrativeAssignmentRow {
  id: string;
  student_id: string;
  org_id: string;
  assigned_by: string;
  assignment_type: AdminAssignmentType;
  prompt_text: string;
  student_response: string | null;
  status: AdminAssignmentStatus;
  due_at: string;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  approved_at: string | null;
}

/** Enriched row from RPC staff_list_administrative_assignments. */
export interface AdministrativeAssignmentEnriched extends AdministrativeAssignmentRow {
  student_full_name: string;
  student_email: string;
  assigned_by_name: string | null;
}
