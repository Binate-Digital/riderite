// Real routing using OpenStreetMap services (no API key required).
// - Geocoding: Nominatim
// - Routing:   OSRM public demo server
// Both providers ask for a descriptive User-Agent.

const UA = "RideRite/1.0 (+https://riderite.app)";
const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OSRM = "https://router.project-osrm.org/route/v1/driving";

export interface RouteResult {
  distanceMiles: number;
  durationMinutes: number;
  pickupCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  source: "osrm" | "fallback";
}

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${NOMINATIM}?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
  if (!res.ok) return null;
  const data = (await res.json()) as Array<{ lat: string; lon: string }>;
  if (!data.length) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

// Deterministic mock fallback (same as previous estimateTrip) so booking
// never hard-fails if the upstream maps service is unreachable.
function mockEstimate(pickup: string, destination: string) {
  const seed = (pickup + "|" + destination).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const distance = 2 + (seed % 180) / 10;
  const duration = Math.max(6, Math.round(distance * 2.6 + (seed % 7)));
  return { distanceMiles: Number(distance.toFixed(1)), durationMinutes: duration };
}

export interface RouteInput {
  pickup: string;
  destination: string;
  pickupCoords?: { lat: number; lng: number } | null;
  destinationCoords?: { lat: number; lng: number } | null;
}

export async function routeTrip(
  pickupOrInput: string | RouteInput,
  destination?: string,
): Promise<RouteResult> {
  const input: RouteInput =
    typeof pickupOrInput === "string"
      ? { pickup: pickupOrInput, destination: destination ?? "" }
      : pickupOrInput;

  try {
    const a = input.pickupCoords ?? (await geocode(input.pickup));
    const b = input.destinationCoords ?? (await geocode(input.destination));
    if (!a || !b) throw new Error("Could not geocode address");

    const url = `${OSRM}/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const data = (await res.json()) as {
      code: string;
      routes?: Array<{ distance: number; duration: number }>;
    };
    if (data.code !== "Ok" || !data.routes?.length) throw new Error("No route found");

    const r = data.routes[0];
    const distanceMiles = Number((r.distance / 1609.344).toFixed(1));
    const durationMinutes = Math.max(1, Math.round(r.duration / 60));
    return {
      distanceMiles,
      durationMinutes,
      pickupCoords: a,
      destinationCoords: b,
      source: "osrm",
    };
  } catch (err) {
    console.warn("[routing] falling back to mock estimate:", (err as Error).message);
    const m = mockEstimate(input.pickup, input.destination);
    return {
      ...m,
      pickupCoords: input.pickupCoords ?? { lat: 0, lng: 0 },
      destinationCoords: input.destinationCoords ?? { lat: 0, lng: 0 },
      source: "fallback",
    };
  }
}
