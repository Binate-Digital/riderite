
-- 1) Trips column-level guard for non-admin users
CREATE OR REPLACE FUNCTION public.enforce_trip_update_columns()
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

  IF NEW.fare_cents IS DISTINCT FROM OLD.fare_cents
     OR NEW.base_fare_cents IS DISTINCT FROM OLD.base_fare_cents
     OR NEW.service_fee_cents IS DISTINCT FROM OLD.service_fee_cents
     OR NEW.tax_cents IS DISTINCT FROM OLD.tax_cents
     OR NEW.paid IS DISTINCT FROM OLD.paid
     OR NEW.stripe_payment_intent_id IS DISTINCT FROM OLD.stripe_payment_intent_id
     OR NEW.stripe_session_id IS DISTINCT FROM OLD.stripe_session_id
     OR NEW.rider_id IS DISTINCT FROM OLD.rider_id
     OR NEW.pickup_address IS DISTINCT FROM OLD.pickup_address
     OR NEW.destination_address IS DISTINCT FROM OLD.destination_address
     OR NEW.pickup_lat IS DISTINCT FROM OLD.pickup_lat
     OR NEW.pickup_lng IS DISTINCT FROM OLD.pickup_lng
     OR NEW.destination_lat IS DISTINCT FROM OLD.destination_lat
     OR NEW.destination_lng IS DISTINCT FROM OLD.destination_lng
     OR NEW.distance_miles IS DISTINCT FROM OLD.distance_miles
     OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
     OR NEW.vehicle_type IS DISTINCT FROM OLD.vehicle_type
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.requested_at IS DISTINCT FROM OLD.requested_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Not authorized to modify protected trip fields';
  END IF;

  -- Drivers may not set rating; riders only.
  IF auth.uid() = OLD.driver_id AND auth.uid() <> COALESCE(OLD.rider_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    IF NEW.rating IS DISTINCT FROM OLD.rating THEN
      RAISE EXCEPTION 'Drivers cannot modify rating';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_trip_update_columns ON public.trips;
CREATE TRIGGER trg_enforce_trip_update_columns
BEFORE UPDATE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.enforce_trip_update_columns();

-- 2) Lock down email queue helper functions: search_path + revoke EXECUTE from clients
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)               FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                        FROM PUBLIC, anon, authenticated;

-- 3) Restrict public email-assets bucket to specific logo only (block directory listing)
DROP POLICY IF EXISTS "Public read email-assets" ON storage.objects;
CREATE POLICY "Public read email-assets logo"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'email-assets' AND name = 'riderite-logo.jpeg');
