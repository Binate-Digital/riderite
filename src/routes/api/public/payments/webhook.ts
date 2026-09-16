import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";
import { recordEvent, categoryForStripeEvent } from "@/lib/monitoring.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

const APP_ORIGIN = () => process.env.INTERNAL_ORIGIN ?? "https://getriderite.com";

async function sendEmail(template: string, to: string, idempotencyKey: string, templateData: Record<string, unknown>) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;
  try {
    await fetch(`${APP_ORIGIN()}/lovable/email/transactional/send`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ templateName: template, recipientEmail: to, idempotencyKey, templateData }),
    });
  } catch (e) { console.error("email send failed", template, e); }
}

async function emailFor(userId: string): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await (sb.auth.admin as { getUserById: (id: string) => Promise<{ data?: { user?: { email?: string } } }> }).getUserById(userId);
  return data?.user?.email ?? null;
}

// ---------- Trip checkout ----------

async function handleSessionCompleted(session: any, env: StripeEnv) {
  const purpose = session.metadata?.purpose;
  const sb = getSupabase();

  if (purpose === "vehicle_rental") {
    const rentalId = session.metadata?.rentalId;
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!rentalId) return;
    await sb.from("vehicle_rentals").update({ status: "confirmed", stripe_payment_intent_id: pi ?? null }).eq("id", rentalId);
    // Notify owner + renter
    const { data: rental } = await sb.from("vehicle_rentals")
      .select("id, owner_id, renter_id, start_date, end_date, total_cents, platform_fee_cents, owner_payout_cents, listing_id")
      .eq("id", rentalId).maybeSingle();
    if (rental) {
      const r = rental as any;
      const ownerEmail = await emailFor(r.owner_id);
      const renterEmail = await emailFor(r.renter_id);
      if (renterEmail) await sendEmail("rental-booking-confirmation", renterEmail, `rental-conf-${rentalId}`, {
        rentalId, startDate: r.start_date, endDate: r.end_date, totalCents: r.total_cents,
      });
      if (ownerEmail) await sendEmail("rental-new-booking", ownerEmail, `rental-owner-${rentalId}`, {
        rentalId, startDate: r.start_date, endDate: r.end_date,
        totalCents: r.total_cents, ownerPayoutCents: r.owner_payout_cents, platformFeeCents: r.platform_fee_cents,
      });
    }
    return;
  }

  if (session.mode === "subscription") {
    // Driver subscription completed; subscription.created event will follow with full details.
    const userId = session.metadata?.userId;
    if (userId) {
      await sb.from("driver_subscriptions").upsert(
        { user_id: userId, stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
          status: "active", environment: env },
        { onConflict: "user_id" },
      );
      await sb.from("driver_profiles").update({ account_status: "active", suspension_reason: null, suspended_at: null })
        .eq("user_id", userId);
    }
    return;
  }

  // Trip checkout
  const tripId = session.metadata?.tripId;
  if (!tripId) { console.error("session.completed without tripId"); return; }
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  await sb.from("payments").update({
    status: "succeeded", stripe_payment_intent_id: paymentIntentId ?? null, updated_at: new Date().toISOString(),
  }).eq("stripe_session_id", session.id).eq("environment", env);
  await sb.from("trips").update({ paid: true, stripe_payment_intent_id: paymentIntentId ?? null }).eq("id", tripId);
}

async function handleSessionExpired(session: any, env: StripeEnv) {
  await getSupabase().from("payments")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("stripe_session_id", session.id).eq("environment", env);
}

// ---------- Connect ----------

async function handleAccountUpdated(account: any) {
  const userId = account.metadata?.userId;
  if (!userId) return;
  const sb = getSupabase();
  await sb.from("connect_accounts").update({
    charges_enabled: !!account.charges_enabled,
    payouts_enabled: !!account.payouts_enabled,
    details_submitted: !!account.details_submitted,
    requirements_due: account.requirements?.currently_due ?? [],
    disabled_reason: account.requirements?.disabled_reason ?? null,
  }).eq("stripe_account_id", account.id);
}

