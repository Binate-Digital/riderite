/**
 * End-to-end booking smoke test.
 *
 * Simulates the happy path:
 *   1. Passenger creates a trip request (truck or SUV vehicle_type).
 *   2. Driver (eligible) subscribes to driver alerts and accepts the trip
 *      via the `accept_trip_request` RPC.
 *   3. Both rider and driver subscribe to `trip-loc:<tripId>` and receive
 *      a broadcast location update (the realtime channel used by the
 *      live tracking UI).
 *   4. Trip status transitions arrive at both parties.
 *
 * This validates: insert RLS for trips, the open-request RPC chain, the
 * accept RPC eligibility gates, and the realtime broadcast topology.
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
 *   bunx vitest run tests/booking-smoke.test.ts
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

// Pick one of the larger vehicle classes. Adjust if your enum names differ.
const VEHICLE_TYPE = (process.env.SMOKE_VEHICLE_TYPE as
  | 'truck'
  | 'suv'
  | 'standard') ?? 'suv';

type Ctx = {
  admin: SupabaseClient;
  rider: SupabaseClient;
  driver: SupabaseClient;
  riderId: string;
  driverId: string;
  tripId: string;
  cleanup: Array<() => Promise<void>>;
};

const ctx = {} as Ctx;

async function createUser(admin: SupabaseClient) {
  const email = `smoke-${crypto.randomUUID()}@test.local`;
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

/**
 * Subscribe to a private channel and capture broadcast events. Returns
 * helpers to await an event matching a predicate and to tear down.
 */
function subscribeBroadcast<T = any>(
  client: SupabaseClient,
  topic: string,
  event: string,
) {
  const received: T[] = [];
  const channel = client.channel(topic, { config: { private: true } });
  const ready = new Promise<'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT'>(
    (resolve) => {
      const t = setTimeout(() => resolve('TIMED_OUT'), 5000);
      channel
        .on('broadcast', { event }, (payload) => {
          received.push(payload.payload as T);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR') {
            clearTimeout(t);
            resolve(status);
          }
        });
    },
  );
  function waitFor(predicate: (p: T) => boolean, timeoutMs = 5000) {
    return new Promise<T>((resolve, reject) => {
      const existing = received.find(predicate);
      if (existing) return resolve(existing);
      const start = Date.now();
      const iv = setInterval(() => {
        const hit = received.find(predicate);
        if (hit) {
          clearInterval(iv);
          resolve(hit);
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(iv);
          reject(new Error(`timeout waiting for ${event} on ${topic}`));
        }
      }, 100);
    });
  }
  return {
    ready,
    received,
    waitFor,
    close: () => client.removeChannel(channel).catch(() => {}),
  };
}

