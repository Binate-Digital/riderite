/**
 * Driver GPS / location broadcast smoke test.
 *
 * Simulates the live tracking flow used by `useDriverLocationBroadcaster`
 * (driver) and `<LiveTripMap />` (rider):
 *
 *   1. Create a trip linking a rider + assigned driver (status='accepted').
 *   2. Rider subscribes to the private `trip-loc:<tripId>` channel and
 *      listens for `event: 'loc'` broadcasts.
 *   3. Driver subscribes to the same channel and sends a stream of GPS
 *      coordinates (matching the payload shape produced by the
 *      `navigator.geolocation.watchPosition` handler in
 *      `src/hooks/use-driver-location.tsx`).
 *   4. Rider must receive every coordinate in order, with lat/lng intact.
 *   5. An outsider user must NOT be able to subscribe to the channel.
 *
 * Required env:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)
 *
 * Run:
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   SUPABASE_PUBLISHABLE_KEY=... \
 *   bunx vitest run tests/driver-location-smoke.test.ts
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PUB =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

const haveEnv = Boolean(URL && SERVICE && PUB);
const d = haveEnv ? describe : describe.skip;

type Coords = {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  ts: number;
};

type Ctx = {
  admin: SupabaseClient;
  rider: SupabaseClient;
  driver: SupabaseClient;
  outsider: SupabaseClient;
  riderId: string;
  driverId: string;
  outsiderId: string;
  tripId: string;
  cleanup: Array<() => Promise<void>>;
};

const ctx = {} as Ctx;

async function createUser(admin: SupabaseClient) {
  const email = `gps-${crypto.randomUUID()}@test.local`;
  const password = `Pw!${crypto.randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return { id: data.user.id, email, password };
}

async function signIn(email: string, password: string) {
  const c = createClient(URL, PUB, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

function awaitSubscribe(channel: ReturnType<SupabaseClient['channel']>, label: string, timeoutMs = 5000) {
  return new Promise<'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT'>((resolve) => {
    const t = setTimeout(() => resolve('TIMED_OUT'), timeoutMs);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') {
        clearTimeout(t);
        resolve(status);
      }
    });
    // ensure we don't leave a dangling unresolved promise on close
    void label;
  });
}

d('driver gps -> rider live location broadcast', () => {
  beforeAll(async () => {
    ctx.admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    ctx.cleanup = [];

    const rider = await createUser(ctx.admin);
    const driver = await createUser(ctx.admin);
    const outsider = await createUser(ctx.admin);
    ctx.riderId = rider.id;
    ctx.driverId = driver.id;
    ctx.outsiderId = outsider.id;

    await ctx.admin
      .from('user_roles')
      .insert({ user_id: driver.id, role: 'driver' });

    const { data: trip, error } = await ctx.admin
      .from('trips')
      .insert({
        rider_id: rider.id,
        driver_id: driver.id,
        status: 'accepted',
        vehicle_type: 'standard',
        pickup_address: 'GPS Pickup',
        destination_address: 'GPS Drop',
        pickup_lat: 27.9944,
        pickup_lng: -81.7603,
        destination_lat: 28.05,
        destination_lng: -81.7,
        fare_cents: 1500,
        payment_method: 'cash',
      })
      .select('id')
      .single();
    if (error || !trip) throw error ?? new Error('trip insert failed');
    ctx.tripId = trip.id;

    ctx.rider = await signIn(rider.email, rider.password);
    ctx.driver = await signIn(driver.email, driver.password);
    ctx.outsider = await signIn(outsider.email, outsider.password);

    ctx.cleanup.push(async () => {
      await ctx.admin.from('trips').delete().eq('id', ctx.tripId);
      for (const id of [ctx.riderId, ctx.driverId, ctx.outsiderId]) {
        await ctx.admin.auth.admin.deleteUser(id);
      }
    });
  }, 30_000);

  afterAll(async () => {
    for (const fn of ctx.cleanup) await fn().catch(() => {});
  });

  it('outsider cannot subscribe to trip-loc:<tripId>', async () => {
    const topic = `trip-loc:${ctx.tripId}`;
    const channel = ctx.outsider.channel(topic, { config: { private: true } });
    const status = await awaitSubscribe(channel, 'outsider');
    expect(status).not.toBe('SUBSCRIBED');
    await ctx.outsider.removeChannel(channel).catch(() => {});
  }, 10_000);

  it('rider receives the full GPS stream sent by the driver', async () => {
    const topic = `trip-loc:${ctx.tripId}`;
    const received: Coords[] = [];

    // Rider listener — mirrors src/components/site/LiveTripMap.tsx
    const riderChannel = ctx.rider.channel(topic, {
      config: { private: true, broadcast: { self: false } },
    });
    riderChannel.on('broadcast', { event: 'loc' }, (msg) => {
      received.push(msg.payload as Coords);
    });
    const riderStatus = await awaitSubscribe(riderChannel, 'rider');
    expect(riderStatus).toBe('SUBSCRIBED');

    // Driver broadcaster — mirrors src/hooks/use-driver-location.tsx
    const driverChannel = ctx.driver.channel(topic, {
      config: { private: true, broadcast: { ack: true, self: false } },
    });
    const driverStatus = await awaitSubscribe(driverChannel, 'driver');
    expect(driverStatus).toBe('SUBSCRIBED');

    // Simulate a short GPS track (~5 ticks)
    const track: Coords[] = [
      { lat: 27.9944, lng: -81.7603, heading: 12, speed: 8.4, ts: Date.now() },
      { lat: 27.9952, lng: -81.7591, heading: 14, speed: 9.1, ts: Date.now() + 1000 },
      { lat: 27.9961, lng: -81.7578, heading: 18, speed: 9.6, ts: Date.now() + 2000 },
      { lat: 27.9974, lng: -81.7562, heading: 22, speed: 10.2, ts: Date.now() + 3000 },
      { lat: 27.999, lng: -81.7549, heading: 25, speed: 10.8, ts: Date.now() + 4000 },
    ];

    for (const point of track) {
      await driverChannel.send({ type: 'broadcast', event: 'loc', payload: point });
      // brief gap so realtime preserves ordering
      await new Promise((r) => setTimeout(r, 50));
    }

    // Wait for all ticks to arrive
    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (received.length >= track.length) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - start > 8000) {
          clearInterval(iv);
          reject(
            new Error(
              `only received ${received.length}/${track.length} GPS broadcasts`,
            ),
          );
        }
      }, 100);
    });

    expect(received.length).toBeGreaterThanOrEqual(track.length);
    for (let i = 0; i < track.length; i++) {
      expect(received[i].lat).toBeCloseTo(track[i].lat, 6);
      expect(received[i].lng).toBeCloseTo(track[i].lng, 6);
      expect(received[i].ts).toBe(track[i].ts);
    }

    await ctx.driver.removeChannel(driverChannel).catch(() => {});
    await ctx.rider.removeChannel(riderChannel).catch(() => {});
  }, 20_000);
});

if (!haveEnv) {
  // eslint-disable-next-line no-console
  console.warn(
    '[driver-location-smoke] Skipped: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY to run.',
  );
}
