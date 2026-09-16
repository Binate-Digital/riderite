import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

const EnvEnum = z.enum(["sandbox", "live"]);
const PurposeEnum = z.enum(["ride", "tip", "topup", "custom", "donation"]);

const CreateSchema = z.object({
  amountCents: z.number().int().min(50).max(1_000_000),
  currency: z.string().regex(/^[a-z]{3}$/).default("usd"),
  purpose: PurposeEnum.default("custom"),
  description: z.string().trim().min(1).max(200).optional(),
  tripId: z.string().uuid().optional(),
  environment: EnvEnum,
});

function getStripeMsg(e: unknown): string {
  if (e && typeof e === "object") {
    const err = e as { message?: string; raw?: { message?: string } };
    return err.raw?.message ?? err.message ?? "Stripe request failed";
  }
  return "Stripe request failed";
}

async function resolveCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  userId: string,
  email?: string,
) {
  if (!/^[a-zA-Z0-9_-]+$/.test(userId)) throw new Error("Invalid userId");
  const found = await stripe.customers.search({
    query: `metadata['userId']:'${userId}'`,
    limit: 1,
  });
  if (found.data.length) return found.data[0].id;
  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length) {
      const c = existing.data[0];
      if (c.metadata?.userId !== userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId },
        });
      }
      return c.id;
    }
  }
  const created = await stripe.customers.create({
    ...(email && { email }),
    metadata: { userId },
  });
  return created.id;
}

export const createCustomPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;
      const stripe = createStripeClient(data.environment as StripeEnv);

      const { data: userResp } = await supabase.auth.getUser();
      const email = userResp?.user?.email ?? undefined;
      const customerId = await resolveCustomer(stripe, userId, email);

      const description =
        data.description ??
        ({
          ride: "RideRite ride fare",
          tip: "RideRite driver tip",
          topup: "RideRite wallet top-up",
          donation: "RideRite donation",
          custom: "RideRite payment",
        } as const)[data.purpose];

      const intent = await stripe.paymentIntents.create({
        amount: data.amountCents,
        currency: data.currency,
        customer: customerId,
        description,
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId,
          purpose: data.purpose,
          ...(data.tripId && { tripId: data.tripId }),
        },
      });

      // Best-effort log so payments dashboards/admin can see the attempt
      if (data.tripId) {
        await supabase.from("payments").insert({
          trip_id: data.tripId,
          user_id: userId,
          amount_cents: data.amountCents,
          currency: data.currency,
          status: "pending",
          stripe_payment_intent_id: intent.id,
          environment: data.environment,
          payment_method: "card",
        });
      }

      if (!intent.client_secret) throw new Error("Stripe did not return a client secret");
      return { clientSecret: intent.client_secret, paymentIntentId: intent.id };
    } catch (e) {
      return { error: getStripeMsg(e) } as { error: string };
    }
  });

const UpdateSchema = z.object({
  paymentIntentId: z.string().min(1).max(200),
  amountCents: z.number().int().min(50).max(1_000_000),
  environment: EnvEnum,
});

export const updateCustomPaymentIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      // Verify the caller owns this intent before updating.
      const existing = await stripe.paymentIntents.retrieve(data.paymentIntentId);
      if (existing.metadata?.userId !== context.userId) {
        throw new Error("Forbidden");
      }
      if (existing.status !== "requires_payment_method" && existing.status !== "requires_confirmation") {
        throw new Error(`Cannot update intent in status ${existing.status}`);
      }
      const updated = await stripe.paymentIntents.update(data.paymentIntentId, {
        amount: data.amountCents,
      });
      return { ok: true as const, status: updated.status, amount: updated.amount };
    } catch (e) {
      return { error: getStripeMsg(e) } as { error: string };
    }
  });
