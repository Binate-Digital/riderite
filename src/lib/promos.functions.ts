import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeDiscountCents } from "@/lib/fares";

const InputSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotalCents: z.number().int().positive(),
});

export interface PromoResult {
  ok: boolean;
  code: string;
  label: string;
  discountCents: number;
  error?: string;
}

export const validatePromoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<PromoResult> => {
    const normalized = data.code.toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: promo, error } = await supabaseAdmin
      .from("promo_codes")
      .select("code, percent_off, amount_off_cents, active, expires_at, max_uses, uses")
      .eq("code", normalized)
      .maybeSingle();

    if (error || !promo) {
      return { ok: false, code: normalized, label: "", discountCents: 0, error: "Promo code not found" };
    }
    if (!promo.active) {
      return { ok: false, code: normalized, label: "", discountCents: 0, error: "Promo is not active" };
    }
    if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) {
      return { ok: false, code: normalized, label: "", discountCents: 0, error: "Promo has expired" };
    }
    if (promo.max_uses != null && promo.uses >= promo.max_uses) {
      return { ok: false, code: normalized, label: "", discountCents: 0, error: "Promo limit reached" };
    }

    const discountCents = computeDiscountCents(data.subtotalCents, {
      percent_off: promo.percent_off,
      amount_off_cents: promo.amount_off_cents,
    });
    const label = promo.percent_off
      ? `${promo.percent_off}% off`
      : `$${((promo.amount_off_cents ?? 0) / 100).toFixed(2)} off`;
    return { ok: true, code: normalized, label, discountCents };
  });
