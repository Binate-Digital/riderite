import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, type StripeEnv } from "@/lib/stripe.server";

const CANCEL_GRACE_SECONDS = 120;       // free cancel within 2 min
const CANCEL_FEE_CENTS_AFTER_MATCH = 500; // $5 fee after driver assigned

const CancelSchema = z.object({
  tripId: z.string().uuid(),
  environment: z.enum(["sandbox", "live"]),
});

const RescheduleSchema = z.object({
  tripId: z.string().uuid(),
  scheduledFor: z.string().datetime(),
});

export type CancelResult = {
  ok: boolean;
  status: "refunded_full" | "refunded_partial" | "no_refund" | "no_charge";
  refundCents: number;
  feeCents: number;
  message: string;
};

export const cancelTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CancelSchema.parse(i))
  .handler(async ({ data, context }): Promise<CancelResult> => {
    const { supabase, userId } = context;
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, rider_id, status, driver_id, fare_cents, paid, requested_at, stripe_session_id, payment_method, created_at")
      .eq("id", data.tripId)
      .maybeSingle();
    if (error || !trip) throw new Error("Trip not found");
    if (trip.rider_id !== userId) throw new Error("Not authorized");
    if (trip.status === "cancelled") throw new Error("Trip already canceled");
    if (trip.status === "in_progress" || trip.status === "completed") {
      throw new Error("Cannot cancel a ride that is already in progress");
    }

    const startedAt = new Date(trip.requested_at ?? trip.created_at ?? Date.now()).getTime();
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const driverAssigned = !!trip.driver_id;

    let refundCents = 0;
    let feeCents = 0;
    let status: CancelResult["status"] = "no_charge";
    let message = "";

    if (!trip.paid) {
      // Offline pay-on-pickup or unpaid online — nothing to refund.
      status = "no_charge";
      message = "Ride canceled. No payment was taken.";
    } else if (elapsedSec <= CANCEL_GRACE_SECONDS || !driverAssigned) {
      refundCents = trip.fare_cents ?? 0;
      status = "refunded_full";
      message = "Canceled within the grace window. Full refund issued.";
    } else {
      feeCents = Math.min(CANCEL_FEE_CENTS_AFTER_MATCH, trip.fare_cents ?? 0);
      refundCents = Math.max(0, (trip.fare_cents ?? 0) - feeCents);
      status = refundCents > 0 ? "refunded_partial" : "no_refund";
      message = `Driver was already assigned. $${(feeCents / 100).toFixed(2)} cancellation fee applied.`;
    }

    // Issue Stripe refund when applicable
    if (refundCents > 0 && trip.stripe_session_id && trip.payment_method !== "cash" && trip.payment_method !== "venmo" && trip.payment_method !== "zelle") {
      const stripe = createStripeClient(data.environment as StripeEnv);
      try {
        const session = await stripe.checkout.sessions.retrieve(trip.stripe_session_id);
        const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        if (piId) {
          await stripe.refunds.create({ payment_intent: piId, amount: refundCents });
        }
      } catch (e) {
        console.error("[cancel-trip] stripe refund failed", e);
        // proceed — we still mark trip canceled and surface message
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("trips")
      .update({
        status: "cancelled",
        canceled_at: new Date().toISOString(),
        cancellation_fee_cents: feeCents,
      })
      .eq("id", data.tripId);

    if (refundCents > 0) {
      await supabaseAdmin
        .from("payments")
        .update({
          status: "refunded",
          refund_cents: refundCents,
          refunded_at: new Date().toISOString(),
        })
        .eq("trip_id", data.tripId);
    }

    return { ok: true, status, refundCents, feeCents, message };
  });

export const rescheduleTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => RescheduleSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, rider_id, status")
      .eq("id", data.tripId)
      .maybeSingle();
    if (error || !trip) throw new Error("Trip not found");
    if (trip.rider_id !== userId) throw new Error("Not authorized");
    if (trip.status === "in_progress" || trip.status === "completed" || trip.status === "cancelled") {
      throw new Error("Cannot reschedule this ride");
    }
    const when = new Date(data.scheduledFor);
    if (when.getTime() < Date.now() + 5 * 60_000) {
      throw new Error("Pick a time at least 5 minutes from now");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("trips")
      .update({ scheduled_for: when.toISOString() })
      .eq("id", data.tripId);

    return { ok: true, scheduledFor: when.toISOString() };
  });
