import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getStripeErrorMessage } from "@/lib/stripe.server";

const Schema = z.object({ tripId: z.string().uuid() });

const stripeEnvFromPublishableKey = (): "sandbox" | "live" =>
  (process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "").startsWith("pk_test_") ? "sandbox" : "live";

export const completeTripAndSendReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Schema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();

    const { data: trip, error } = await supabase
      .from("trips")
      .update({ status: "completed", completed_at: nowIso })
      .eq("id", data.tripId).eq("driver_id", userId)
      .select(
        "id, rider_id, pickup_address, destination_address, vehicle_type, distance_miles, duration_minutes, base_fare_cents, service_fee_cents, tax_cents, fare_cents, payment_method, completed_at, paid",
      ).maybeSingle();
    if (error) throw new Error(error.message);
    if (!trip) throw new Error("Trip not found or not assigned to you");

    // 65/35 split: transfer 65% to the driver's Connect account (only for online payments that actually settled).
    if (trip.paid && ["card", "cashapp", "paypal"].includes(trip.payment_method)) {
      void splitFareToDriver(trip.id, userId, trip.fare_cents).catch((e) =>
        console.error("payout split failed", e),
      );
    } else {
      // Cash/Venmo/Zelle: record the 65/35 breakdown but no Stripe transfer.
      await supabaseAdmin.from("payouts").insert({
        trip_id: trip.id,
        driver_id: userId,
        total_fare_cents: trip.fare_cents,
        driver_cut_cents: Math.round(trip.fare_cents * 0.65),
        company_cut_cents: trip.fare_cents - Math.round(trip.fare_cents * 0.65),
        status: "offline",
      }).then(() => undefined, (e) => console.error("offline payout row failed", e));
    }

    void sendRideReceipt(trip).catch((e) => console.error("ride-receipt send failed", e));
    return { ok: true };
  });

async function splitFareToDriver(tripId: string, driverId: string, totalCents: number) {
  const driverCut = Math.round(totalCents * 0.65);
  const companyCut = totalCents - driverCut;

  const { data: connect } = await supabaseAdmin
    .from("connect_accounts").select("stripe_account_id, payouts_enabled, environment")
    .eq("user_id", driverId).maybeSingle();
  if (!connect?.stripe_account_id || !connect.payouts_enabled) {
    await supabaseAdmin.from("payouts").insert({
      trip_id: tripId, driver_id: driverId, total_fare_cents: totalCents,
      driver_cut_cents: driverCut, company_cut_cents: companyCut,
      status: "blocked", failure_reason: "Driver Connect account not payout-ready",
    });
    return;
  }

  const env = (connect.environment as "sandbox" | "live") ?? stripeEnvFromPublishableKey();
  const stripe = createStripeClient(env);
  try {
    const transfer = await stripe.transfers.create({
      amount: driverCut,
      currency: "usd",
      destination: connect.stripe_account_id,
      transfer_group: `trip_${tripId}`,
      metadata: { tripId, driverId, purpose: "ride_payout", driverCut: String(driverCut), companyCut: String(companyCut) },
    });
    await supabaseAdmin.from("payouts").insert({
      trip_id: tripId, driver_id: driverId, total_fare_cents: totalCents,
      driver_cut_cents: driverCut, company_cut_cents: companyCut,
      stripe_transfer_id: transfer.id, stripe_destination_account: connect.stripe_account_id,
      status: "paid",
    });
  } catch (err) {
    await supabaseAdmin.from("payouts").insert({
      trip_id: tripId, driver_id: driverId, total_fare_cents: totalCents,
      driver_cut_cents: driverCut, company_cut_cents: companyCut,
      stripe_destination_account: connect.stripe_account_id,
      status: "failed", failure_reason: getStripeErrorMessage(err),
    });
  }
}

async function sendRideReceipt(trip: {
  id: string; rider_id: string; pickup_address: string; destination_address: string;
  vehicle_type: string; distance_miles: number; duration_minutes: number;
  base_fare_cents: number; service_fee_cents: number; tax_cents: number;
  fare_cents: number; payment_method: string; completed_at: string | null;
}) {
  const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(trip.rider_id);
  const email = userRes?.user?.email;
  if (!email) return;
  const { data: profile } = await supabaseAdmin
    .from("profiles").select("full_name").eq("id", trip.rider_id).maybeSingle();
  const riderName = profile?.full_name?.split(" ")[0] ?? undefined;

  const origin = process.env.INTERNAL_ORIGIN ?? "https://getriderite.com";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;

  await fetch(`${origin}/lovable/email/transactional/send`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      templateName: "ride-receipt",
      recipientEmail: email,
      idempotencyKey: `ride-receipt-${trip.id}`,
      templateData: {
        riderName, tripId: trip.id, pickup: trip.pickup_address, destination: trip.destination_address,
        vehicleType: trip.vehicle_type, distanceMiles: Number(trip.distance_miles),
        durationMinutes: trip.duration_minutes, completedAt: trip.completed_at,
        baseFareCents: trip.base_fare_cents, serviceFeeCents: trip.service_fee_cents,
        taxCents: trip.tax_cents, totalCents: trip.fare_cents,
        paymentMethod: trip.payment_method, currency: "usd",
      },
    }),
  });
}

const AdvanceSchema = z.object({
  tripId: z.string().uuid(),
  next: z.enum(["arriving", "in_progress"]),
});

export const advanceTripStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => AdvanceSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("trips")
      .update({ status: data.next })
      .eq("id", data.tripId)
      .eq("driver_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
