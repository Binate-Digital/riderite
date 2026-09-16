import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Loader2, Mail } from "lucide-react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createReactivationPaymentIntent } from "@/lib/driver-subscription.functions";

export const Route = createFileRoute("/_authenticated/account/suspended")({
  component: SuspendedPage,
});

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function SuspendedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createIntent = useServerFn(createReactivationPaymentIntent);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const { data: status } = useQuery({
    queryKey: ["suspension-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: prof }, { data: sub }] = await Promise.all([
        supabase.from("driver_profiles").select("account_status, suspension_reason, suspended_at").eq("user_id", user!.id).maybeSingle(),
        supabase.from("driver_subscriptions").select("outstanding_cents, late_fee_cents, status, grace_period_ends_at").eq("user_id", user!.id).maybeSingle(),
      ]);
      return { prof, sub };
    },
  });

  useEffect(() => {
    if (status?.prof?.account_status === "active") navigate({ to: "/driver" });
  }, [status, navigate]);

  const startReactivation = async () => {
    setLoading(true);
    try {
      const res = await createIntent({ data: { env: getStripeEnvironment() } });
      if (!res.ok) throw new Error(res.error);
      setClientSecret(res.clientSecret);
      setAmount(res.amountCents);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to start reactivation");
    } finally {
      setLoading(false);
    }
  };

  const outstanding = status?.sub?.outstanding_cents ?? 0;
  const lateFee = status?.sub?.late_fee_cents ?? 0;
  const total = outstanding + lateFee;

  return (
    <div className="min-h-screen bg-gradient-hero py-10 px-4">
      <div className="mx-auto max-w-2xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-surface/90 backdrop-blur-xl p-8 shadow-elevated">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <div>
              <span className="text-xs font-bold tracking-[0.3em] text-red-300">/ ACCOUNT SUSPENDED</span>
              <h1 className="text-display text-3xl">REACTIVATE TO DRIVE</h1>
            </div>
          </div>

          {status?.prof?.suspension_reason && (
            <p className="mt-4 text-sm text-muted-foreground">{status.prof.suspension_reason}</p>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 rounded-md border border-border bg-background/40 p-4 text-center">
            <Stat label="Outstanding" value={money(outstanding)} />
            <Stat label="Late fee" value={money(lateFee)} />
            <Stat label="Total due" value={money(total)} accent />
          </div>

          {!clientSecret ? (
            <button
              disabled={loading || total <= 0}
              onClick={startReactivation}
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-red hover:brightness-110 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} PAY {money(total)} & REACTIVATE
            </button>
          ) : (
            <div className="mt-6">
              <Elements stripe={getStripe()} options={{ clientSecret, appearance: { theme: "night" } }}>
                <ReactivationForm amount={amount} />
              </Elements>
            </div>
          )}

          <a
            href="mailto:Getriderite@gmail.com?subject=RideRite%20account%20suspended%20—%20support"
            className="mt-6 inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary"
          >
            <Mail className="h-4 w-4" /> Contact support
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</div>
      <div className={`mt-1 text-lg font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

function ReactivationForm({ amount }: { amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/driver` },
    });
    if (error) {
      toast.error(error.message ?? "Payment failed");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-xs font-bold text-primary-foreground shadow-red hover:brightness-110 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} PAY ${(amount / 100).toFixed(2)}
      </button>
    </form>
  );
}