// ---------- Subscription lifecycle ----------

async function handleSubscriptionUpsert(sub: any, env: StripeEnv) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const item = sub.items?.data?.[0];
  const periodEnd = item?.current_period_end ?? sub.current_period_end;
  const periodStart = item?.current_period_start ?? sub.current_period_start;
  const sb = getSupabase();
  await sb.from("driver_subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: sub.id,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    status: sub.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    environment: env,
  }, { onConflict: "user_id" });

  // Sync driver profile account status off subscription state
  if (["active", "trialing"].includes(sub.status)) {
    await sb.from("driver_profiles").update({ account_status: "active" }).eq("user_id", userId);
  } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
    await sb.from("driver_profiles").update({
      account_status: "suspended", suspension_reason: `Subscription ${sub.status}`,
      suspended_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }
}

async function handleSubscriptionDeleted(sub: any) {
  const userId = sub.metadata?.userId;
  if (!userId) return;
  const sb = getSupabase();
  await sb.from("driver_subscriptions").update({ status: "canceled" }).eq("stripe_subscription_id", sub.id);
  await sb.from("driver_profiles").update({
    account_status: "suspended", suspension_reason: "Subscription canceled", suspended_at: new Date().toISOString(),
  }).eq("user_id", userId);
}

// ---------- Invoices: pre-charge reminder, payment failure, success ----------

async function handleInvoiceUpcoming(invoice: any) {
  const sub = invoice.subscription;
  if (!sub) return;
  const sb = getSupabase();
  const { data: row } = await sb.from("driver_subscriptions")
    .select("user_id").eq("stripe_subscription_id", typeof sub === "string" ? sub : sub.id).maybeSingle();
  const userId = (row as any)?.user_id;
  if (!userId) return;
  const email = await emailFor(userId);
  if (!email) return;
  await sendEmail("subscription-renewal-reminder", email, `renew-${invoice.id}`, {
    amountCents: invoice.amount_due, nextChargeAt: invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
  });
}

async function handleInvoicePaymentFailed(invoice: any) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return;
  const sb = getSupabase();
  const { data: row } = await sb.from("driver_subscriptions")
    .select("user_id, outstanding_cents").eq("stripe_subscription_id", subId).maybeSingle();
  const r = row as any;
  if (!r?.user_id) return;
  const graceEnds = new Date(Date.now() + 3 * 86400000).toISOString();
  await sb.from("driver_subscriptions").update({
    status: "past_due",
    grace_period_ends_at: graceEnds,
    outstanding_cents: (r.outstanding_cents ?? 0) + (invoice.amount_due ?? 0),
  }).eq("user_id", r.user_id);
  await sb.from("driver_profiles").update({
    account_status: "grace_period", suspension_reason: "Payment failed — 3-day grace period",
  }).eq("user_id", r.user_id);

  const email = await emailFor(r.user_id);
  if (email) await sendEmail("subscription-payment-failed", email, `payfail-${invoice.id}`, {
    amountCents: invoice.amount_due, graceEndsAt: graceEnds,
  });
}

async function handleInvoicePaid(invoice: any) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return;
  const sb = getSupabase();
  const { data: row } = await sb.from("driver_subscriptions")
    .select("user_id").eq("stripe_subscription_id", subId).maybeSingle();
  const userId = (row as any)?.user_id;
  if (!userId) return;
  await sb.from("driver_subscriptions").update({
    status: "active", grace_period_ends_at: null, outstanding_cents: 0, late_fee_cents: 0,
  }).eq("user_id", userId);
  await sb.from("driver_profiles").update({
    account_status: "active", suspension_reason: null, suspended_at: null,
  }).eq("user_id", userId);

  await sb.from("subscription_invoices").upsert({
    user_id: userId,
    stripe_invoice_id: invoice.id,
    amount_due_cents: invoice.amount_due ?? 0,
    amount_paid_cents: invoice.amount_paid ?? 0,
    status: invoice.status ?? "paid",
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
    period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
  }, { onConflict: "stripe_invoice_id" });
}

