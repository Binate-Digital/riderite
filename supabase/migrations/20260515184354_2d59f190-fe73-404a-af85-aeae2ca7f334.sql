
-- Trip payment fields
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS base_fare_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_cents integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_trips_open_requests
  ON public.trips (status, paid) WHERE driver_id IS NULL;

-- Payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending',
  stripe_session_id text UNIQUE,
  stripe_payment_intent_id text,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_trip ON public.payments(trip_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Riders read own payments" ON public.payments;
CREATE POLICY "Riders read own payments" ON public.payments
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins read all payments" ON public.payments;
CREATE POLICY "Admins read all payments" ON public.payments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_payments_touch
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Driver dispatch policies
DROP POLICY IF EXISTS "Drivers view open requests" ON public.trips;
CREATE POLICY "Drivers view open requests" ON public.trips
  FOR SELECT TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'requested'
    AND paid = true
    AND has_role(auth.uid(), 'driver'::app_role)
  );

DROP POLICY IF EXISTS "Drivers accept open requests" ON public.trips;
CREATE POLICY "Drivers accept open requests" ON public.trips
  FOR UPDATE TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'requested'
    AND paid = true
    AND has_role(auth.uid(), 'driver'::app_role)
  )
  WITH CHECK (driver_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
