import { useEffect, useMemo, useState } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeElementsOptions } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCustomPaymentIntent, updateCustomPaymentIntent } from "@/lib/payment-intent.functions";

export type CheckoutPurpose = "ride" | "tip" | "topup" | "custom" | "donation";

export interface CustomCheckoutDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountCents: number;
  purpose?: CheckoutPurpose;
  description?: string;
  tripId?: string;
  /** Where Stripe should redirect after card / redirect-based payment methods complete. */
  returnUrl?: string;
  onSuccess?: (paymentIntentId: string) => void;
}

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function CustomCheckoutDrawer(props: CustomCheckoutDrawerProps) {
  const { open, onOpenChange, amountCents, purpose = "custom", description, tripId } = props;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create the PaymentIntent when the drawer opens for the current amount.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setClientSecret(null);
    setPaymentIntentId(null);
    (async () => {
      const res = await createCustomPaymentIntent({
        data: {
          amountCents,
          currency: "usd",
          purpose,
          description,
          tripId,
          environment: getStripeEnvironment(),
        },
      });
      if (cancelled) return;
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setClientSecret(res.clientSecret);
      setPaymentIntentId(res.paymentIntentId);
    })();
    return () => {
      cancelled = true;
    };
    // We intentionally only create a new intent on open; amount updates use updateCustomPaymentIntent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If the parent updates the amount while the drawer is open, sync the intent.
  useEffect(() => {
    if (!open || !paymentIntentId) return;
    let cancelled = false;
    (async () => {
      const res = await updateCustomPaymentIntent({
        data: { paymentIntentId, amountCents, environment: getStripeEnvironment() },
      });
      if (cancelled) return;
      if ("error" in res) setError(res.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [amountCents, paymentIntentId, open]);

  const options: StripeElementsOptions | null = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: { borderRadius: "12px" },
            },
          }
        : null,
    [clientSecret],
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="px-4 pb-6 sm:max-w-lg sm:mx-auto">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center justify-between text-2xl font-bold">
            <span>Pay {formatUSD(amountCents)}</span>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </DrawerTitle>
          <DrawerDescription>
            {description ?? "Secure checkout powered by Stripe. Apple Pay / Google Pay shown if supported."}
          </DrawerDescription>
        </DrawerHeader>

        {error && (
          <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {!options ? (
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Preparing secure checkout…
          </div>
        ) : (
          <Elements stripe={getStripe()} options={options}>
            <CheckoutForm
              amountCents={amountCents}
              returnUrl={props.returnUrl ?? (typeof window !== "undefined" ? `${window.location.origin}/dashboard?pi=${paymentIntentId ?? ""}` : "/")}
              onSuccess={(pi) => {
                props.onSuccess?.(pi);
                onOpenChange(false);
              }}
            />
          </Elements>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function CheckoutForm({
  amountCents,
  returnUrl,
  onSuccess,
}: {
  amountCents: number;
  returnUrl: string;
  onSuccess: (paymentIntentId: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentReady, setPaymentReady] = useState(false);

  async function confirm(useExpress: boolean) {
    if (!stripe || !elements) return;
    setSubmitting(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });
      if (error) {
        toast.error(error.message ?? "Payment failed");
        return;
      }
      if (paymentIntent?.status === "succeeded") {
        toast.success("Payment successful");
        onSuccess(paymentIntent.id);
      } else if (paymentIntent?.status === "processing") {
        toast.info("Payment processing");
        onSuccess(paymentIntent.id);
      } else {
        toast.error(`Unexpected status: ${paymentIntent?.status ?? "unknown"}`);
      }
    } finally {
      setSubmitting(false);
      void useExpress;
    }
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        options={{ buttonHeight: 48 }}
        onConfirm={() => confirm(true)}
      />

      <div className="relative my-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-xs uppercase tracking-widest text-muted-foreground">
            Or pay with card
          </span>
        </div>
      </div>

      <PaymentElement
        options={{ layout: "tabs" }}
        onReady={() => setPaymentReady(true)}
      />

      <button
        type="button"
        disabled={!stripe || !paymentReady || submitting}
        onClick={() => confirm(false)}
        className="w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-red hover:brightness-110 transition disabled:opacity-50"
      >
        {submitting ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Processing…
          </span>
        ) : (
          `Pay ${formatUSD(amountCents)}`
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Payments are securely processed by Stripe.
      </p>
    </div>
  );
}
