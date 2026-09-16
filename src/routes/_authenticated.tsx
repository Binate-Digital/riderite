import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useTripCancellationAlerts } from "@/hooks/use-trip-alerts";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

function AuthedLayout() {
  useTripCancellationAlerts();
  return (
    <>
      <PaymentTestModeBanner />
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
    if (!data.session.user.email_confirmed_at) {
      throw redirect({ to: "/verify-email" });
    }
  },
  component: AuthedLayout,
});
