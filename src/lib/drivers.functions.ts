import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BulkSchema = z.object({
  updates: z
    .array(
      z.object({
        userId: z.string().uuid(),
        status: z.enum(["approved", "rejected", "suspended", "pending"]),
        statusReason: z.string().max(500).nullable(),
      }),
    )
    .min(1)
    .max(500),
});

export const bulkSetDriverStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => BulkSchema.parse(input))
  .handler(async function* ({ data, context }) {
    const { supabase, userId } = context;

    // Defense in depth: re-check admin role server-side (RLS also enforces).
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");

    // Group by (status, reason) so identical updates collapse to one SQL statement.
    type DriverStatus = "approved" | "pending" | "rejected" | "suspended";
    const groups = new Map<
      string,
      { status: DriverStatus; reason: string | null; ids: string[] }
    >();
    for (const u of data.updates) {
      const key = `${u.status}::${u.statusReason ?? ""}`;
      const g = groups.get(key) ?? {
        status: u.status,
        reason: u.statusReason,
        ids: [],
      };
      g.ids.push(u.userId);
      groups.set(key, g);
    }

    const now = new Date().toISOString();
    const groupArray = [...groups.values()];
    let completed = 0;
    const total = data.updates.length;
    const batches = groupArray.length;

    for (let i = 0; i < groupArray.length; i++) {
      const g = groupArray[i];
      const { error } = await supabase
        .from("driver_profiles")
        .update({
          status: g.status,
          status_reason: g.reason,
          status_changed_at: now,
        })
        .in("user_id", g.ids);
      if (error) throw new Error(error.message);
      completed += g.ids.length;
      yield { type: "progress", completed, total, batch: i + 1, batches };
    }

    yield { type: "done", updated: total, batches };
  });

