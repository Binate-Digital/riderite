DROP POLICY IF EXISTS "Drivers update own pending kyc" ON public.driver_kyc;
CREATE POLICY "Drivers update own pending kyc"
  ON public.driver_kyc
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND kyc_status = 'pending' AND bg_status = 'pending')
  WITH CHECK (user_id = auth.uid() AND kyc_status = 'pending' AND bg_status = 'pending');