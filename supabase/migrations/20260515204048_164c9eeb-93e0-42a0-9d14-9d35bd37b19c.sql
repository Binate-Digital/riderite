
-- Allow admins to read all profiles
CREATE POLICY "Admins read all profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Pricing config (single row)
CREATE TABLE public.pricing_config (
  id smallint PRIMARY KEY DEFAULT 1,
  sedan_base_cents integer NOT NULL DEFAULT 300,
  sedan_per_mile_cents integer NOT NULL DEFAULT 150,
  sedan_per_min_cents integer NOT NULL DEFAULT 30,
  suv_base_cents integer NOT NULL DEFAULT 500,
  suv_per_mile_cents integer NOT NULL DEFAULT 225,
  suv_per_min_cents integer NOT NULL DEFAULT 40,
  truck_base_cents integer NOT NULL DEFAULT 700,
  truck_per_mile_cents integer NOT NULL DEFAULT 300,
  truck_per_min_cents integer NOT NULL DEFAULT 50,
  booking_fee_cents integer NOT NULL DEFAULT 250,
  minimum_fare_cents integer NOT NULL DEFAULT 700,
  service_fee_bps integer NOT NULL DEFAULT 1500,
  tax_bps integer NOT NULL DEFAULT 700,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT pricing_singleton CHECK (id = 1)
);

INSERT INTO public.pricing_config (id) VALUES (1);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read pricing"
ON public.pricing_config
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins update pricing"
ON public.pricing_config
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER touch_pricing_config_updated_at
BEFORE UPDATE ON public.pricing_config
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
