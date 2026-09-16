/**
 * Realtime permission tests.
 *
 * Verifies the RLS policies on `realtime.messages` for private broadcast channels:
 *   - trip-loc:<tripId>        → only the trip's rider OR assigned driver
 *   - notif-<userId>           → only the owning user
 *   - alerts-rider:<userId>    → only that rider
 *   - alerts-driver:<userId>   → only that driver
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)
 *
 * Run:
 *   bunx vitest run tests/realtime-permissions.test.ts
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
  const email = `rt-${crypto.randomUUID()}@test.local`;
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
 * Try to subscribe to a private channel. Resolves with the final channel state.
 * If the user lacks RLS access, the join is rejected and state becomes CHANNEL_ERROR.
 */
function trySubscribe(client: SupabaseClient, topic: string, timeoutMs = 5000) {
  return new Promise<'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'>(
    (resolve) => {
      const channel = client.channel(topic, { config: { private: true } });
      const finish = (s: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED') => {
        client.removeChannel(channel).catch(() => {});
        resolve(s);
      };
      const timer = setTimeout(() => finish('TIMED_OUT'), timeoutMs);
      channel.subscribe((status) => {
        if (
          status === 'SUBSCRIBED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'CLOSED'
        ) {
          clearTimeout(timer);
          finish(status);
        }
      });
    },
  );
}

d('realtime channel authorization', () => {
  beforeAll(async () => {
    ctx.admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
    ctx.cleanup = [];

    const rider = await createUser(ctx.admin);
    const driver = await createUser(ctx.admin);
    const outsider = await createUser(ctx.admin);
    ctx.riderId = rider.id;
    ctx.driverId = driver.id;
    ctx.outsiderId = outsider.id;

    // grant driver role so policies/triggers behave realistically
    await ctx.admin.from('user_roles').insert({ user_id: driver.id, role: 'driver' });

    // create a trip linking rider + driver
    const { data: trip, error } = await ctx.admin
      .from('trips')
      .insert({
        rider_id: rider.id,
        driver_id: driver.id,
        status: 'accepted',
        vehicle_type: 'standard',
        pickup_address: 'Test Pickup',
        destination_address: 'Test Drop',
        pickup_lat: 0,
        pickup_lng: 0,
        destination_lat: 0,
        destination_lng: 0,
        fare_cents: 1000,
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

  it('rider can subscribe to trip-loc:<tripId> for their trip', async () => {
    const s = await trySubscribe(ctx.rider, `trip-loc:${ctx.tripId}`);
    expect(s).toBe('SUBSCRIBED');
  });

  it('assigned driver can subscribe to trip-loc:<tripId>', async () => {
    const s = await trySubscribe(ctx.driver, `trip-loc:${ctx.tripId}`);
    expect(s).toBe('SUBSCRIBED');
  });

  it('uninvolved user is denied trip-loc:<tripId>', async () => {
    const s = await trySubscribe(ctx.outsider, `trip-loc:${ctx.tripId}`);
    expect(s).not.toBe('SUBSCRIBED');
  });

  it('rider cannot subscribe to a different rider-owned notif channel', async () => {
    const s = await trySubscribe(ctx.rider, `notif-${ctx.outsiderId}`);
    expect(s).not.toBe('SUBSCRIBED');
  });

  it('user can subscribe to their own notif-<userId>', async () => {
    const s = await trySubscribe(ctx.rider, `notif-${ctx.riderId}`);
    expect(s).toBe('SUBSCRIBED');
  });

  it('driver can subscribe to their own alerts-driver:<userId>', async () => {
    const s = await trySubscribe(ctx.driver, `alerts-driver:${ctx.driverId}`);
    expect(s).toBe('SUBSCRIBED');
  });

  it('rider cannot subscribe to another user’s alerts-rider channel', async () => {
    const s = await trySubscribe(ctx.rider, `alerts-rider:${ctx.outsiderId}`);
    expect(s).not.toBe('SUBSCRIBED');
  });

  it('outsider cannot subscribe to a random trip-loc topic', async () => {
    const s = await trySubscribe(
      ctx.outsider,
      `trip-loc:00000000-0000-0000-0000-000000000000`,
    );
    expect(s).not.toBe('SUBSCRIBED');
  });
});

if (!haveEnv) {
  // eslint-disable-next-line no-console
  console.warn(
    '[realtime-permissions] Skipped: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PUBLISHABLE_KEY to run.',
  );
}
