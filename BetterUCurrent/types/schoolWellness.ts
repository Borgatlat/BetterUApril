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
export interface Organization {
  id: string;
  name: string;
  domain_lock: string;
  emergency_contacts: EmergencyContact[];
  created_at: string;
}

export interface UserProfileSchoolFields {
  account_type: AccountType;
  org_id: string | null;
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
