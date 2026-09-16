
CREATE TYPE public.trip_status AS ENUM ('requested','accepted','in_progress','completed','cancelled');

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id uuid NOT NULL,
  driver_id uuid,
  vehicle_type vehicle_type NOT NULL,
  pickup_address text NOT NULL,
  destination_address text NOT NULL,
  status trip_status NOT NULL DEFAULT 'requested',
  fare_cents integer NOT NULL DEFAULT 0,
  distance_miles numeric(6,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 0,
  rating smallint,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX trips_rider_idx ON public.trips(rider_id, requested_at DESC);
CREATE INDEX trips_driver_idx ON public.trips(driver_id, requested_at DESC);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Riders view own trips" ON public.trips
  FOR SELECT TO authenticated USING (auth.uid() = rider_id);

CREATE POLICY "Riders create own trips" ON public.trips
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = rider_id);

CREATE POLICY "Riders cancel own trips" ON public.trips
  FOR UPDATE TO authenticated USING (auth.uid() = rider_id);

CREATE POLICY "Drivers view assigned trips" ON public.trips
  FOR SELECT TO authenticated USING (auth.uid() = driver_id);

CREATE POLICY "Drivers update assigned trips" ON public.trips
  FOR UPDATE TO authenticated USING (auth.uid() = driver_id);

CREATE POLICY "Admins view all trips" ON public.trips
  FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trips_touch_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
