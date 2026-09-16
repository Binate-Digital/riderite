import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const EnvSchema = z.object({ env: z.enum(["sandbox", "live"]) });

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function ensureCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  userId: string,
  email: string | undefined,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;
  const c = await stripe.customers.create({ email, metadata: { userId, app: "riderite" } });
  return c.id;
}

/** Create an embedded Stripe Checkout session for the $49.99/mo driver membership. */
export const createDriverSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ env: z.enum(["sandbox", "live"]), returnUrl: z.string().url() }).parse(i))
  .handler(async ({ data, context }): Promise<Result<{ clientSecret: string }>> => {
    const env = data.env as StripeEnv;
    const stripe = createStripeClient(env);
    const { supabase, userId, claims } = context;

    try {
      const { data: sub } = await supabase
        .from("driver_subscriptions").select("status, stripe_customer_id").eq("user_id", userId).maybeSingle();
      if (sub && ["active", "trialing"].includes(sub.status)) {
        return { ok: false, error: "You already have an active driver membership." };
      }

      const email = (claims as { email?: string } | null)?.email;
      const customerId = await ensureCustomer(stripe, userId, email, sub?.stripe_customer_id ?? null);

      const prices = await stripe.prices.list({ lookup_keys: ["driver_monthly"], limit: 1 });
      const price = prices.data[0];
      if (!price) return { ok: false, error: "Driver membership price not configured" };

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        ui_mode: "embedded_page" as never,
        customer: customerId,
        line_items: [{ price: price.id, quantity: 1 }],
        return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        subscription_data: { metadata: { userId, app: "riderite", purpose: "driver_membership" } },
        metadata: { userId, purpose: "driver_membership" },
      });

      // Persist customer id so we can re-use it
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("driver_subscriptions").upsert(
        { user_id: userId, stripe_customer_id: customerId, status: sub?.status ?? "incomplete", environment: env },
        { onConflict: "user_id" },
      );

      return { ok: true, clientSecret: session.client_secret as string };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

/** Open the Stripe Billing Portal (manage card, view invoices, cancel). */
export const openBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ env: z.enum(["sandbox", "live"]), returnUrl: z.string().url() }).parse(i))
  .handler(async ({ data, context }): Promise<Result<{ url: string }>> => {
    const env = data.env as StripeEnv;
    const { data: sub } = await context.supabase
      .from("driver_subscriptions").select("stripe_customer_id").eq("user_id", context.userId).maybeSingle();
    if (!sub?.stripe_customer_id) return { ok: false, error: "No billing account yet" };
    try {
      const stripe = createStripeClient(env);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: data.returnUrl,
      });
      return { ok: true, url: portal.url };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

/**
 * Create a PaymentIntent for reactivation: pays outstanding subscription arrears + accrued late fee.
 * On payment success the webhook flips account_status back to 'active' and clears the balance.
 */
export const createReactivationPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EnvSchema.parse(i))
  .handler(async ({ data, context }): Promise<Result<{ clientSecret: string; amountCents: number }>> => {
    const env = data.env as StripeEnv;
    const { supabase, userId } = context;
    const { data: sub } = await supabase
      .from("driver_subscriptions")
      .select("outstanding_cents, late_fee_cents, stripe_customer_id")
      .eq("user_id", userId).maybeSingle();
    if (!sub?.stripe_customer_id) return { ok: false, error: "No billing account" };
    const amount = (sub.outstanding_cents ?? 0) + (sub.late_fee_cents ?? 0);
    if (amount <= 0) return { ok: false, error: "No outstanding balance" };

    try {
      const stripe = createStripeClient(env);
      const pi = await stripe.paymentIntents.create({
        amount,
        currency: "usd",
        customer: sub.stripe_customer_id,
        automatic_payment_methods: { enabled: true },
        metadata: { userId, purpose: "reactivation" },
        description: "RideRite driver membership reactivation",
      });
      return { ok: true, clientSecret: pi.client_secret as string, amountCents: amount };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });
