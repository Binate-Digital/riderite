
CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  percent_off int CHECK (percent_off IS NULL OR (percent_off > 0 AND percent_off <= 100)),
  amount_off_cents int CHECK (amount_off_cents IS NULL OR amount_off_cents > 0),
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_uses int,
  uses int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (percent_off IS NOT NULL OR amount_off_cents IS NOT NULL)
);
GRANT SELECT ON public.promo_codes TO authenticated;
GRANT ALL ON public.promo_codes TO service_role;
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read active promos" ON public.promo_codes
  FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.promo_codes (code, percent_off, amount_off_cents, active)
VALUES ('WELCOME10', 10, NULL, true),
       ('RIDE5', NULL, 500, true);

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS discount_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_fee_cents int NOT NULL DEFAULT 0;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS refund_cents int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
