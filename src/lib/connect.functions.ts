import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const EnvSchema = z.object({ env: z.enum(["sandbox", "live"]) });

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Create (or reuse) a Stripe Express Connect account for the signed-in driver
 * and return an Account Session client_secret for the embedded onboarding component.
 * All SSN/bank/ID collection happens inside Stripe's iframe — no PCI scope for us.
 */
export const createConnectOnboardingSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EnvSchema.parse(i))
  .handler(async ({ data, context }): Promise<Result<{ clientSecret: string; accountId: string }>> => {
    const { supabase, userId, claims } = context;
    const env = data.env as StripeEnv;
    const stripe = createStripeClient(env);

    try {
      // Reuse existing Connect account if present
      const { data: existing } = await supabase
        .from("connect_accounts")
        .select("stripe_account_id, environment")
        .eq("user_id", userId)
        .maybeSingle();

      let accountId = existing?.environment === env ? existing.stripe_account_id : null;

      if (!accountId) {
        const email = (claims as { email?: string } | null)?.email;
        const account = await stripe.accounts.create({
          type: "express",
          country: "US",
          default_currency: "usd",
          email: email ?? undefined,
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
          },
          business_type: "individual",
          metadata: { userId, app: "riderite" },
        });
        accountId = account.id;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("connect_accounts").upsert(
          {
            user_id: userId,
            stripe_account_id: accountId,
            environment: env,
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
            details_submitted: account.details_submitted,
            requirements_due: (account.requirements?.currently_due ?? []) as string[],
          },
          { onConflict: "user_id" },
        );
      }

      const session = await stripe.accountSessions.create({
        account: accountId,
        components: {
          account_onboarding: { enabled: true, features: { external_account_collection: true } },
          payouts: { enabled: true, features: { instant_payouts: true, standard_payouts: true, edit_payout_schedule: true } },
          balances: { enabled: true } as never,
          payments: { enabled: true, features: { refund_management: true, dispute_management: true, capture_payments: false } },
        } as never,
      });

      return { ok: true, clientSecret: session.client_secret as string, accountId };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

/** Re-mint an Account Session client_secret (component sessions expire). */
export const refreshAccountSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EnvSchema.parse(i))
  .handler(async ({ data, context }): Promise<Result<{ clientSecret: string; accountId: string }>> => {
    const env = data.env as StripeEnv;
    const stripe = createStripeClient(env);
    const { data: row } = await context.supabase
      .from("connect_accounts").select("stripe_account_id").eq("user_id", context.userId).maybeSingle();
    if (!row?.stripe_account_id) return { ok: false, error: "No Connect account — start onboarding first." };
    try {
      const session = await stripe.accountSessions.create({
        account: row.stripe_account_id,
        components: {
          account_onboarding: { enabled: true, features: { external_account_collection: true } },
          payouts: { enabled: true, features: { instant_payouts: true, standard_payouts: true, edit_payout_schedule: true } },
          balances: { enabled: true } as never,
          payments: { enabled: true, features: { refund_management: true, dispute_management: true, capture_payments: false } },
        } as never,
      });
      return { ok: true, clientSecret: session.client_secret as string, accountId: row.stripe_account_id };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });

/** Refresh the local Connect account row from Stripe (charges/payouts/requirements). */
export const syncConnectAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => EnvSchema.parse(i))
  .handler(async ({ data, context }): Promise<Result<{ chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean; requirementsDue: string[] }>> => {
    const env = data.env as StripeEnv;
    const stripe = createStripeClient(env);
    const { data: row } = await context.supabase
      .from("connect_accounts").select("stripe_account_id").eq("user_id", context.userId).maybeSingle();
    if (!row?.stripe_account_id) return { ok: false, error: "No Connect account" };

    try {
      const a = await stripe.accounts.retrieve(row.stripe_account_id);
      const requirements = (a.requirements?.currently_due ?? []) as string[];
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("connect_accounts").update({
        charges_enabled: a.charges_enabled,
        payouts_enabled: a.payouts_enabled,
        details_submitted: a.details_submitted,
        requirements_due: requirements,
        disabled_reason: a.requirements?.disabled_reason ?? null,
      }).eq("user_id", context.userId);

      return {
        ok: true,
        chargesEnabled: a.charges_enabled,
        payoutsEnabled: a.payouts_enabled,
        detailsSubmitted: a.details_submitted,
        requirementsDue: requirements,
      };
    } catch (err) {
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });
