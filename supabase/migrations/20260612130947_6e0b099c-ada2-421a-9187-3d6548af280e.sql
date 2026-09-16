
-- 1) Revoke broad EXECUTE on SECURITY DEFINER functions, then grant narrowly.

-- Internal / trigger / server-only functions: no client should call these.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_trip_update_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_driver_profile_update_columns() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.monitoring_evaluate_alerts() FROM PUBLIC, anon, authenticated;

-- User-facing helpers: only signed-in users (never anon).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_driver_accept_trips(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_driver_accept_trips(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.accept_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_trip_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_open_trip_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_trip_requests() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.monitoring_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.monitoring_overview() TO authenticated;

-- 2) Strengthen driver profile update guard: also block account_status,
-- suspension_reason, suspended_at fields from non-admin self-edits.
CREATE OR REPLACE FUNCTION public.enforce_driver_profile_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean := false;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL THEN
    SELECT public.has_role(auth.uid(), 'admin'::app_role) INTO is_admin;
  END IF;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.status_reason IS DISTINCT FROM OLD.status_reason
     OR NEW.status_changed_at IS DISTINCT FROM OLD.status_changed_at
     OR NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Not authorized to modify protected driver profile fields';
  END IF;

  RETURN NEW;
END;
$function$;
