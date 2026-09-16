import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["rider", "driver", "admin"]);

const SetUserRoleSchema = z.object({
  userId: z.string().uuid(),
  role: RoleEnum,
  add: z.boolean(),
});

const SetDriverStatusSchema = z.object({
  userId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "suspended", "pending"]),
  statusReason: z.string().max(500).nullable(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetUserRoleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    if (data.add) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error && !/duplicate/i.test(error.message)) throw new Error(error.message);
    } else {
      // Guard: an admin cannot revoke their own admin role.
      if (data.role === "admin" && data.userId === userId) {
        throw new Error("You cannot revoke your own admin role");
      }
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const setDriverStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SetDriverStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error } = await supabase
      .from("driver_profiles")
      .update({
        status: data.status,
        status_reason: data.statusReason,
        status_changed_at: new Date().toISOString(),
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
