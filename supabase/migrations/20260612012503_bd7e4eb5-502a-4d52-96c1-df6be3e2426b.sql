
-- Fix policy roles: restrict to authenticated only
DROP POLICY IF EXISTS "Drivers update own pending kyc" ON public.driver_kyc;
CREATE POLICY "Drivers update own pending kyc"
  ON public.driver_kyc
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND kyc_status = 'pending')
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Drivers update assigned trips" ON public.trips;
CREATE POLICY "Drivers update assigned trips"
  ON public.trips
  FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

-- promo_codes has RLS enabled but no policies: lock it down (admin-only via service role / has_role)
CREATE POLICY "Admins can view promo codes"
  ON public.promo_codes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage promo codes"
  ON public.promo_codes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
