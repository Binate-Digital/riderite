
-- 1. Account status enum + columns on driver_profiles
CREATE TYPE public.driver_account_status AS ENUM ('active', 'grace_period', 'suspended', 'under_review');

ALTER TABLE public.driver_profiles
  ADD COLUMN account_status public.driver_account_status NOT NULL DEFAULT 'active',
  ADD COLUMN suspension_reason text,
  ADD COLUMN suspended_at timestamptz;

-- 2. Connect accounts table
CREATE TABLE public.connect_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_account_id text UNIQUE NOT NULL,
  charges_enabled boolean NOT NULL DEFAULT false,
  payouts_enabled boolean NOT NULL DEFAULT false,
  details_submitted boolean NOT NULL DEFAULT false,
  requirements_due jsonb NOT NULL DEFAULT '[]'::jsonb,
  disabled_reason text,
  country text NOT NULL DEFAULT 'US',
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.connect_accounts TO authenticated;
GRANT ALL ON public.connect_accounts TO service_role;
ALTER TABLE public.connect_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own connect account" ON public.connect_accounts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own connect account" ON public.connect_accounts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admins read all connect accounts" ON public.connect_accounts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER connect_accounts_touch BEFORE UPDATE ON public.connect_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Driver subscriptions
CREATE TABLE public.driver_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id text UNIQUE,
  stripe_customer_id text,
  status text NOT NULL DEFAULT 'incomplete',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  grace_period_ends_at timestamptz,
  outstanding_cents integer NOT NULL DEFAULT 0,
  late_fee_cents integer NOT NULL DEFAULT 0,
  environment text NOT NULL DEFAULT 'sandbox',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.driver_subscriptions TO authenticated;
GRANT ALL ON public.driver_subscriptions TO service_role;
ALTER TABLE public.driver_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own subscription" ON public.driver_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all subscriptions" ON public.driver_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER driver_subscriptions_touch BEFORE UPDATE ON public.driver_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Subscription invoices
CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_invoice_id text UNIQUE NOT NULL,
  amount_due_cents integer NOT NULL DEFAULT 0,
  amount_paid_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  hosted_invoice_url text,
  invoice_pdf text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_invoices_user ON public.subscription_invoices(user_id, created_at DESC);

GRANT SELECT ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own invoices" ON public.subscription_invoices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "admins read all invoices" ON public.subscription_invoices
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Payouts (ride fare splits)
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_fare_cents integer NOT NULL,
  driver_cut_cents integer NOT NULL,
  company_cut_cents integer NOT NULL,
  stripe_transfer_id text UNIQUE,
  stripe_destination_account text,
  status text NOT NULL DEFAULT 'pending',
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payouts_driver ON public.payouts(driver_id, created_at DESC);
CREATE INDEX idx_payouts_trip ON public.payouts(trip_id);

GRANT SELECT ON public.payouts TO authenticated;
GRANT ALL ON public.payouts TO service_role;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers read own payouts" ON public.payouts
  FOR SELECT TO authenticated USING (auth.uid() = driver_id);
CREATE POLICY "admins read all payouts" ON public.payouts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER payouts_touch BEFORE UPDATE ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6. Vehicle rental marketplace
CREATE TYPE public.vehicle_listing_status AS ENUM ('draft', 'active', 'paused', 'removed');
CREATE TYPE public.vehicle_rental_status AS ENUM ('pending', 'confirmed', 'active', 'completed', 'cancelled');

CREATE TABLE public.vehicle_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  make text NOT NULL,
  model text NOT NULL,
  year integer NOT NULL,
  vehicle_type public.vehicle_type NOT NULL,
  daily_rate_cents integer NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  photos text[] NOT NULL DEFAULT '{}',
  seats integer NOT NULL DEFAULT 5,
  transmission text NOT NULL DEFAULT 'automatic',
  features text[] NOT NULL DEFAULT '{}',
  status public.vehicle_listing_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_listings_status ON public.vehicle_listings(status, created_at DESC);
CREATE INDEX idx_vehicle_listings_owner ON public.vehicle_listings(owner_id);

GRANT SELECT ON public.vehicle_listings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vehicle_listings TO authenticated;
GRANT ALL ON public.vehicle_listings TO service_role;
ALTER TABLE public.vehicle_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active listings" ON public.vehicle_listings
  FOR SELECT USING (status = 'active' OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "owners insert listings" ON public.vehicle_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners update own listings" ON public.vehicle_listings
  FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owners delete own listings" ON public.vehicle_listings
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER vehicle_listings_touch BEFORE UPDATE ON public.vehicle_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.vehicle_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.vehicle_listings(id) ON DELETE RESTRICT,
  renter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  owner_payout_cents integer NOT NULL,
  stripe_payment_intent_id text UNIQUE,
  stripe_session_id text UNIQUE,
  stripe_transfer_id text UNIQUE,
  status public.vehicle_rental_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_vehicle_rentals_renter ON public.vehicle_rentals(renter_id, created_at DESC);
CREATE INDEX idx_vehicle_rentals_owner ON public.vehicle_rentals(owner_id, created_at DESC);
CREATE INDEX idx_vehicle_rentals_listing ON public.vehicle_rentals(listing_id, start_date);

GRANT SELECT, INSERT, UPDATE ON public.vehicle_rentals TO authenticated;
GRANT ALL ON public.vehicle_rentals TO service_role;
ALTER TABLE public.vehicle_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "renters read own rentals" ON public.vehicle_rentals
  FOR SELECT TO authenticated USING (auth.uid() = renter_id OR auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "renters create rentals" ON public.vehicle_rentals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = renter_id);

CREATE TRIGGER vehicle_rentals_touch BEFORE UPDATE ON public.vehicle_rentals
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 7. Driver eligibility helper and accept-trip guard
CREATE OR REPLACE FUNCTION public.can_driver_accept_trips(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'driver'::app_role)
    AND COALESCE((SELECT account_status FROM public.driver_profiles WHERE user_id = _user_id), 'suspended') = 'active'
    AND COALESCE((SELECT status IN ('active','trialing') FROM public.driver_subscriptions WHERE user_id = _user_id), false)
    AND COALESCE((SELECT payouts_enabled FROM public.connect_accounts WHERE user_id = _user_id), false);
$$;

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
  IF v_driver IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.has_role(v_driver, 'driver'::app_role) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF NOT public.can_driver_accept_trips(v_driver) THEN
    RAISE EXCEPTION 'Driver not eligible: subscription, account status, or payouts not active';
  END IF;

  UPDATE public.trips t
     SET driver_id = v_driver, status = 'accepted'::trip_status
   WHERE t.id = _trip_id
     AND t.driver_id IS NULL
     AND t.status = 'requested'::trip_status
     AND (t.paid = true OR t.payment_method IN ('cash','venmo','zelle'))
  RETURNING t.id INTO v_updated;

  IF v_updated IS NULL THEN RAISE EXCEPTION 'Trip not available'; END IF;
  RETURN v_updated;
END;
$$;
