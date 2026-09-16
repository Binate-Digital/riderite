// RideRite Price Checker API helper
// ----------------------------------
// All price-quote calls go through this module so swapping the local mock
// implementation for the official RideRite pricing API later is a one-file change.
//
// To wire up the real API later:
//   1. Add `VITE_RIDERITE_API_URL` and `VITE_RIDERITE_API_KEY` to your env.
//   2. The `fetchLiveQuotes` function below will automatically call the live
//      endpoint instead of `mockQuotes` when both env vars are present.

import { estimateTrip, computeFare, DEFAULT_PRICING, type VehicleType } from "@/lib/fares";

export interface RideTier {
  id: VehicleType;
  label: string;            // Display name (Economy / Premium / XL)
  tagline: string;
  capacity: number;
  etaMinutes: number;
  priceCents: number;
  surgeMultiplier: number;  // 1.0 = no surge
}

export interface QuoteRequest {
  pickup: string;
  destination: string;
}

export interface QuoteResponse {
  tiers: RideTier[];
  distanceMiles: number;
  durationMinutes: number;
  generatedAt: number;
}

const TIER_META: Record<VehicleType, { label: string; tagline: string; capacity: number; etaBase: number }> = {
  sedan: { label: "Economy",  tagline: "Affordable everyday rides", capacity: 4, etaBase: 3 },
  suv:   { label: "Premium",  tagline: "Roomy, top-rated drivers",  capacity: 6, etaBase: 5 },
  truck: { label: "XL",       tagline: "Hauling, moves & cargo",    capacity: 2, etaBase: 7 },
};

// Light pseudo-random jitter seeded by pickup+destination+time bucket so
// values change every refresh but feel coherent for a given route.
function jitter(seedStr: string, bucket: number, min: number, max: number) {
  const seed = (seedStr + ":" + bucket).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const r = (Math.sin(seed) + 1) / 2; // 0..1
  return min + r * (max - min);
}

/** Local mock implementation used until the official RideRite API is wired in. */
export function mockQuotes({ pickup, destination }: QuoteRequest): QuoteResponse {
  const { distanceMiles, durationMinutes } = estimateTrip(pickup || "Pickup", destination || "Destination");
  const bucket = Math.floor(Date.now() / 30_000); // changes every 30s
  const tiers: RideTier[] = (Object.keys(TIER_META) as VehicleType[]).map((id) => {
    const meta = TIER_META[id];
    // Surge between 0.95x and 1.45x, deterministic per route + 30s bucket.
    const surge = Number(jitter(`${pickup}|${destination}|${id}`, bucket, 0.95, 1.45).toFixed(2));
    const fare = computeFare(id, distanceMiles, durationMinutes, DEFAULT_PRICING);
    const priceCents = Math.round(fare.totalCents * surge);
    const eta = Math.max(1, Math.round(meta.etaBase + jitter(`eta:${id}`, bucket, -1, 4)));
    return {
      id,
      label: meta.label,
      tagline: meta.tagline,
      capacity: meta.capacity,
      etaMinutes: eta,
      priceCents,
      surgeMultiplier: surge,
    };
  });
  return { tiers, distanceMiles, durationMinutes, generatedAt: Date.now() };
}

/**
 * Fetch live quotes. Uses the official RideRite API when configured,
 * otherwise falls back to the deterministic local mock.
 *
 * Drop-in replacement: when `VITE_RIDERITE_API_URL` and `VITE_RIDERITE_API_KEY`
 * are set, this calls `${VITE_RIDERITE_API_URL}/quotes` and expects a
 * QuoteResponse-shaped JSON body.
 */
export async function fetchLiveQuotes(req: QuoteRequest, signal?: AbortSignal): Promise<QuoteResponse> {
  const url = import.meta.env.VITE_RIDERITE_API_URL as string | undefined;
  const key = import.meta.env.VITE_RIDERITE_API_KEY as string | undefined;
  if (!url || !key) return mockQuotes(req);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(req),
      signal,
    });
    if (!res.ok) throw new Error(`RideRite API ${res.status}`);
    return (await res.json()) as QuoteResponse;
  } catch (err) {
    console.warn("[riderite-price-api] live fetch failed, using mock:", (err as Error).message);
    return mockQuotes(req);
  }
}

export function formatPrice(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}
