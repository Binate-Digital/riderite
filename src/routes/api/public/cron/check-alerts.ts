import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/check-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require a server-only secret. Prefer dedicated CRON_SECRET; fall back
        // to SUPABASE_SERVICE_ROLE_KEY. Never accept the publishable/anon key here —
        // it ships in the browser bundle and provides no access control.
        const authz = request.headers.get("authorization") ?? "";
        const bearer = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7) : "";
        const provided = bearer || request.headers.get("x-cron-secret") || "";
        const expected = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        if (!provided || !expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { recordEvent } = await import("@/lib/monitoring.server");

        const { data, error } = await supabaseAdmin.rpc("monitoring_evaluate_alerts");
        if (error) {
          await recordEvent({
            category: "cron", eventType: "check-alerts", status: "failure",
            severity: "error", errorMessage: error.message,
          });
          return new Response(error.message, { status: 500 });
        }

        // Email admins for any newly opened alerts (in last 5 min)
        const { data: newAlerts } = await supabaseAdmin
          .from("monitoring_alerts")
          .select("id, rule, severity, title, message")
          .is("resolved_at", null)
          .gte("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());

        if (newAlerts && newAlerts.length > 0) {
          // Notify admin email; idempotent per alert id.
          const adminEmail = process.env.MONITORING_ALERT_EMAIL ?? "Getriderite@gmail.com";
          const origin = process.env.INTERNAL_ORIGIN ?? "https://getriderite.com";
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          for (const a of newAlerts as Array<{ id: string; rule: string; severity: string; title: string; message: string }>) {
            try {
              await fetch(`${origin}/lovable/email/transactional/send`, {
                method: "POST",
                headers: { "content-type": "application/json", authorization: `Bearer ${serviceKey}` },
                body: JSON.stringify({
                  templateName: "monitoring-alert",
                  recipientEmail: adminEmail,
                  idempotencyKey: `alert-${a.id}`,
                  templateData: { rule: a.rule, severity: a.severity, title: a.title, message: a.message },
                }),
              });
            } catch (e) {
              console.error("alert email failed", e);
            }
          }
        }

        await recordEvent({
          category: "cron", eventType: "check-alerts",
          payload: data as Record<string, unknown>,
        });
        return Response.json({ ok: true, result: data, new_alerts: newAlerts?.length ?? 0 });
      },
    },
  },
});