// ---------- Transfers (ride + rental payouts) ----------

async function handleTransferEvent(transfer: any, status: string) {
  const sb = getSupabase();
  await sb.from("payouts").update({ status }).eq("stripe_transfer_id", transfer.id);
}

// ---------- Payment intent (reactivation) ----------

async function handlePaymentIntentSucceeded(pi: any) {
  if (pi.metadata?.purpose !== "reactivation") return;
  const userId = pi.metadata?.userId;
  if (!userId) return;
  const sb = getSupabase();
  await sb.from("driver_subscriptions").update({
    outstanding_cents: 0, late_fee_cents: 0, grace_period_ends_at: null,
  }).eq("user_id", userId);
  await sb.from("driver_profiles").update({
    account_status: "active", suspension_reason: null, suspended_at: null,
  }).eq("user_id", userId);
  const email = await emailFor(userId);
  if (email) await sendEmail("subscription-reactivated", email, `reactivated-${pi.id}`, {
    amountCents: pi.amount_received ?? pi.amount ?? 0,
  });
}

// ----------------------------------------------------------

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        let event: { id?: string; type: string; data: { object: any } } | null = null;
        const startedAt = Date.now();
        try {
          event = await verifyWebhook(request, env) as any;
        } catch (e) {
          await recordEvent({
            category: "stripe_webhook", eventType: "signature_invalid", status: "failure",
            severity: "critical", environment: env,
            errorMessage: e instanceof Error ? e.message : String(e),
          });
          return new Response("Webhook error", { status: 400 });
        }
        try {
          switch (event!.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await handleSessionCompleted(event!.data.object, env); break;
            case "checkout.session.expired":
            case "checkout.session.async_payment_failed":
              await handleSessionExpired(event!.data.object, env); break;
            case "account.updated":
              await handleAccountUpdated(event!.data.object); break;
            case "customer.subscription.created":
            case "customer.subscription.updated":
              await handleSubscriptionUpsert(event!.data.object, env); break;
            case "customer.subscription.deleted":
              await handleSubscriptionDeleted(event!.data.object); break;
            case "invoice.upcoming":
              await handleInvoiceUpcoming(event!.data.object); break;
            case "invoice.payment_failed":
              await handleInvoicePaymentFailed(event!.data.object); break;
            case "invoice.paid":
            case "invoice.payment_succeeded":
              await handleInvoicePaid(event!.data.object); break;
            case "transfer.created":
              await handleTransferEvent(event!.data.object, "paid"); break;
            case "transfer.reversed":
              await handleTransferEvent(event!.data.object, "reversed"); break;
            case "transfer.failed" as never:
              await handleTransferEvent(event!.data.object, "failed"); break;
            case "payment_intent.succeeded":
              await handlePaymentIntentSucceeded(event!.data.object); break;
            default:
              console.log("Unhandled event:", event!.type);
          }
          await recordEvent({
            category: categoryForStripeEvent(event!.type),
            eventType: event!.type,
            status: "success",
            stripeEventId: event!.id ?? null,
            referenceId: event!.data?.object?.id ?? null,
            environment: env,
            latencyMs: Date.now() - startedAt,
          });
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          await recordEvent({
            category: categoryForStripeEvent(event?.type ?? ""),
            eventType: event?.type ?? "unknown",
            status: "failure",
            severity: event?.type?.startsWith("transfer.") ? "critical" : "error",
            stripeEventId: event?.id ?? null,
            referenceId: event?.data?.object?.id ?? null,
            environment: env,
            latencyMs: Date.now() - startedAt,
            errorMessage: e instanceof Error ? e.message : String(e),
          });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
