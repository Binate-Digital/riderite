# Pre-Publish Checklist — Security, RLS & Realtime

Run through this list before clicking **Publish**. Each item references where to verify in the codebase or backend.

---

## 1. Authentication & Session

- [ ] **Auth providers configured**: Email/password + Google enabled. Google provider credentials set (else first sign-in throws "Unsupported provider").
- [ ] **No anonymous sign-ups** enabled in Auth settings.
- [ ] **Email auto-confirm**: off unless explicitly required.
- [ ] **Leaked password protection (HIBP)**: enabled in Cloud → Users → Auth Settings.
- [ ] **Protected routes**: every authenticated page lives under `src/routes/_authenticated/`. No top-level SSR route has a `beforeLoad` redirect to `/auth`.
- [ ] **Bearer attacher**: `attachSupabaseAuth` is registered as a global `functionMiddleware` in `src/start.ts`.

## 2. Row Level Security (RLS)

For **every** table in `public.*`:

- [ ] RLS is `ENABLED` (no table left disabled).
- [ ] Explicit `GRANT` exists for each role used by policies (`authenticated`, `service_role`, and `anon` only when intentionally public).
- [ ] No policy references its own table directly (use `SECURITY DEFINER` helper like `has_role`) — prevents infinite recursion.
- [ ] Roles are stored ONLY in `public.user_roles`, never on `profiles` or any user table.
- [ ] `user_id` columns used in RLS are `NOT NULL`.

Tables to spot-check in this project:
`profiles`, `user_roles`, `driver_profiles`, `driver_kyc`, `driver_subscriptions`, `connect_accounts`, `trips`, `payments`, `payouts`, `promo_codes`, `complaints`, `notifications`, `monitoring_alerts`, `system_events`, `vehicle_listings`, `vehicle_rentals`, `pricing_config`, `email_*`, `subscription_invoices`, `suppressed_emails`.

## 3. Triggers Guarding Privileged Columns

- [ ] `enforce_trip_update_columns_trg` attached to `public.trips` — blocks client modification of `fare_cents`, `paid`, `stripe_*`, `rider_id`, addresses/coords, etc.
- [ ] `enforce_driver_profile_update_columns_trg` attached to `public.driver_profiles` — blocks self-modification of `status`, `account_status`, `suspension_*`, `user_id`.
- [ ] `driver_kyc` UPDATE policy restricts edits to rows where `kyc_status='pending'` AND `bg_status='pending'`.

## 4. SECURITY DEFINER Functions

- [ ] `EXECUTE` revoked from `PUBLIC`, `anon`, `authenticated` on internal helpers: `handle_new_user`, `touch_updated_at`, `enforce_*`, `enqueue_email`, `delete_email`, `read_email_batch`, `move_to_dlq`, `monitoring_evaluate_alerts`.
- [ ] `EXECUTE` granted to `authenticated` ONLY for user-callable helpers: `has_role`, `can_driver_accept_trips`, `accept_trip_request`, `list_open_trip_requests`, `mark_notifications_read`, `monitoring_overview`.
- [ ] Every `SECURITY DEFINER` function sets `search_path = public`.

## 5. Server Functions (`createServerFn`)

- [ ] Every user-data fn uses `.middleware([requireSupabaseAuth])`.
- [ ] Every fn validates input with Zod via `.inputValidator(...)`.
- [ ] Admin-only fns (`setUserRole`, `setDriverStatus`, etc.) re-check `has_role(userId, 'admin')` server-side.
- [ ] `supabaseAdmin` is imported via `await import('@/integrations/supabase/client.server')` **inside** handlers — never at module scope of `*.functions.ts`.
- [ ] No protected fn is called from a public route's loader.

## 6. Public API Routes (`/api/public/*`)

- [ ] **Stripe webhook** (`/api/public/payments/webhook`): verifies signature with `PAYMENTS_LIVE_WEBHOOK_SECRET` / `PAYMENTS_SANDBOX_WEBHOOK_SECRET` before any write.
- [ ] **Cron endpoints** (`check-alerts`, `check-grace-periods`): require `CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` header — anon/publishable key is rejected.
- [ ] **Complaints intake**: Zod-validated, rate-limited, no PII echoed in responses.
- [ ] No public endpoint returns service-role data unfiltered.

## 7. Realtime Permissions

- [ ] RLS enabled on `realtime.messages`.
- [ ] `broadcast` / `presence` policies restrict topics to:
  - `notif-<userId>` matching `auth.uid()`
  - `trip-loc:<tripId>` only for participants (rider or assigned driver)
- [ ] No catch-all `postgres_changes` policy — per-table RLS filters change events.
- [ ] Frontend `supabase.channel(...)` calls live inside `useEffect` with cleanup (`removeChannel`) to avoid subscription leaks.
- [ ] Tables that publish changes are members of `supabase_realtime` publication (and ONLY those that should be).
- [ ] **Automated realtime permission tests pass** (confirms passengers & drivers can only subscribe to correct trip updates):
  ```bash
  SUPABASE_URL=<your-url> \
  SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
  SUPABASE_PUBLISHABLE_KEY=<your-anon-key> \
  bunx vitest run tests/realtime-permissions.test.ts
  ```

## 8. Secrets

Confirm present in the secrets store and **not** committed to code:
- [ ] `STRIPE_LIVE_API_KEY`, `STRIPE_SANDBOX_API_KEY`
- [ ] `PAYMENTS_LIVE_WEBHOOK_SECRET`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`
- [ ] `LOVABLE_API_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only; never referenced from client code)
- [ ] `CRON_SECRET` (if cron uses dedicated secret)
- [ ] No secret read at module scope of shared/client files. `process.env.*` usage confined to `.handler()` bodies or server routes.

## 9. Storage Buckets

- [ ] `email-assets`: public ✅ (intentional — referenced by transactional emails).
- [ ] Any new bucket containing user uploads is **private** with explicit storage policies scoping access by `auth.uid()`.

## 10. Final Scan & Smoke Test

- [ ] Run `security--run_security_scan` — zero unresolved critical/high findings (intentional ones documented in `@security-memory`).
- [ ] Run `supabase--linter` — no new warnings.
- [ ] Sign in as: rider, driver, admin → confirm each role sees only permitted data.
- [ ] Trigger a test Stripe webhook → confirm `system_events` records `success`.
- [ ] Force a webhook failure → confirm `monitoring_alerts` fires and email is sent.
- [ ] Confirm published URL loads, OG tags render, deep links work on refresh.

---

When every box is checked, publish via the **Publish** button (top-right).
