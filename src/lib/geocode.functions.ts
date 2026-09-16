import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UA = "RideRite/1.0 (+https://riderite.app)";

const ReverseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ReverseSchema.parse(i))
  .handler(async ({ data }) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${data.lat}&lon=${data.lng}&zoom=18&addressdetails=0`;
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
      if (!res.ok) return { address: "" };
      const json = (await res.json()) as { display_name?: string };
      return { address: json.display_name ?? "" };
    } catch {
      return { address: "" };
    }
  });
