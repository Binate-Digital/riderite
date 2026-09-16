import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FilterSchema = z.object({
  hours: z.number().int().min(1).max(720).default(72),
  status: z.enum(["all", "pending", "sent", "failed", "dlq", "suppressed", "bounced", "complained"]).default("all"),
  template: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
  authOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(500).default(200),
});

export const getEmailLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => FilterSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Forbidden: admin only");

    const since = new Date(Date.now() - data.hours * 3600 * 1000).toISOString();

    // Fetch a wider window then dedupe by message_id (latest row wins).
    const { data: rows, error } = await supabaseAdmin
      .from("email_send_log")
      .select("id, message_id, template_name, recipient_email, status, error_message, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const AUTH_TYPES = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "reauthentication", "auth_emails"]);
    const seen = new Set<string>();
    const deduped: typeof rows = [];
    for (const r of rows ?? []) {
      const key = r.message_id ?? `__${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(r);
    }

    const filtered = deduped.filter((r) => {
      if (data.authOnly && !AUTH_TYPES.has(r.template_name ?? "")) return false;
      if (data.status !== "all" && r.status !== data.status) return false;
      if (data.template && r.template_name !== data.template) return false;
      if (data.search) {
        const q = data.search.toLowerCase();
        if (
          !(r.recipient_email ?? "").toLowerCase().includes(q) &&
          !(r.error_message ?? "").toLowerCase().includes(q) &&
          !(r.message_id ?? "").toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).slice(0, data.limit);

    const counts = { total: 0, sent: 0, pending: 0, failed: 0, dlq: 0, suppressed: 0, other: 0 };
    for (const r of deduped) {
      if (data.authOnly && !AUTH_TYPES.has(r.template_name ?? "")) continue;
      counts.total++;
      if (r.status === "sent") counts.sent++;
      else if (r.status === "pending") counts.pending++;
      else if (r.status === "failed") counts.failed++;
      else if (r.status === "dlq") counts.dlq++;
      else if (r.status === "suppressed") counts.suppressed++;
      else counts.other++;
    }

    const templates = Array.from(new Set(deduped.map((r) => r.template_name).filter(Boolean))) as string[];

    return { rows: filtered, counts, templates };
  });
