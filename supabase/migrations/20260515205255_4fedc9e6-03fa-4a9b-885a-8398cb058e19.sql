
ALTER TABLE public.driver_profiles
  ADD COLUMN status_reason text,
  ADD COLUMN status_changed_at timestamptz;
