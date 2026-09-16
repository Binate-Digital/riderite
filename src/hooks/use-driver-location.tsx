import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Driver-side broadcaster: watches geolocation and sends updates over a per-trip channel.
export function useDriverLocationBroadcaster(tripId: string | null, enabled: boolean) {
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setError(null);
    if (!enabled || !tripId) { setActive(false); return; }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported on this device");
      return;
    }
    const channel = supabase.channel(`trip-loc:${tripId}`, { config: { broadcast: { self: false } } });
    let subscribed = false;
    channel.subscribe((status) => { subscribed = status === "SUBSCRIBED"; setActive(subscribed); });

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!subscribed) return;
        channel.send({
          type: "broadcast",
          event: "loc",
          payload: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            ts: pos.timestamp,
          },
        });
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      supabase.removeChannel(channel);
      setActive(false);
    };
  }, [tripId, enabled]);

  return { active, error };
}
