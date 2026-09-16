
-- 1. email_unsubscribe_tokens — scope policies to service_role explicitly
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;

CREATE POLICY "Service role reads tokens"
  ON public.email_unsubscribe_tokens
  FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Service role inserts tokens"
  ON public.email_unsubscribe_tokens
  FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role updates tokens"
  ON public.email_unsubscribe_tokens
  FOR UPDATE TO service_role
  USING (true)
  WITH CHECK (true);

-- Explicitly deny any authenticated/anon access (defence in depth)
CREATE POLICY "Deny authenticated access to tokens"
  ON public.email_unsubscribe_tokens
  AS RESTRICTIVE
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 2. payments — block all writes from authenticated/anon; service_role keeps full access (RLS bypassed)
CREATE POLICY "Deny client writes on payments"
  ON public.payments
  AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny client updates on payments"
  ON public.payments
  AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on payments"
  ON public.payments
  AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);

-- 3. payouts — same write lockdown
CREATE POLICY "Deny client writes on payouts"
  ON public.payouts
  AS RESTRICTIVE
  FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Deny client updates on payouts"
  ON public.payouts
  AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on payouts"
  ON public.payouts
  AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);

-- 4. vehicle_rentals — add UPDATE/DELETE lockdown. Mutations go through server fns w/ service_role.
CREATE POLICY "Deny client updates on vehicle_rentals"
  ON public.vehicle_rentals
  AS RESTRICTIVE
  FOR UPDATE TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny client deletes on vehicle_rentals"
  ON public.vehicle_rentals
  AS RESTRICTIVE
  FOR DELETE TO authenticated, anon
  USING (false);
