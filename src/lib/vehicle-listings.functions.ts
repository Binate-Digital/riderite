import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ListingSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  make: z.string().trim().min(1).max(40),
  model: z.string().trim().min(1).max(40),
  year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
  vehicle_type: z.enum(["sedan", "suv", "truck"]),
  daily_rate_cents: z.number().int().min(1000).max(500000),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().length(2),
  photos: z.array(z.string().url()).max(8).default([]),
  seats: z.number().int().min(1).max(15).default(5),
  transmission: z.enum(["automatic", "manual"]).default("automatic"),
  features: z.array(z.string()).max(20).default([]),
});

export const createVehicleListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ListingSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("vehicle_listings")
      .insert({ ...data, owner_id: userId, status: "active" })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateVehicleListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), patch: ListingSchema.partial().extend({ status: z.enum(["draft", "active", "paused", "removed"]).optional() }) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vehicle_listings").update(data.patch).eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
