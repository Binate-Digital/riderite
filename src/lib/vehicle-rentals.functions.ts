import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const BookSchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  env: z.enum(["sandbox", "live"]),
  returnUrl: z.string().url(),
});

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Book a vehicle rental. Creates a Checkout Session that charges the renter the full amount,
 * with a 10% application fee held by the platform; the remainder routes to the owner's Connect
 * account on payment success (via destination charge).
 */
export const createRentalBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => BookSchema.parse(i))
  .handler(async ({ data, context }): Promise<Result<{ clientSecret: string; rentalId: string }>> => {
    const env = data.env as StripeEnv;
    const { supabase, userId, claims } = context;

    const { data: listing, error: lErr } = await supabase
      .from("vehicle_listings").select("id, owner_id, title, daily_rate_cents, status").eq("id", data.listingId).maybeSingle();
    if (lErr) return { ok: false, error: lErr.message };
    if (!listing || listing.status !== "active") return { ok: false, error: "Listing not available" };
    if (listing.owner_id === userId) return { ok: false, error: "You cannot rent your own vehicle" };

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1);
    const total = days * listing.daily_rate_cents;
    const platformFee = Math.round(total * 0.10);
    const ownerPayout = total - platformFee;

    // Owner must have a Connect account with payouts enabled
    const { data: ownerConnect } = await supabase
      .from("connect_accounts").select("stripe_account_id, payouts_enabled, environment").eq("user_id", listing.owner_id).maybeSingle();
    if (!ownerConnect?.payouts_enabled || ownerConnect.environment !== env) {
      return { ok: false, error: "Vehicle owner can't accept payouts yet — try again later." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rental, error: rErr } = await supabaseAdmin.from("vehicle_rentals").insert({
      listing_id: listing.id,
      renter_id: userId,
      owner_id: listing.owner_id,
      start_date: data.startDate,
      end_date: data.endDate,
      total_cents: total,
      platform_fee_cents: platformFee,
      owner_payout_cents: ownerPayout,
      status: "pending",
    }).select("id").single();
    if (rErr || !rental) return { ok: false, error: rErr?.message ?? "Could not create booking" };

    try {
      const stripe = createStripeClient(env);
      const email = (claims as { email?: string } | null)?.email;
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        ui_mode: "embedded_page" as never,
        customer_email: email,
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: total,
            product_data: { name: `${listing.title} · ${days} day${days > 1 ? "s" : ""}` },
          },
          quantity: 1,
        }],
        payment_intent_data: {
          application_fee_amount: platformFee,
          transfer_data: { destination: ownerConnect.stripe_account_id },
          metadata: { rentalId: rental.id, purpose: "vehicle_rental", ownerId: listing.owner_id, renterId: userId },
        },
        return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        metadata: { rentalId: rental.id, purpose: "vehicle_rental" },
      });

      await supabaseAdmin.from("vehicle_rentals")
        .update({ stripe_session_id: session.id }).eq("id", rental.id);

      return { ok: true, clientSecret: session.client_secret as string, rentalId: rental.id };
    } catch (err) {
      await supabaseAdmin.from("vehicle_rentals").update({ status: "cancelled" }).eq("id", rental.id);
      return { ok: false, error: getStripeErrorMessage(err) };
    }
  });
