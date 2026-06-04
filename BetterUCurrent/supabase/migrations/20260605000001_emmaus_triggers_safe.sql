-- Emmaus: do not roll back companion_requests insert if prayer wall or counselor_alerts fail.

CREATE OR REPLACE FUNCTION public.companion_after_insert_silent_prayer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_body text;
  v_cat text;
BEGIN
  IF NEW.support_type <> 'silent_prayer_only' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_cat := replace(NEW.category::text, '_', ' ');
    v_body := coalesce(nullif(trim(NEW.student_notes), ''), '(Silent prayer — no additional notes)');
    v_body := '[Emmaus · ' || v_cat || '] ' || v_body;

    INSERT INTO public.prayer_intentions (
      profile_id,
      org_id,
      body,
      share_anonymous,
      feed_approved,
      visible_on_wall
    ) VALUES (
      NEW.student_id,
      NEW.org_id,
      v_body,
      true,
      false,
      false
    );

    UPDATE public.companion_requests
    SET
      status = 'resolved',
      resolved_at = now(),
      updated_at = now()
    WHERE id = NEW.id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'companion_after_insert_silent_prayer failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.companion_after_insert_urgent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_email text;
BEGIN
  IF NEW.urgency_tier <> 'urgent_today' THEN
    RETURN NEW;
  END IF;
  IF NEW.support_type = 'silent_prayer_only' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT coalesce(p.full_name, 'Student'), coalesce(p.email, '')
    INTO v_name, v_email
    FROM public.profiles p
    WHERE p.id = NEW.student_id;

    INSERT INTO public.counselor_alerts (
      org_id,
      student_id,
      student_name,
      student_email,
      status
    ) VALUES (
      NEW.org_id,
      NEW.student_id,
      v_name,
      v_email,
      'pending'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'companion_after_insert_urgent failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
