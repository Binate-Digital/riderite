
-- 1) Tighten trips driver UPDATE policy: prevent driver_id reassignment; column-level enforcement remains via existing trigger enforce_trip_update_columns
DROP POLICY IF EXISTS "Drivers update assigned trips" ON public.trips;
CREATE POLICY "Drivers update assigned trips" ON public.trips
  FOR UPDATE
  USING (auth.uid() = driver_id)
  WITH CHECK (auth.uid() = driver_id);

-- Ensure trigger is attached (idempotent)
DROP TRIGGER IF EXISTS trg_enforce_trip_update_columns ON public.trips;
CREATE TRIGGER trg_enforce_trip_update_columns
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trip_update_columns();

-- 2) driver_kyc: prevent self-approval via WITH CHECK
DROP POLICY IF EXISTS "Drivers update own pending kyc" ON public.driver_kyc;
CREATE POLICY "Drivers update own pending kyc" ON public.driver_kyc
  FOR UPDATE
  USING (auth.uid() = user_id AND kyc_status = 'pending')
  WITH CHECK (
    auth.uid() = user_id
    AND kyc_status = 'pending'
    AND bg_status = 'pending'
  );

-- 3) notifications: remove broad UPDATE policy; add SECURITY DEFINER RPC for marking read
DROP POLICY IF EXISTS "Users mark own notifications read" ON public.notifications;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE public.notifications
    SET read_at = COALESCE(read_at, now())
    WHERE user_id = v_uid
      AND id = ANY(_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated;

-- 4) promo_codes: remove broad SELECT; lookups happen server-side via service role
DROP POLICY IF EXISTS "auth read active promos" ON public.promo_codes;
REVOKE SELECT ON public.promo_codes FROM anon, authenticated;

-- 5) Revoke EXECUTE on SECURITY DEFINER fns from anon/public to satisfy linter
REVOKE EXECUTE ON FUNCTION public.accept_trip_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_trip_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_open_trip_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_trip_requests() TO authenticated;
