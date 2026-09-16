import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pricingFromRow, DEFAULT_PRICING, type PricingConfig } from "@/lib/fares";

const PRICING_FIELDS = [
  "sedan_base_cents", "sedan_per_mile_cents", "sedan_per_min_cents",
  "suv_base_cents", "suv_per_mile_cents", "suv_per_min_cents",
  "truck_base_cents", "truck_per_mile_cents", "truck_per_min_cents",
  "booking_fee_cents", "minimum_fare_cents", "service_fee_bps", "tax_bps",
] as const;

export type PricingRow = Record<(typeof PRICING_FIELDS)[number], number> & { updated_at: string };

// Accepts an authenticated supabase client. Untyped to avoid generics depth blowup.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadPricingConfig(supabase: any): Promise<PricingConfig> {
  try {
    const { data } = await supabase
      .from("pricing_config")
      .select(PRICING_FIELDS.join(","))
      .eq("id", 1)
      .maybeSingle();
    return pricingFromRow(data as Record<string, number> | null);
  } catch {
    return DEFAULT_PRICING;
  }
}

export const getPricingConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("pricing_config")
      .select([...PRICING_FIELDS, "updated_at"].join(","))
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as PricingRow | null;
  });

const UpdateSchema = z.object({
  sedan_base_cents: z.number().int().min(0).max(100000),
  sedan_per_mile_cents: z.number().int().min(0).max(100000),
  sedan_per_min_cents: z.number().int().min(0).max(100000),
  suv_base_cents: z.number().int().min(0).max(100000),
  suv_per_mile_cents: z.number().int().min(0).max(100000),
  suv_per_min_cents: z.number().int().min(0).max(100000),
  truck_base_cents: z.number().int().min(0).max(100000),
  truck_per_mile_cents: z.number().int().min(0).max(100000),
  truck_per_min_cents: z.number().int().min(0).max(100000),
  booking_fee_cents: z.number().int().min(0).max(100000),
  minimum_fare_cents: z.number().int().min(0).max(100000),
  service_fee_bps: z.number().int().min(0).max(10000),
  tax_bps: z.number().int().min(0).max(10000),
});

export const updatePricingConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Defence-in-depth: also enforce admin role at the application layer, not
    // just via RLS on pricing_config.
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await supabase
      .from("pricing_config")
      .update({ ...data, updated_by: userId })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
