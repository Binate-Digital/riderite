import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Navigation, WifiOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Lazy-load the actual Leaflet map so it never runs during SSR.
const MapInner = lazy(() => import("./LiveTripMapInner"));

interface Coords { lat: number; lng: number; heading?: number | null; speed?: number | null; ts: number }

export function LiveTripMap({ tripId }: { tripId: string }) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [connected, setConnected] = useState(false);
  const lastSeen = useRef<number>(0);
  const [stale, setStale] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const channel = supabase.channel(`trip-loc:${tripId}`, { config: { broadcast: { self: false } } });
    channel
      .on("broadcast", { event: "loc" }, (msg) => {
        const p = msg.payload as Coords;
        if (typeof p?.lat === "number" && typeof p?.lng === "number") {
          lastSeen.current = Date.now();
          setStale(false);
          setCoords(p);
        }
      })
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    const interval = setInterval(() => {
      if (lastSeen.current && Date.now() - lastSeen.current > 15000) setStale(true);
    }, 3000);

    return () => { clearInterval(interval); supabase.removeChannel(channel); };
  }, [tripId]);

  return (
    <div className="rounded-xl border border-border bg-background/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-muted-foreground uppercase">
          <Navigation className="h-3.5 w-3.5 text-primary" /> Live driver location
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider">
          {!connected ? (
            <span className="text-muted-foreground inline-flex items-center gap-1"><WifiOff className="h-3 w-3" /> Connecting…</span>
          ) : !coords ? (
            <span className="text-muted-foreground">Waiting for driver…</span>
          ) : stale ? (
            <span className="text-amber-400">Signal lost · reconnecting</span>
          ) : (
            <span className="text-emerald-400 inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
            </span>
          )}
        </div>
      </div>
      <div className="h-64 w-full bg-muted">
        {mounted && (
          <Suspense fallback={<div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">Loading map…</div>}>
            <MapInner coords={coords} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
