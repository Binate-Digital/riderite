
-- Add payment_method to trips and payments
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'card'
    CHECK (payment_method IN ('card','cashapp','paypal','cash','venmo','zelle'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'card'
    CHECK (payment_method IN ('card','cashapp','paypal','cash','venmo','zelle'));

-- Drivers can also see/accept offline-pay trips that are unpaid
DROP POLICY IF EXISTS "Drivers view open requests" ON public.trips;
CREATE POLICY "Drivers view open requests"
  ON public.trips FOR SELECT TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'requested'::trip_status
    AND (paid = true OR payment_method IN ('cash','venmo','zelle'))
    AND has_role(auth.uid(), 'driver'::app_role)
  );

DROP POLICY IF EXISTS "Drivers accept open requests" ON public.trips;
CREATE POLICY "Drivers accept open requests"
  ON public.trips FOR UPDATE TO authenticated
  USING (
    driver_id IS NULL
    AND status = 'requested'::trip_status
    AND (paid = true OR payment_method IN ('cash','venmo','zelle'))
    AND has_role(auth.uid(), 'driver'::app_role)
  )
  WITH CHECK (driver_id = auth.uid());
