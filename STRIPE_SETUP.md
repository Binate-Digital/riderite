# RideRite Stripe Production Setup

## Required environment variables

Lovable Cloud auto-injects these — confirm they're present in **Project → Settings → Secrets**:

| Secret | Purpose |
| --- | --- |
| `STRIPE_SANDBOX_API_KEY` | Gateway key for test mode |
| `STRIPE_LIVE_API_KEY` | Gateway key for live mode (provisioned on go-live) |
| `PAYMENTS_SANDBOX_WEBHOOK_SECRET` | Verifies sandbox webhooks |
| `PAYMENTS_LIVE_WEBHOOK_SECRET` | Verifies live webhooks |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Backend access |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Frontend Stripe publishable key (auto in `.env.development` / `.env.production`) |

No manual Stripe dashboard key entry is required. Lovable's payments connector
routes Stripe API calls through the gateway using these tokens.

## Going live

1. Open **Project → Payments** in Lovable and click **Go live**.
2. Complete Stripe identity verification (business details, bank, tax).
3. Once approved, `STRIPE_LIVE_API_KEY` + `PAYMENTS_LIVE_WEBHOOK_SECRET` are injected.
4. Publish the project. `VITE_PAYMENTS_CLIENT_TOKEN` flips to a `pk_live_…` token.

## Stripe products

The `driver_membership` product (price `driver_monthly`, $49.99/mo, USD,
tax code `txcd_10103001`) is created via Lovable's payments tool — it
auto-syncs sandbox → live on publish.

## Webhooks

Webhook endpoint: `/api/public/payments/webhook` (already registered by Lovable
for both `?env=sandbox` and `?env=live`). Handled events:

- `customer.subscription.created` / `updated` / `deleted`
- `invoice.payment_failed` → starts 3-day grace period
- `invoice.payment_succeeded` → clears outstanding balance
- `payment_intent.succeeded` (reactivation) → flips `account_status` back to `active`
- `account.updated` (Connect) → updates `connect_accounts.payouts_enabled`
- `transfer.created` / `paid` → updates `payouts.status`

## Cron — suspension after grace period

Run hourly via Supabase `pg_cron`:

```sql
SELECT cron.schedule(
  'riderite-check-grace',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://project--05d65f1c-594e-4b16-9df8-15f00d1d7c8e.lovable.app/api/public/cron/check-grace-periods',
      headers := jsonb_build_object('Content-Type','application/json','apikey', current_setting('app.supabase_anon_key', true)),
      body := '{}'::jsonb
    );
  $$
);
```

Replace the host with your published Lovable URL when deploying.

## Testing flows in the preview

Test card: `4242 4242 4242 4242` · exp any future · CVC any 3 digits.
Decline: `4000 0000 0000 0002` · 3DS: `4000 0025 0000 3155`.

1. **Sign up** as a driver, complete KYC, then open **Driver → Billing**.
2. **Start Stripe Connect onboarding** — use SSN `000-00-0000`, routing
   `110000000`, account `000123456789` (Stripe sandbox test values).
3. **Subscribe** with `4242…`. Status flips to `active`, you can now accept trips.
4. Accept and **complete a paid trip** — verify a row appears in `payouts`
   with 65/35 split and a Stripe transfer to your Connect account.
5. **Simulate failed renewal**: in Stripe dashboard sandbox, swap card to
   `4000 0000 0000 0341` and trigger a renewal → status becomes `past_due`,
   `grace_period_ends_at` set, warning email sent.
6. **Force-expire grace** by running the cron endpoint manually (curl above).
   → status → `suspended`, $9.99 late fee added, redirected to
   `/account/suspended`.
7. **Reactivate**: pay outstanding + late fee with `4242…` → webhook flips
   `account_status` back to `active`.
8. **List a car** at `/rentals/list-your-car`, book as another user — verify
   10% platform fee + 90% transfer to the owner's Connect account.

## Support

All support links open `mailto:Getriderite@gmail.com`.

## Monitoring & Alerting (Webhooks, Payouts, Subscriptions)

Every Stripe webhook event, payout transfer, and subscription status change is recorded in `public.system_events`. Anomalies (webhook error rate > 20% in 15 min, any payout failure in last hour, or 60+ minutes of webhook silence) raise rows in `public.monitoring_alerts` and email the on-call address.

Configure the alert recipient via secret `MONITORING_ALERT_EMAIL` (defaults to `Getriderite@gmail.com`).

Admins see live KPIs, active alerts, recent failures, and the event stream at **Admin → Monitoring** (auto-refresh every 30s).

Schedule the alert evaluator with `pg_cron` (runs every 5 minutes):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'monitoring-check-alerts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://getriderite.com/api/public/cron/check-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SUPABASE_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
```
