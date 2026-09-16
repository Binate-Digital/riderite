import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Eligibility = {
  loading: boolean;
  canAccept: boolean;
  suspended: boolean;
  reason: string | null;
};

export function useDriverEligibility(userId?: string): Eligibility {
  const [state, setState] = useState<Eligibility>({ loading: true, canAccept: false, suspended: false, reason: null });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [{ data: prof }, { data: sub }, { data: connect }] = await Promise.all([
        supabase.from("driver_profiles").select("account_status").eq("user_id", userId).maybeSingle(),
        supabase.from("driver_subscriptions").select("status").eq("user_id", userId).maybeSingle(),
        supabase.from("connect_accounts").select("payouts_enabled").eq("user_id", userId).maybeSingle(),
      ]);
      if (cancelled) return;
      const acct = (prof?.account_status as string) ?? null;
      const subOk = sub && ["active", "trialing"].includes(sub.status as string);
      const payoutsOk = !!connect?.payouts_enabled;
      const suspended = acct === "suspended";
      let reason: string | null = null;
      if (!subOk) reason = "your driver membership is not active";
      else if (!payoutsOk) reason = "your Stripe payout account isn't fully onboarded";
      else if (acct && acct !== "active") reason = `your account status is ${acct}`;
      setState({
        loading: false,
        canAccept: !!subOk && payoutsOk && (!acct || acct === "active"),
        suspended,
        reason,
      });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  return state;
}
