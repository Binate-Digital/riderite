import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListEventsSchema = z.object({
  category: z.string().max(60).optional(),
  status: z.enum(["success", "failure", "warning"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).default({});

const ListAlertsSchema = z.object({
  includeResolved: z.boolean().optional(),
}).default({});

const ResolveAlertSchema = z.object({ id: z.string().uuid() });

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const getMonitoringOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("monitoring_overview");
    if (error) throw new Error(error.message);
    return data as {
      categories: Array<{
        category: string;
        total_1h: number; fail_1h: number;
        total_24h: number; fail_24h: number;
        total_7d: number; fail_7d: number;
        latency_avg_1h: number | null;
      }>;
      open_alerts: number;
      last_webhook_at: string | null;
      generated_at: string;
    };
  });

export const listSystemEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListEventsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("system_events")
      .select("id, category, event_type, severity, status, stripe_event_id, reference_id, environment, latency_ms, error_message, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 100, 500));
    if (data.category) q = q.eq("category", data.category);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listMonitoringAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ListAlertsSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("monitoring_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!data.includeResolved) q = q.is("resolved_at", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const resolveMonitoringAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResolveAlertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("monitoring_alerts")
      .update({
        resolved_at: new Date().toISOString(),
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: context.userId,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
