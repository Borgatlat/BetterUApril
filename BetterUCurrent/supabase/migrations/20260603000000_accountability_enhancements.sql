-- Accountability partners v2: weekly reminders, in-person meetup rhythm, check-in dedupe.

ALTER TABLE public.accountability_partners
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meetup_day text CHECK (
    meetup_day IS NULL OR meetup_day IN (
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    )
  ),
  ADD COLUMN IF NOT EXISTS meetup_hour_local smallint CHECK (
    meetup_hour_local IS NULL OR (meetup_hour_local >= 0 AND meetup_hour_local <= 23)
  ),
  ADD COLUMN IF NOT EXISTS meetup_minute_local smallint NOT NULL DEFAULT 0 CHECK (
    meetup_minute_local >= 0 AND meetup_minute_local <= 59
  ),
  ADD COLUMN IF NOT EXISTS meetup_spot text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meetup_notes text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.accountability_partners.meetup_spot IS
  'Suggested in-person meetup place (cafeteria, library, chapel courtyard, etc.).';
COMMENT ON COLUMN public.accountability_partners.meetup_notes IS
  'Free-text plan for the in-person chat (what to discuss, how long, etc.).';

-- Optional: which guided prompts were used on a check-in (analytics / UX only).
ALTER TABLE public.accountability_check_ins
  ADD COLUMN IF NOT EXISTS guided_prompt_ids text[] NOT NULL DEFAULT '{}';

-- Map text day → Postgres DOW (0 = Sunday).
CREATE OR REPLACE FUNCTION public.accountability_day_to_dow(p_day text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(p_day))
    WHEN 'sunday' THEN 0
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    ELSE NULL
  END;
$$;

-- Monday of the current week (UTC), aligned with app getWeekStartDate().
CREATE OR REPLACE FUNCTION public.accountability_current_week_start()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (current_date - ((EXTRACT(DOW FROM current_date)::int + 6) % 7))::date;
$$;

-- Send in-app weekly check-in reminders for auth.uid() (call on accountability hub open).
-- Dedupes: max one reminder per partnership per week.
CREATE OR REPLACE FUNCTION public.send_my_accountability_check_in_reminders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_week date;
  v_sent integer := 0;
  r record;
  v_partner_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  v_week := accountability_current_week_start();

  FOR r IN
    SELECT
      ap.id AS partnership_id,
      CASE WHEN ap.user_id = v_me THEN ap.partner_id ELSE ap.user_id END AS partner_id,
      ap.check_in_day,
      ap.reminder_hour_utc
    FROM accountability_partners ap
    WHERE ap.reminders_enabled = true
      AND (ap.user_id = v_me OR ap.partner_id = v_me)
      AND accountability_day_to_dow(ap.check_in_day) = EXTRACT(DOW FROM current_date)::integer
      AND EXTRACT(HOUR FROM (now() AT TIME ZONE 'UTC')) >= COALESCE(ap.reminder_hour_utc, 18)
      AND NOT EXISTS (
        SELECT 1 FROM accountability_check_ins ci
        WHERE ci.partnership_id = ap.id
          AND ci.user_id = v_me
          AND ci.week_start_date = v_week
          AND ci.status = 'submitted'
      )
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.user_id = v_me
          AND n.type = 'accountability_check_in_reminder'
          AND (n.data->>'partnership_id')::uuid = ap.id
          AND (n.data->>'week_start_date') = v_week::text
          AND n.created_at > (now() - interval '8 days')
      )
  LOOP
    SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), 'your partner')
    INTO v_partner_name
    FROM profiles
    WHERE id = r.partner_id;

    PERFORM create_notification(
      v_me,
      'accountability_check_in_reminder',
      'Weekly accountability check-in',
      'Time for your check-in with ' || v_partner_name || '. Tap to reflect and send an update.',
      jsonb_build_object(
        'partnership_id', r.partnership_id,
        'partner_id', r.partner_id,
        'week_start_date', v_week
      ),
      true,
      'navigate',
      jsonb_build_object(
        'screen', '/accountability/check-in',
        'params', jsonb_build_object(
          'partnershipId', r.partnership_id,
          'partnerId', r.partner_id
        )
      ),
      3,
      NULL
    );
    v_sent := v_sent + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'sent', v_sent, 'week_start', v_week);
END;
$$;

REVOKE ALL ON FUNCTION public.send_my_accountability_check_in_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_my_accountability_check_in_reminders() TO authenticated;

-- Update partnership rhythm (check-in day, reminder hour, meetup plan).
CREATE OR REPLACE FUNCTION public.update_accountability_partnership_rhythm(
  p_partnership_id uuid,
  p_check_in_day text DEFAULT NULL,
  p_reminder_hour_utc integer DEFAULT NULL,
  p_reminders_enabled boolean DEFAULT NULL,
  p_meetup_day text DEFAULT NULL,
  p_meetup_hour_local integer DEFAULT NULL,
  p_meetup_minute_local integer DEFAULT NULL,
  p_meetup_spot text DEFAULT NULL,
  p_meetup_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  IF p_check_in_day IS NOT NULL AND accountability_day_to_dow(p_check_in_day) IS NULL THEN
    RAISE EXCEPTION 'invalid check_in_day';
  END IF;

  IF p_meetup_day IS NOT NULL AND trim(p_meetup_day) <> '' AND accountability_day_to_dow(p_meetup_day) IS NULL THEN
    RAISE EXCEPTION 'invalid meetup_day';
  END IF;

  UPDATE accountability_partners ap
  SET
    check_in_day = COALESCE(p_check_in_day, ap.check_in_day),
    reminder_hour_utc = COALESCE(p_reminder_hour_utc, ap.reminder_hour_utc),
    reminders_enabled = COALESCE(p_reminders_enabled, ap.reminders_enabled),
    meetup_day = CASE
      WHEN p_meetup_day IS NOT NULL AND trim(p_meetup_day) = '' THEN NULL
      WHEN p_meetup_day IS NOT NULL THEN p_meetup_day
      ELSE ap.meetup_day
    END,
    meetup_hour_local = CASE
      WHEN p_meetup_day IS NOT NULL AND trim(p_meetup_day) = '' THEN NULL
      WHEN p_meetup_hour_local IS NOT NULL THEN p_meetup_hour_local
      ELSE ap.meetup_hour_local
    END,
    meetup_minute_local = COALESCE(p_meetup_minute_local, ap.meetup_minute_local),
    meetup_spot = COALESCE(p_meetup_spot, ap.meetup_spot),
    meetup_notes = COALESCE(p_meetup_notes, ap.meetup_notes)
  WHERE ap.id = p_partnership_id
    AND (ap.user_id = v_me OR ap.partner_id = v_me);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'partnership not found';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.update_accountability_partnership_rhythm(uuid, text, integer, boolean, text, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_accountability_partnership_rhythm(uuid, text, integer, boolean, text, integer, integer, text, text) TO authenticated;
