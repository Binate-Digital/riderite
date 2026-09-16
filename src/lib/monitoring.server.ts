// Server-only helper for recording monitoring events.
// Safe to import only from *.server.ts files, server routes, and createServerFn handler bodies.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _admin;
}

export type EventCategory =
  | "stripe_webhook"
  | "payout"
  | "subscription"
  | "connect"
  | "cron";

export type EventSeverity = "info" | "warning" | "error" | "critical";

export interface RecordEventInput {
  category: EventCategory;
  eventType: string;
  status?: "success" | "failure";
  severity?: EventSeverity;
  stripeEventId?: string | null;
  referenceId?: string | null;
  userId?: string | null;
  environment?: string | null;
  latencyMs?: number | null;
  errorMessage?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Record a monitoring event. Fire-and-forget — never throws,
 * so a logging failure cannot break the primary code path.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const { error } = await admin().from("system_events").insert({
      category: input.category,
      event_type: input.eventType,
      status: input.status ?? "success",
      severity: input.severity ?? (input.status === "failure" ? "error" : "info"),
      stripe_event_id: input.stripeEventId ?? null,
      reference_id: input.referenceId ?? null,
      user_id: input.userId ?? null,
      environment: input.environment ?? null,
      latency_ms: input.latencyMs ?? null,
      error_message: input.errorMessage ?? null,
      payload: input.payload ?? null,
    });
    // Duplicate stripe_event_id (idempotent retry) → ignore.
    if (error && error.code !== "23505") {
      console.error("[monitoring] insert failed:", error.message);
    }
  } catch (e) {
    console.error("[monitoring] insert threw:", e);
  }
}

export function categoryForStripeEvent(eventType: string): EventCategory {
  if (eventType.startsWith("transfer.") || eventType.startsWith("payout.")) return "payout";
  if (eventType.startsWith("customer.subscription.") || eventType.startsWith("invoice.")) return "subscription";
  if (eventType.startsWith("account.")) return "connect";
  return "stripe_webhook";
}
