-- Drop the policy that exposed full trip rows (including addresses & coords) to all drivers
DROP POLICY IF EXISTS "Drivers view open requests" ON public.trips;

-- Safe RPC returning only fields a driver needs to decide whether to accept
CREATE OR REPLACE FUNCTION public.list_open_trip_requests()
RETURNS TABLE(
  id uuid,
  vehicle_type vehicle_type,
  distance_miles numeric,
  duration_minutes integer,
  fare_cents integer,
  payment_method text,
  paid boolean,
  requested_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id, t.vehicle_type, t.distance_miles, t.duration_minutes,
         t.fare_cents, t.payment_method, t.paid, t.requested_at
  FROM public.trips t
  WHERE t.driver_id IS NULL
    AND t.status = 'requested'
    AND (t.paid = true OR t.payment_method IN ('cash','venmo','zelle'))
    AND public.has_role(auth.uid(), 'driver'::app_role)
  ORDER BY t.requested_at ASC;
$$;

REVOKE ALL ON FUNCTION public.list_open_trip_requests() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_open_trip_requests() TO authenticated;