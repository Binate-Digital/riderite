ALTER TABLE public.trips
  ADD COLUMN pickup_lat numeric,
  ADD COLUMN pickup_lng numeric,
  ADD COLUMN destination_lat numeric,
  ADD COLUMN destination_lng numeric;