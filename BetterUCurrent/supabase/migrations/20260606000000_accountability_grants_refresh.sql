-- Refresh accountability tables, grants, and add_accountability_partner RPC (safe to re-run).

CREATE TABLE IF NOT EXISTS public.accountability_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  check_in_day text NOT NULL DEFAULT 'sunday' CHECK (
    check_in_day IN ('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday')
  ),
  reminder_hour_utc integer NOT NULL DEFAULT 18 CHECK (reminder_hour_utc >= 0 AND reminder_hour_utc <= 23),
  reminders_enabled boolean NOT NULL DEFAULT true,
  meetup_day text CHECK (
    meetup_day IS NULL OR meetup_day IN (
      'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
    )
  ),
  meetup_hour_local smallint CHECK (
    meetup_hour_local IS NULL OR (meetup_hour_local >= 0 AND meetup_hour_local <= 23)
  ),
  meetup_minute_local smallint NOT NULL DEFAULT 0 CHECK (
    meetup_minute_local >= 0 AND meetup_minute_local <= 59
  ),
  meetup_spot text NOT NULL DEFAULT '',
  meetup_notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, partner_id),
  CHECK (user_id <> partner_id)
);

ALTER TABLE public.accountability_partners
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meetup_day text,
  ADD COLUMN IF NOT EXISTS meetup_hour_local smallint,
  ADD COLUMN IF NOT EXISTS meetup_minute_local smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS meetup_spot text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS meetup_notes text NOT NULL DEFAULT '';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountability_partners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accountability_partners TO service_role;

CREATE OR REPLACE FUNCTION public.add_accountability_partner(p_partner_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_partnership_id uuid;
  v_sender_name text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  IF p_partner_id IS NULL OR p_partner_id = v_me THEN
    RAISE EXCEPTION 'invalid partner';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_partner_id) THEN
    RAISE EXCEPTION 'partner profile not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM friends f
    WHERE f.status = 'accepted'
      AND (
        (f.user_id = v_me AND f.friend_id = p_partner_id)
        OR (f.user_id = p_partner_id AND f.friend_id = v_me)
      )
  ) THEN
    RAISE EXCEPTION 'user must be an accepted friend first';
  END IF;

  IF EXISTS (
    SELECT 1 FROM accountability_partners ap
    WHERE (ap.user_id = v_me AND ap.partner_id = p_partner_id)
       OR (ap.user_id = p_partner_id AND ap.partner_id = v_me)
  ) THEN
    RAISE EXCEPTION 'already accountability partners';
  END IF;

  INSERT INTO accountability_partners (user_id, partner_id)
  VALUES (v_me, p_partner_id)
  RETURNING id INTO v_partnership_id;

  SELECT COALESCE(NULLIF(trim(full_name), ''), NULLIF(trim(username), ''), 'A friend')
  INTO v_sender_name
  FROM profiles
  WHERE id = v_me;

  BEGIN
    PERFORM create_notification(
      p_partner_id,
      'accountability_partner_request',
      'Accountability Partner Request',
      v_sender_name || ' wants to be your accountability partner for weekly check-ins.',
      jsonb_build_object('partnership_id', v_partnership_id, 'sender_id', v_me),
      true,
      NULL,
      '{}'::jsonb,
      3,
      NULL
    );
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE 'accountability partner notification skipped: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_partnership_id,
    'user_id', v_me,
    'partner_id', p_partner_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_accountability_partner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_accountability_partner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_accountability_partner(uuid) TO service_role;
