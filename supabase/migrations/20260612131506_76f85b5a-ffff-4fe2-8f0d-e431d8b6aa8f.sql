
-- Enable RLS on realtime.messages and add policies for broadcast/presence channels.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior versions of our policies to keep this migration idempotent.
DROP POLICY IF EXISTS "rr_realtime_pg_changes_read"     ON realtime.messages;
DROP POLICY IF EXISTS "rr_realtime_trip_loc_read"       ON realtime.messages;
DROP POLICY IF EXISTS "rr_realtime_trip_loc_write"      ON realtime.messages;
DROP POLICY IF EXISTS "rr_realtime_user_channels_read"  ON realtime.messages;
DROP POLICY IF EXISTS "rr_realtime_user_channels_write" ON realtime.messages;

-- 1) Postgres changes: signed-in users may receive change events.
--    Underlying table RLS still filters which rows are emitted.
CREATE POLICY "rr_realtime_pg_changes_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (extension = 'postgres_changes');

-- 2) Live driver location broadcast: only the trip's rider or driver
--    may subscribe to or publish on trip-loc:<trip_id>.
CREATE POLICY "rr_realtime_trip_loc_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension IN ('broadcast', 'presence')
  AND realtime.topic() LIKE 'trip-loc:%'
  AND EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id::text = split_part(realtime.topic(), ':', 2)
      AND (t.rider_id = auth.uid() OR t.driver_id = auth.uid())
  )
);

CREATE POLICY "rr_realtime_trip_loc_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension IN ('broadcast', 'presence')
  AND realtime.topic() LIKE 'trip-loc:%'
  AND EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id::text = split_part(realtime.topic(), ':', 2)
      AND (t.rider_id = auth.uid() OR t.driver_id = auth.uid())
  )
);

-- 3) Per-user alert / notification broadcast channels: only the owning user.
CREATE POLICY "rr_realtime_user_channels_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  extension IN ('broadcast', 'presence')
  AND (
    realtime.topic() = 'alerts-rider:'  || auth.uid()::text
    OR realtime.topic() = 'alerts-driver:' || auth.uid()::text
    OR realtime.topic() = 'notif-'         || auth.uid()::text
  )
);

CREATE POLICY "rr_realtime_user_channels_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  extension IN ('broadcast', 'presence')
  AND (
    realtime.topic() = 'alerts-rider:'  || auth.uid()::text
    OR realtime.topic() = 'alerts-driver:' || auth.uid()::text
    OR realtime.topic() = 'notif-'         || auth.uid()::text
  )
);
