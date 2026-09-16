import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

type Coords = { lat: number; lng: number };

interface Props {
  pickup: Coords;
  destination: Coords;
  /** Progress 0..1 from driver start → pickup (then → destination) */
  driverProgress: number;
  /** Phase determines driver path */
  phase: "approaching" | "in_progress";
}

declare global {
  interface Window {
    google?: any;
    __riderite_initMap?: () => void;
  }
}

const SCRIPT_ID = "google-maps-js";

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (document.getElementById(SCRIPT_ID)) {
      const check = () => (window.google?.maps ? resolve() : setTimeout(check, 50));
      return check();
    }
    const key = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
    const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
    if (!key) return reject(new Error("Google Maps key missing"));
    window.__riderite_initMap = () => resolve();
    const s = document.createElement("script");
    s.id = SCRIPT_ID;
    s.async = true;
    s.defer = true;
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__riderite_initMap${channel ? `&channel=${channel}` : ""}`;
    s.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(s);
  });
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function LiveTripMap({ pickup, destination, driverProgress, phase }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const driverMarkerRef = useRef<any>(null);
  const lineRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Driver origin = offset 0.6mi NE of pickup (simulated)
  const driverOrigin: Coords = {
    lat: pickup.lat + 0.009,
    lng: pickup.lng + 0.011,
  };

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.maps) return;
        const g = window.google.maps;
        const map = new g.Map(containerRef.current, {
          center: pickup,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#0c0c10" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#0c0c10" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#1f2024" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1a2a" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
          ],
        });
        mapRef.current = map;

        pickupMarkerRef.current = new g.Marker({
          map,
          position: pickup,
          label: { text: "A", color: "#fff", fontWeight: "bold" },
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: "#10b981",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        destMarkerRef.current = new g.Marker({
          map,
          position: destination,
          label: { text: "B", color: "#fff", fontWeight: "bold" },
          icon: {
            path: g.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: "#ef4444",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        driverMarkerRef.current = new g.Marker({
          map,
          position: driverOrigin,
          icon: {
            path: "M -8 -4 L 8 -4 L 10 0 L 8 4 L -8 4 L -10 0 Z",
            scale: 1.4,
            fillColor: "#facc15",
            fillOpacity: 1,
            strokeColor: "#000",
            strokeWeight: 1.5,
            rotation: 0,
          },
        });

        const bounds = new g.LatLngBounds();
        bounds.extend(pickup);
        bounds.extend(destination);
        bounds.extend(driverOrigin);
        map.fitBounds(bounds, 60);

        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Animate driver position
  useEffect(() => {
    if (!ready || !driverMarkerRef.current || !window.google?.maps) return;
    const t = Math.max(0, Math.min(1, driverProgress));
    const from = phase === "approaching" ? driverOrigin : pickup;
    const to = phase === "approaching" ? pickup : destination;
    const pos = { lat: lerp(from.lat, to.lat, t), lng: lerp(from.lng, to.lng, t) };
    driverMarkerRef.current.setPosition(pos);
    // Draw polyline of remaining path
    if (lineRef.current) lineRef.current.setMap(null);
    lineRef.current = new window.google.maps.Polyline({
      map: mapRef.current,
      path: [pos, to],
      strokeColor: phase === "approaching" ? "#facc15" : "#ef4444",
      strokeOpacity: 0.9,
      strokeWeight: 3,
    });
  }, [driverProgress, phase, ready]);

  return (
    <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-border bg-background">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && !error && (
        <div className="absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center p-4 text-center text-xs text-destructive">{error}</div>
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-background/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground backdrop-blur">
        {phase === "approaching" ? "Driver approaching" : "On the way to drop-off"}
      </div>
    </div>
  );
}
