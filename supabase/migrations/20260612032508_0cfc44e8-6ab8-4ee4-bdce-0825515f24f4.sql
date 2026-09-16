-- Attach the existing driver profile column-restriction trigger so drivers cannot
-- self-modify status/account_status/suspension fields.
DROP TRIGGER IF EXISTS enforce_driver_profile_update_columns_trg ON public.driver_profiles;
CREATE TRIGGER enforce_driver_profile_update_columns_trg
  BEFORE UPDATE ON public.driver_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_driver_profile_update_columns();

-- Attach the existing trip column-restriction trigger so drivers/riders cannot
-- modify protected trip fields (fare, payment ids, etc.) directly via the client.
DROP TRIGGER IF EXISTS enforce_trip_update_columns_trg ON public.trips;
CREATE TRIGGER enforce_trip_update_columns_trg
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_trip_update_columns();