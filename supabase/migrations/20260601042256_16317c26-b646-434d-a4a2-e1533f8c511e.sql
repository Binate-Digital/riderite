-- 1) Trip accept: remove broad UPDATE policy, add SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Drivers accept open requests" ON public.trips;

CREATE OR REPLACE FUNCTION public.accept_trip_request(_trip_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver uuid := auth.uid();
  v_updated uuid;
BEGIN
  IF v_driver IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.has_role(v_driver, 'driver'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.trips t
     SET driver_id = v_driver,
         status = 'accepted'::trip_status
   WHERE t.id = _trip_id
     AND t.driver_id IS NULL
     AND t.status = 'requested'::trip_status
     AND (t.paid = true OR t.payment_method IN ('cash','venmo','zelle'))
  RETURNING t.id INTO v_updated;

  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'Trip not available';
  END IF;

  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_trip_request(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_trip_request(uuid) TO authenticated;

-- 2) Defense-in-depth WITH CHECK on rider cancel policy
DROP POLICY IF EXISTS "Riders cancel own trips" ON public.trips;
CREATE POLICY "Riders cancel own trips"
ON public.trips
FOR UPDATE
TO authenticated
USING (auth.uid() = rider_id)
WITH CHECK (auth.uid() = rider_id);

-- 3) Driver profiles: block self-updates of approval/credential fields via trigger
CREATE OR REPLACE FUNCTION public.enforce_driver_profile_update_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
  THEN
    RAISE EXCEPTION 'Not authorized to modify protected driver profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_driver_profile_update_columns_trg ON public.driver_profiles;
CREATE TRIGGER enforce_driver_profile_update_columns_trg
BEFORE UPDATE ON public.driver_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_driver_profile_update_columns();

-- 4) Storage: explicit restrictive policies on email-assets bucket
DROP POLICY IF EXISTS "email-assets service insert" ON storage.objects;
DROP POLICY IF EXISTS "email-assets service update" ON storage.objects;
DROP POLICY IF EXISTS "email-assets service delete" ON storage.objects;

CREATE POLICY "email-assets service insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'email-assets' AND auth.role() = 'service_role');

CREATE POLICY "email-assets service update"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'email-assets' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'email-assets' AND auth.role() = 'service_role');

CREATE POLICY "email-assets service delete"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'email-assets' AND auth.role() = 'service_role');
