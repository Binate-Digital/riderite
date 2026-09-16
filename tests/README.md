# Realtime Permission Tests

Automated assertions that verify the RLS policies on `realtime.messages` for
private broadcast/presence channels.

## What it covers

| Channel topic                | Allowed                                    |
| ---------------------------- | ------------------------------------------ |
| `trip-loc:<tripId>`          | trip's `rider_id` or assigned `driver_id`  |
| `notif-<userId>`             | matching `auth.uid()`                      |
| `alerts-rider:<userId>`      | matching `auth.uid()`                      |
| `alerts-driver:<userId>`     | matching `auth.uid()`                      |

For each, the suite creates throw-away users + a real `trips` row via the
service-role client, then signs in as each persona with the publishable key
and attempts a private channel subscribe. `SUBSCRIBED` = allowed,
`CHANNEL_ERROR` = correctly denied.

## Run

Set env vars (any shell), then:

```bash
SUPABASE_URL=...                  \
SUPABASE_SERVICE_ROLE_KEY=...     \
SUPABASE_PUBLISHABLE_KEY=...      \
bunx vitest run tests/realtime-permissions.test.ts
```

If the env vars are missing the suite is skipped (CI-safe) and prints a
warning instead of failing.

## When to run

- Before publishing.
- After any migration touching `realtime.messages` policies, the `trips`
  table, or `user_roles`.
- After changing channel-naming conventions in client code
  (`supabase.channel(...)`).

---

# Booking Smoke Test

End-to-end happy path: passenger requests an SUV/truck ride, eligible driver
accepts it, and both parties receive realtime updates on `trip-loc:<tripId>`
plus `postgres_changes` status transitions on `public.trips`.

## What it covers

1. Rider INSERT on `public.trips` (RLS for own row).
2. `list_open_trip_requests` returns the new trip to a driver.
3. `accept_trip_request` succeeds for an eligible driver (active profile,
   active subscription, payouts enabled) and assigns `driver_id` + flips
   `status` to `accepted`.
4. Both rider and driver can subscribe to `trip-loc:<tripId>` and the rider
   receives the driver's broadcast location.
5. Rider receives a `postgres_changes` UPDATE when trip status moves to
   `in_progress`.

## Run

```bash
SUPABASE_URL=...                  \
SUPABASE_SERVICE_ROLE_KEY=...     \
SUPABASE_PUBLISHABLE_KEY=...      \
bunx vitest run tests/booking-smoke.test.ts
```

Override the requested vehicle class via `SMOKE_VEHICLE_TYPE=truck` (default
`suv`). Skips automatically when env vars are missing.

---

# Driver GPS Location Smoke Test

Simulates the live-tracking pipeline used by `useDriverLocationBroadcaster`
(driver) and `<LiveTripMap />` (rider). Verifies that GPS coordinates the
driver broadcasts on `trip-loc:<tripId>` (event `loc`) arrive at the rider
in order with intact lat/lng/ts, and that an unrelated user is denied
subscription to the same topic.

## What it covers

1. Outsider is denied `trip-loc:<tripId>` (RLS on `realtime.messages`).
2. Driver sends a 5-point GPS track (`{lat, lng, heading, speed, ts}`,
   matching the payload shape from `navigator.geolocation.watchPosition`).
3. Rider receives every point, in order, with lat/lng/ts matching exactly.

## Run

```bash
SUPABASE_URL=...                  \
SUPABASE_SERVICE_ROLE_KEY=...     \
SUPABASE_PUBLISHABLE_KEY=...      \
bunx vitest run tests/driver-location-smoke.test.ts
```

Skips automatically when env vars are missing.
