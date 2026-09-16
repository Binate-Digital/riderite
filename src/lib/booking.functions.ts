import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { type StripeEnv, createStripeClient } from "@/lib/stripe.server";
import { computeFare, type VehicleType } from "@/lib/fares";
import { routeTrip } from "@/lib/routing.server";
import { loadPricingConfig } from "@/lib/pricing.functions";

const VehicleEnum = z.enum(["sedan", "suv", "truck"]);
const PaymentMethodEnum = z.enum(["card", "cashapp", "paypal", "cash", "venmo", "zelle"]);
const OFFLINE_METHODS = new Set(["cash", "venmo", "zelle"]);

const CoordsSchema = z
  .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
  .nullable()
  .optional();

const BookSchema = z.object({
  pickup: z.string().min(2).max(300),
  destination: z.string().min(2).max(300),
  pickupCoords: CoordsSchema,
  destinationCoords: CoordsSchema,
  vehicle: VehicleEnum,
  paymentMethod: PaymentMethodEnum.default("card"),
  returnUrl: z.string().url(),
  environment: z.enum(["sandbox", "live"]),
  promoCode: z.string().trim().min(1).max(40).optional(),
});

async function lookupPromoDiscount(
  supabase: any,
  code: string,
  subtotalCents: number,
): Promise<{ code: string; discountCents: number } | null> {
  const normalized = code.toUpperCase();
  const { data: promo } = await supabase
    .from("promo_codes")
    .select("code, percent_off, amount_off_cents, active, expires_at, max_uses, uses")
    .eq("code", normalized)
    .maybeSingle();
  if (!promo || !promo.active) return null;
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return null;
  if (promo.max_uses != null && promo.uses >= promo.max_uses) return null;
  const discountCents = promo.amount_off_cents
    ? promo.amount_off_cents
    : promo.percent_off
      ? Math.round((subtotalCents * promo.percent_off) / 100)
      : 0;
  return { code: normalized, discountCents };
}

