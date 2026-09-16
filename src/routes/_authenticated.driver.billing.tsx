import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CreditCard, Banknote, Loader2, ExternalLink, Mail } from "lucide-react";
import { loadConnectAndInitialize, type StripeConnectInstance } from "@stripe/connect-js";
import {
  ConnectComponentsProvider,
  ConnectAccountOnboarding,
  ConnectPayouts,
  ConnectBalances,
} from "@stripe/react-connect-js";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { StripeEmbeddedCheckoutPanel } from "@/components/StripeEmbeddedCheckout";
import { createConnectOnboardingSession, refreshAccountSession, syncConnectAccount } from "@/lib/connect.functions";
import { createDriverSubscriptionCheckout, openBillingPortal } from "@/lib/driver-subscription.functions";

export const Route = createFileRoute("/_authenticated/driver/billing")({
  component: DriverBillingPage,
});

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function DriverBillingPage() {
  const { user } = useAuth();
  const startConnect = useServerFn(createConnectOnboardingSession);
  const refreshConnect = useServerFn(refreshAccountSession);
  const sync = useServerFn(syncConnectAccount);
  const subCheckout = useServerFn(createDriverSubscriptionCheckout);
  const portal = useServerFn(openBillingPortal);

  const [connectInstance, setConnectInstance] = useState<StripeConnectInstance | null>(null);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const env = getStripeEnvironment();

  const { data, refetch } = useQuery({
    queryKey: ["driver-billing", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: sub }, { data: connect }, { data: payouts }] = await Promise.all([
        supabase.from("driver_subscriptions").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("connect_accounts").select("*").eq("user_id", user!.id).maybeSingle(),
        supabase.from("payouts").select("amount_cents, driver_cut_cents, company_cut_cents, status, created_at, trip_id").eq("driver_id", user!.id).order("created_at", { ascending: false }).limit(10),
      ]);
      return { sub, connect, payouts: payouts ?? [] };
    },
  });

  // Initialize Stripe Connect instance when we have a Connect account
  useEffect(() => {
    if (!data?.connect?.stripe_account_id || connectInstance) return;
    const publishable = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;
    if (!publishable) return;
    const instance = loadConnectAndInitialize({
      publishableKey: publishable,
      fetchClientSecret: async () => {
        const r = await refreshConnect({ data: { env } });
        if (!r.ok) throw new Error(r.error);
        return r.clientSecret;
      },
      appearance: { overlays: "dialog", variables: { colorPrimary: "#ef4444" } },
    });
    setConnectInstance(instance);
  }, [data?.connect?.stripe_account_id, connectInstance, env, refreshConnect]);

  const startConnectOnboarding = async () => {
    setBusy("connect");
    try {
      const r = await startConnect({ data: { env } });
      if (!r.ok) throw new Error(r.error);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const startCheckout = async () => {
    setBusy("checkout");
    try {
      const r = await subCheckout({
        data: { env, returnUrl: `${window.location.origin}/driver/billing` },
      });
      if (!r.ok) throw new Error(r.error);
      setCheckoutSecret(r.clientSecret);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    setBusy("portal");
    try {
      const r = await portal({ data: { env, returnUrl: `${window.location.origin}/driver/billing` } });
      if (!r.ok) throw new Error(r.error);
      window.open(r.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  };

  const syncAccount = async () => {
    try {
      await sync({ data: { env } });
      await refetch();
      toast.success("Synced with Stripe");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const sub = data?.sub;
  const connect = data?.connect;
  const subActive = sub && ["active", "trialing"].includes(sub.status as string);

  return (
    <div className="min-h-screen bg-gradient-hero py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/driver" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Driver hub
        </Link>

        <header className="rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-6 shadow-elevated">
          <span className="text-xs font-bold tracking-[0.3em] text-primary">/ BILLING & PAYOUTS</span>
          <h1 className="mt-1 text-display text-3xl">DRIVER BILLING</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your $49.99/mo membership, Stripe Connect payout account, and view your trip earnings (you keep 65%).
          </p>
        </header>

        {/* Membership */}
        <section className="rounded-2xl border border-border bg-surface/90 p-6 shadow-elevated">
          <div className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Membership</h2></div>
          <div className="mt-3 text-sm">
            Status: <strong className={subActive ? "text-emerald-300" : "text-amber-300"}>{sub?.status ?? "none"}</strong>
            {sub?.current_period_end && <span className="text-muted-foreground"> · renews {new Date(sub.current_period_end as string).toLocaleDateString()}</span>}
          </div>
          {((sub?.outstanding_cents ?? 0) > 0 || (sub?.late_fee_cents ?? 0) > 0) && (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
              Outstanding: {money(sub?.outstanding_cents ?? 0)} · Late fee: {money(sub?.late_fee_cents ?? 0)}
              {sub?.grace_period_ends_at && <> · Grace ends {new Date(sub.grace_period_ends_at as string).toLocaleString()}</>}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {!subActive && (
              <button onClick={startCheckout} disabled={busy === "checkout"} className="rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                {busy === "checkout" ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} SUBSCRIBE — $49.99/mo
              </button>
            )}
            {sub?.stripe_customer_id && (
              <button onClick={openPortal} disabled={busy === "portal"} className="rounded-md border border-border px-4 py-2 text-xs font-bold hover:border-primary/50 inline-flex items-center gap-2">
                MANAGE BILLING <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
          {checkoutSecret && (
            <div className="mt-4">
              <StripeEmbeddedCheckoutPanel clientSecret={checkoutSecret} />
            </div>
          )}
        </section>

        {/* Connect / Payouts */}
        <section className="rounded-2xl border border-border bg-surface/90 p-6 shadow-elevated">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /><h2 className="text-xl font-bold">Payout account</h2></div>
            {connect?.stripe_account_id && (
              <button onClick={syncAccount} className="text-xs font-bold text-muted-foreground hover:text-primary">SYNC</button>
            )}
          </div>
          {!connect?.stripe_account_id ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                Connect a US bank account through Stripe to receive your 65% share of every paid trip.
                Onboarding takes ~3 minutes and stays inside RideRite.
              </p>
              <button onClick={startConnectOnboarding} disabled={busy === "connect"} className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50">
                {busy === "connect" ? <Loader2 className="h-3 w-3 animate-spin inline" /> : null} START STRIPE ONBOARDING
              </button>
            </>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Pill label="Charges" ok={connect.charges_enabled} />
                <Pill label="Payouts" ok={connect.payouts_enabled} />
                <Pill label="Details" ok={connect.details_submitted} />
              </div>
              {connectInstance && (
                <div className="mt-4 space-y-4">
                  <ConnectComponentsProvider connectInstance={connectInstance}>
                    {!connect.details_submitted && <ConnectAccountOnboarding onExit={() => { void syncAccount(); }} />}
                    {connect.details_submitted && <><ConnectBalances /><ConnectPayouts /></>}
                  </ConnectComponentsProvider>
                </div>
              )}
            </>
          )}
        </section>

        {/* Recent payouts */}
        <section className="rounded-2xl border border-border bg-surface/90 p-6 shadow-elevated">
          <h2 className="text-xl font-bold">Recent trip payouts</h2>
          <p className="mt-1 text-xs text-muted-foreground">65% driver / 35% platform on every paid fare.</p>
          {data?.payouts.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-md border border-border">
              {data?.payouts.map((p: any) => (
                <div key={p.trip_id + p.created_at} className="grid grid-cols-4 gap-2 px-4 py-2 text-xs">
                  <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                  <span>Trip {String(p.trip_id).slice(0, 8)}</span>
                  <span className="text-emerald-300 font-bold">+{money(p.driver_cut_cents)}</span>
                  <span className="text-right uppercase text-muted-foreground">{p.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <a href="mailto:Getriderite@gmail.com?subject=RideRite%20driver%20support" className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary">
          <Mail className="h-4 w-4" /> Contact support
        </a>
      </div>
    </div>
  );
}

function Pill({ label, ok }: { label: string; ok: boolean | null | undefined }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-center ${ok ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}>
      <div className="text-[10px] font-bold tracking-widest">{label.toUpperCase()}</div>
      <div className="font-bold">{ok ? "OK" : "PENDING"}</div>
    </div>
  );
}
