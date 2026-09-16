import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly cron via pg_cron. Finds drivers whose 3-day grace period has expired,
 * adds the $9.99 late fee, suspends them, and emails them.
 *
 * Schedule with pg_cron:
 *   SELECT cron.schedule('riderite-check-grace', '0 * * * *', $$
 *     SELECT net.http_post(
 *       url := 'https://project--<project-id>.lovable.app/api/public/cron/check-grace-periods',
 *       headers := jsonb_build_object('Content-Type','application/json','apikey','<SUPABASE_ANON_KEY>'),
 *       body := '{}'::jsonb
 *     );
 *   $$);
 */
export const Route = createFileRoute("/api/public/cron/check-grace-periods")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require a server-only secret (CRON_SECRET preferred, SUPABASE_SERVICE_ROLE_KEY fallback).
        // The publishable/anon key is NOT accepted — it is public and ships in the browser bundle.
        const authz = request.headers.get("authorization") ?? "";
        const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
        const provided = bearer || request.headers.get("x-cron-secret") || "";
        const expected = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        if (!provided || !expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { createClient } = await import("@supabase/supabase-js");
        const sb: any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

        const nowIso = new Date().toISOString();
        const { data: expired } = await sb
          .from("driver_subscriptions")
          .select("user_id, outstanding_cents, late_fee_cents")
          .lt("grace_period_ends_at", nowIso)
          .in("status", ["past_due", "unpaid", "incomplete"]);

        const LATE_FEE = 999;
        const results: Array<{ userId: string; status: string }> = [];

        for (const row of (expired ?? []) as Array<{ user_id: string; outstanding_cents: number; late_fee_cents: number }>) {
          await sb.from("driver_subscriptions").update({
            late_fee_cents: (row.late_fee_cents ?? 0) + LATE_FEE,
            grace_period_ends_at: null,
          }).eq("user_id", row.user_id);

          await sb.from("driver_profiles").update({
            account_status: "suspended",
            suspension_reason: "Membership unpaid past 3-day grace period",
            suspended_at: nowIso,
          }).eq("user_id", row.user_id);

          // Notify
          try {
            const { data: u } = await sb.auth.admin.getUserById(row.user_id);
            const email = u?.user?.email;
            if (email) {
              const origin = process.env.INTERNAL_ORIGIN ?? "https://getriderite.com";
              await fetch(`${origin}/lovable/email/transactional/send`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
                body: JSON.stringify({
                  templateName: "subscription-suspended",
                  recipientEmail: email,
                  idempotencyKey: `suspended-${row.user_id}-${Math.floor(Date.now() / 86400000)}`,
                  templateData: {
                    outstandingCents: row.outstanding_cents ?? 0,
                    lateFeeCents: (row.late_fee_cents ?? 0) + LATE_FEE,
                    totalCents: (row.outstanding_cents ?? 0) + (row.late_fee_cents ?? 0) + LATE_FEE,
                  },
                }),
              });
            }
          } catch (e) { console.error("suspension email failed", e); }

          results.push({ userId: row.user_id, status: "suspended" });
        }

        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