export const createRideAndCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BookSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const vehicle = data.vehicle as VehicleType;
    const est = await routeTrip({
      pickup: data.pickup,
      destination: data.destination,
      pickupCoords: data.pickupCoords ?? null,
      destinationCoords: data.destinationCoords ?? null,
    });
    const pricing = await loadPricingConfig(supabase);
    const undiscounted = computeFare(vehicle, est.distanceMiles, est.durationMinutes, pricing);
    let promoCode: string | null = null;
    let discountCents = 0;
    if (data.promoCode) {
      const promo = await lookupPromoDiscount(supabaseAdmin, data.promoCode, undiscounted.totalCents);
      if (promo) {
        promoCode = promo.code;
        discountCents = promo.discountCents;
      }
    }
    const fare = computeFare(vehicle, est.distanceMiles, est.durationMinutes, pricing, discountCents);

    const isOffline = OFFLINE_METHODS.has(data.paymentMethod);

    // Insert trip (unpaid)
    const { data: trip, error } = await supabase
      .from("trips")
      .insert({
        rider_id: userId,
        pickup_address: data.pickup,
        destination_address: data.destination,
        pickup_lat: est.pickupCoords.lat || null,
        pickup_lng: est.pickupCoords.lng || null,
        destination_lat: est.destinationCoords.lat || null,
        destination_lng: est.destinationCoords.lng || null,
        vehicle_type: vehicle,
        distance_miles: est.distanceMiles,
        duration_minutes: est.durationMinutes,
        fare_cents: fare.totalCents,
        base_fare_cents: fare.baseFareCents,
        service_fee_cents: fare.serviceFeeCents,
        tax_cents: fare.taxCents,
        promo_code: promoCode,
        discount_cents: fare.discountCents,
        status: "requested",
        paid: false,
        payment_method: data.paymentMethod,
      })
      .select("id")
      .single();
    if (error || !trip) throw new Error(error?.message ?? "Could not create trip");

    // Pay-on-pickup path: no Stripe session, mark a pending offline payment record
    if (isOffline) {
      await supabase.from("payments").insert({
        trip_id: trip.id,
        user_id: userId,
        amount_cents: fare.totalCents,
        currency: "usd",
        status: "pending",
        environment: data.environment,
        payment_method: data.paymentMethod,
      });
      return { clientSecret: null, tripId: trip.id, fare, offline: true as const };
    }

    const stripe = createStripeClient(data.environment as StripeEnv);

    // Resolve / create Stripe Customer
    const { data: { user } } = await supabase.auth.getUser();
    const email = user?.email;

    let customerId: string | undefined;
    if (userId && /^[a-zA-Z0-9_-]+$/.test(userId)) {
      const found = await stripe.customers.search({
        query: `metadata['userId']:'${userId}'`,
        limit: 1,
      });
      if (found.data.length) customerId = found.data[0].id;
    }
    if (!customerId && email) {
      const existing = await stripe.customers.list({ email, limit: 1 });
      if (existing.data.length) {
        customerId = existing.data[0].id;
        if (existing.data[0].metadata?.userId !== userId) {
          await stripe.customers.update(customerId, {
            metadata: { ...existing.data[0].metadata, userId },
          });
        }
      }
    }
    if (!customerId) {
      const created = await stripe.customers.create({
        ...(email && { email }),
        metadata: { userId },
      });
      customerId = created.id;
    }

    // Stripe payment_method_types: card always; cashapp/paypal opt-in by rider choice.
    // Including all three keeps Link/wallets/etc available; choosing one narrows the UI.
    const pmTypes: Array<"card" | "cashapp" | "paypal"> =
      data.paymentMethod === "cashapp" ? ["cashapp"]
      : data.paymentMethod === "paypal" ? ["paypal"]
      : ["card", "cashapp", "paypal"];

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ui_mode: "embedded_page",
      return_url: data.returnUrl,
      customer: customerId,
      payment_method_types: pmTypes,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: fare.totalCents,
            product_data: {
              name: `RideRite ${pricing.rates[vehicle].label} ride`,
              description: `${data.pickup} → ${data.destination} · ${est.distanceMiles} mi · ${est.durationMinutes} min`,
            },
          },
        },
      ],
      metadata: {
        userId,
        tripId: trip.id,
      },
      payment_intent_data: {
        metadata: { userId, tripId: trip.id },
      },
    });

    if (!session.client_secret) throw new Error("Stripe did not return a client secret");

    // Insert pending payment
    await supabase.from("payments").insert({
      trip_id: trip.id,
      user_id: userId,
      amount_cents: fare.totalCents,
      currency: "usd",
      status: "pending",
      stripe_session_id: session.id,
      environment: data.environment,
      payment_method: data.paymentMethod,
    });

    // Stamp trip with session id (service role; financial field locked from clients)
    await supabaseAdmin.from("trips").update({ stripe_session_id: session.id }).eq("id", trip.id);

    return { clientSecret: session.client_secret, tripId: trip.id, fare, offline: false as const };
  });

export const getFareEstimate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pickup: z.string().min(2).max(300),
        destination: z.string().min(2).max(300),
        pickupCoords: CoordsSchema,
        destinationCoords: CoordsSchema,
        vehicle: VehicleEnum,
        promoCode: z.string().trim().min(1).max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const est = await routeTrip({
      pickup: data.pickup,
      destination: data.destination,
      pickupCoords: data.pickupCoords ?? null,
      destinationCoords: data.destinationCoords ?? null,
    });
    // Unauthenticated public fare estimate: NEVER look up promo codes here, to
    // prevent anonymous brute-force probing of promo_codes via supabaseAdmin.
    // Promo validation only happens inside createRideAndCheckout, which is
    // guarded by requireSupabaseAuth.
    const fare = computeFare(data.vehicle as VehicleType, est.distanceMiles, est.durationMinutes);
    return {
      distanceMiles: est.distanceMiles,
      durationMinutes: est.durationMinutes,
      source: est.source,
      promoCode: null as string | null,
      ...fare,
    };
  });