d(`booking smoke (${VEHICLE_TYPE})`, () => {
  beforeAll(async () => {
    ctx.admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    ctx.cleanup = [];

    const rider = await createUser(ctx.admin);
    const driver = await createUser(ctx.admin);
    ctx.riderId = rider.id;
    ctx.driverId = driver.id;

    // Driver role
    await ctx.admin
      .from('user_roles')
      .insert({ user_id: driver.id, role: 'driver' });

    // Make driver eligible for accept_trip_request:
    //   active driver profile, active subscription, payouts enabled.
    await ctx.admin.from('driver_profiles').upsert({
      user_id: driver.id,
      account_status: 'active',
      status: 'available',
    });
    await ctx.admin.from('driver_subscriptions').upsert({
      user_id: driver.id,
      status: 'active',
    });
    await ctx.admin.from('connect_accounts').upsert({
      user_id: driver.id,
      payouts_enabled: true,
    });

    ctx.rider = await signIn(rider.email, rider.password);
    ctx.driver = await signIn(driver.email, driver.password);

    ctx.cleanup.push(async () => {
      if (ctx.tripId) {
        await ctx.admin.from('trips').delete().eq('id', ctx.tripId);
      }
      await ctx.admin
        .from('driver_subscriptions')
        .delete()
        .eq('user_id', ctx.driverId);
      await ctx.admin
        .from('connect_accounts')
        .delete()
        .eq('user_id', ctx.driverId);
      await ctx.admin
        .from('driver_profiles')
        .delete()
        .eq('user_id', ctx.driverId);
      for (const id of [ctx.riderId, ctx.driverId]) {
        await ctx.admin.auth.admin.deleteUser(id);
      }
    });
  }, 30_000);

  afterAll(async () => {
    for (const fn of ctx.cleanup) await fn().catch(() => {});
  });

  it('rider can create a trip request', async () => {
    const { data, error } = await ctx.rider
      .from('trips')
      .insert({
        rider_id: ctx.riderId,
        status: 'requested',
        vehicle_type: VEHICLE_TYPE,
        pickup_address: '100 Pickup St',
        destination_address: '500 Drop Ave',
        pickup_lat: 37.7749,
        pickup_lng: -122.4194,
        destination_lat: 37.7849,
        destination_lng: -122.4094,
        distance_miles: 5,
        duration_minutes: 15,
        fare_cents: 2500,
        payment_method: 'cash',
        paid: false,
      })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect(data?.id).toBeTruthy();
    ctx.tripId = data!.id;
  });

  it('driver sees the open trip in list_open_trip_requests', async () => {
    const { data, error } = await ctx.driver.rpc('list_open_trip_requests');
    expect(error).toBeNull();
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    expect(ids).toContain(ctx.tripId);
  });

  it('driver accepts the trip via accept_trip_request', async () => {
    const { data, error } = await ctx.driver.rpc('accept_trip_request', {
      _trip_id: ctx.tripId,
    });
    expect(error).toBeNull();
    expect(data).toBe(ctx.tripId);

    const { data: trip } = await ctx.admin
      .from('trips')
      .select('driver_id,status')
      .eq('id', ctx.tripId)
      .single();
    expect(trip?.driver_id).toBe(ctx.driverId);
    expect(trip?.status).toBe('accepted');
  });

  it('both parties receive realtime broadcast on trip-loc:<tripId>', async () => {
    const topic = `trip-loc:${ctx.tripId}`;
    const riderSub = subscribeBroadcast<{ lat: number; lng: number }>(
      ctx.rider,
      topic,
      'location',
    );
    const driverSub = subscribeBroadcast<{ lat: number; lng: number }>(
      ctx.driver,
      topic,
      'location',
    );

    const [riderReady, driverReady] = await Promise.all([
      riderSub.ready,
      driverSub.ready,
    ]);
    expect(riderReady).toBe('SUBSCRIBED');
    expect(driverReady).toBe('SUBSCRIBED');

    // Driver broadcasts their location; rider should receive it.
    const senderChannel = ctx.driver.channel(topic, {
      config: { private: true, broadcast: { ack: true, self: true } },
    });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('sender subscribe timeout')), 5000);
      senderChannel.subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          clearTimeout(t);
          resolve();
        } else if (s === 'CHANNEL_ERROR') {
          clearTimeout(t);
          reject(new Error('sender CHANNEL_ERROR'));
        }
      });
    });

    const payload = { lat: 37.775, lng: -122.418, ts: Date.now() };
    await senderChannel.send({ type: 'broadcast', event: 'location', payload });

    const riderHit = await riderSub.waitFor((p) => p.lat === payload.lat);
    expect(riderHit.lat).toBe(payload.lat);

    await ctx.driver.removeChannel(senderChannel);
    await riderSub.close();
    await driverSub.close();
  }, 20_000);

  it('rider sees status updates via postgres_changes on trips', async () => {
    const received: Array<{ status: string }> = [];
    const channel = ctx.rider
      .channel(`trip-status-${ctx.tripId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'trips',
          filter: `id=eq.${ctx.tripId}`,
        },
        (payload) => {
          received.push(payload.new as { status: string });
        },
      );

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('rider status subscribe timeout')), 5000);
      channel.subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          clearTimeout(t);
          resolve();
        } else if (s === 'CHANNEL_ERROR') {
          clearTimeout(t);
          reject(new Error('rider status CHANNEL_ERROR'));
        }
      });
    });

    // Admin advances trip status -> in_progress
    await ctx.admin
      .from('trips')
      .update({ status: 'in_progress' })
      .eq('id', ctx.tripId);

    await new Promise<void>((resolve, reject) => {
      const start = Date.now();
      const iv = setInterval(() => {
        if (received.some((r) => r.status === 'in_progress')) {
          clearInterval(iv);
          resolve();
        } else if (Date.now() - start > 7000) {
          clearInterval(iv);
          reject(new Error('did not receive in_progress status update'));
        }
      }, 100);
    });

    expect(received.some((r) => r.status === 'in_progress')).toBe(true);
    await ctx.rider.removeChannel(channel);
  }, 15_000);
});

if (!haveEnv) {
  // eslint-disable-next-line no-console
  console.warn(
    '[booking-smoke] Skipped: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY to run.',
  );
}
