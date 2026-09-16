
-- ============ system_events ============
CREATE TABLE IF NOT EXISTS public.system_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'stripe_webhook' | 'payout' | 'subscription' | 'connect' | 'cron'
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'error' | 'critical'
  status text NOT NULL DEFAULT 'success', -- 'success' | 'failure'
  stripe_event_id text,
  reference_id text,
  user_id uuid,
  environment text,
  latency_ms integer,
  error_message text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS system_events_stripe_event_uidx
  ON public.system_events (stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS system_events_created_idx ON public.system_events (created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_cat_status_idx ON public.system_events (category, status, created_at DESC);
CREATE INDEX IF NOT EXISTS system_events_severity_idx ON public.system_events (severity, created_at DESC);

GRANT SELECT ON public.system_events TO authenticated;
GRANT ALL ON public.system_events TO service_role;

ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view system_events"
  ON public.system_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages system_events"
  ON public.system_events FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ============ monitoring_alerts ============
CREATE TABLE IF NOT EXISTS public.monitoring_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule text NOT NULL, -- 'webhook_error_rate' | 'payout_failure' | 'subscription_churn' | 'webhook_silence'
  severity text NOT NULL DEFAULT 'warning',
  bucket_key text NOT NULL, -- dedup key per rule per time bucket
  title text NOT NULL,
  message text,
  context jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS monitoring_alerts_bucket_uidx
  ON public.monitoring_alerts (rule, bucket_key);
CREATE INDEX IF NOT EXISTS monitoring_alerts_open_idx
  ON public.monitoring_alerts (resolved_at NULLS FIRST, created_at DESC);

GRANT SELECT, UPDATE ON public.monitoring_alerts TO authenticated;
GRANT ALL ON public.monitoring_alerts TO service_role;

ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view alerts"
  ON public.monitoring_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins ack alerts"
  ON public.monitoring_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages alerts"
  ON public.monitoring_alerts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============ Overview RPC ============
CREATE OR REPLACE FUNCTION public.monitoring_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  WITH windows AS (
    SELECT
      category,
      COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour') AS total_1h,
      COUNT(*) FILTER (WHERE created_at > now() - interval '1 hour' AND status = 'failure') AS fail_1h,
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours') AS total_24h,
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND status = 'failure') AS fail_24h,
      COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS total_7d,
      COUNT(*) FILTER (WHERE created_at > now() - interval '7 days' AND status = 'failure') AS fail_7d,
      AVG(latency_ms) FILTER (WHERE created_at > now() - interval '1 hour') AS latency_avg_1h
    FROM public.system_events
    WHERE created_at > now() - interval '7 days'
    GROUP BY category
  ),
  open_alerts AS (
    SELECT COUNT(*) AS n FROM public.monitoring_alerts WHERE resolved_at IS NULL
  ),
  last_webhook AS (
    SELECT MAX(created_at) AS at FROM public.system_events WHERE category = 'stripe_webhook'
  )
  SELECT jsonb_build_object(
    'categories', COALESCE(jsonb_agg(to_jsonb(w)), '[]'::jsonb),
    'open_alerts', (SELECT n FROM open_alerts),
    'last_webhook_at', (SELECT at FROM last_webhook),
    'generated_at', now()
  ) INTO result FROM windows w;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitoring_overview() TO authenticated;

-- ============ Alert evaluator ============
CREATE OR REPLACE FUNCTION public.monitoring_evaluate_alerts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket text := to_char(date_trunc('minute', now()) - (extract(minute from now())::int % 15) * interval '1 minute', 'YYYYMMDDHH24MI');
  webhook_total int;
  webhook_fail int;
  payout_fail int;
  last_webhook timestamptz;
  inserted int := 0;
BEGIN
  -- Webhook error rate in last 15 minutes
  SELECT
    COUNT(*) FILTER (WHERE category = 'stripe_webhook'),
    COUNT(*) FILTER (WHERE category = 'stripe_webhook' AND status = 'failure')
  INTO webhook_total, webhook_fail
  FROM public.system_events
  WHERE created_at > now() - interval '15 minutes';

  IF webhook_total >= 10 AND webhook_fail::float / webhook_total >= 0.2 THEN
    INSERT INTO public.monitoring_alerts (rule, severity, bucket_key, title, message, context)
    VALUES ('webhook_error_rate', 'critical', bucket,
            'Stripe webhook error rate above 20%',
            format('%s failures out of %s events in the last 15 minutes', webhook_fail, webhook_total),
            jsonb_build_object('failures', webhook_fail, 'total', webhook_total))
    ON CONFLICT (rule, bucket_key) DO NOTHING;
    GET DIAGNOSTICS inserted = ROW_COUNT;
  END IF;

  -- Payout failures in last 60 minutes
  SELECT COUNT(*) INTO payout_fail
  FROM public.system_events
  WHERE category = 'payout' AND status = 'failure' AND created_at > now() - interval '60 minutes';

  IF payout_fail >= 1 THEN
    INSERT INTO public.monitoring_alerts (rule, severity, bucket_key, title, message, context)
    VALUES ('payout_failure', 'critical', to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'),
            'Driver payout failure detected',
            format('%s payout failures in the last hour', payout_fail),
            jsonb_build_object('failures', payout_fail))
    ON CONFLICT (rule, bucket_key) DO NOTHING;
  END IF;

  -- Webhook silence: no webhook events in last 60 minutes (only alert during day to reduce noise)
  SELECT MAX(created_at) INTO last_webhook FROM public.system_events WHERE category = 'stripe_webhook';
  IF last_webhook IS NULL OR last_webhook < now() - interval '60 minutes' THEN
    INSERT INTO public.monitoring_alerts (rule, severity, bucket_key, title, message, context)
    VALUES ('webhook_silence', 'warning', to_char(date_trunc('hour', now()), 'YYYYMMDDHH24'),
            'No Stripe webhook events received in 60+ minutes',
            'Verify Stripe webhook endpoint health and connectivity',
            jsonb_build_object('last_webhook_at', last_webhook))
    ON CONFLICT (rule, bucket_key) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('evaluated_at', now(), 'webhook_total', webhook_total, 'webhook_fail', webhook_fail, 'payout_fail', payout_fail);
END;
$$;

GRANT EXECUTE ON FUNCTION public.monitoring_evaluate_alerts() TO service_role;
