
-- KYC status enums
CREATE TYPE public.kyc_status AS ENUM ('pending','in_review','verified','rejected');
CREATE TYPE public.bg_check_status AS ENUM ('pending','clear','consider','rejected');

-- Extend driver_profiles with FL-required fields
ALTER TABLE public.driver_profiles
  ADD COLUMN date_of_birth date,
  ADD COLUMN address_line1 text,
  ADD COLUMN address_city text,
  ADD COLUMN address_state text,
  ADD COLUMN address_zip text,
  ADD COLUMN dl_number text,
  ADD COLUMN dl_state text,
  ADD COLUMN dl_expires_on date,
  ADD COLUMN insurance_carrier text,
  ADD COLUMN insurance_policy_number text,
  ADD COLUMN insurance_expires_on date,
  ADD COLUMN registration_expires_on date,
  ADD COLUMN vin text;

-- KYC table
CREATE TABLE public.driver_kyc (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ssn_last4 text NOT NULL CHECK (ssn_last4 ~ '^[0-9]{4}$'),
  vendor text NOT NULL DEFAULT 'mock',
  vendor_kyc_id text,
  kyc_status public.kyc_status NOT NULL DEFAULT 'pending',
  bg_status public.bg_check_status NOT NULL DEFAULT 'pending',
  fcra_consent_at timestamptz NOT NULL,
  mvr_consent_at timestamptz NOT NULL,
  sex_offender_attestation_at timestamptz NOT NULL,
  disqualifying_offense_attestation_at timestamptz NOT NULL,
  tos_version text NOT NULL,
  tos_accepted_at timestamptz NOT NULL,
  consent_ip text,
  reviewer_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.driver_kyc ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers read own kyc" ON public.driver_kyc
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all kyc" ON public.driver_kyc
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers insert own kyc" ON public.driver_kyc
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Drivers update own pending kyc" ON public.driver_kyc
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND kyc_status = 'pending')
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update all kyc" ON public.driver_kyc
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER driver_kyc_touch BEFORE UPDATE ON public.driver_kyc
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
