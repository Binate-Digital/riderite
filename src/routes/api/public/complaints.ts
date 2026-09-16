import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Schema = z.object({
  reporter_name: z.string().trim().min(1).max(120),
  reporter_email: z.string().trim().email().max(254),
  reporter_phone: z.string().trim().max(40).optional().nullable(),
  category: z.enum([
    "zero_tolerance_drugs_alcohol",
    "driver_conduct",
    "vehicle_safety",
    "discrimination",
    "accessibility",
    "billing",
    "other",
  ]),
  description: z.string().trim().min(10).max(4000),
  trip_id: z.string().uuid().optional().nullable(),
  incident_at: z.string().datetime().optional().nullable(),
});

let _sb: any = null;
function sb() {
  if (!_sb) {
    _sb = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _sb;
}

export const Route = createFileRoute("/api/public/complaints")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
          return new Response(
            JSON.stringify({ error: "Validation failed", issues: parsed.error.flatten() }),
            { status: 400, headers: { "content-type": "application/json" } },
          );
        }
        const { error, data } = await sb()
          .from("complaints")
          .insert({ ...parsed.data })
          .select("id")
          .single();
        if (error) {
          console.error("complaint insert failed:", error);
          return new Response(JSON.stringify({ error: "Server error" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return Response.json({ ok: true, id: data.id });
      },
    },
  },
});
