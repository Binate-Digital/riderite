import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { reverseGeocode } from "@/lib/geocode.functions";

type Coords = { lat: number; lng: number };

interface Props {
  pickup: Coords | null;
  destination: Coords | null;
  onPickupChange: (c: Coords, address?: string) => void;
  onDestinationChange: (c: Coords, address?: string) => void;
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
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=__riderite_initMap${channel ? `&channel=${channel}` : ""}`;
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

export function PickupDropoffMap({ pickup, destination, onPickupChange, onDestinationChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const pickupMarkerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePin, setActivePin] = useState<"pickup" | "destination">("pickup");
  const reverseFn = useServerFn(reverseGeocode);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        const center = pickup ?? destination ?? { lat: 28.5383, lng: -81.3792 }; // Orlando, FL default
        const map = new window.google.maps.Map(containerRef.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          styles: [
            { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#383838" }] },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e0e1a" }] },
          ],
        });
        mapRef.current = map;

        map.addListener("click", async (e: any) => {
          const c = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          if (activePin === "pickup") setPickupMarker(c);
          else setDestMarker(c);
          const { address } = await reverseFn({ data: c });
          if (activePin === "pickup") onPickupChange(c, address);
          else onDestinationChange(c, address);
        });

        setReady(true);
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-bind click handler when activePin changes
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    window.google.maps.event.clearListeners(mapRef.current, "click");
    mapRef.current.addListener("click", async (e: any) => {
      const c = { lat: e.latLng.lat(), lng: e.latLng.lng() };
      if (activePin === "pickup") setPickupMarker(c);
      else setDestMarker(c);
      const { address } = await reverseFn({ data: c });
      if (activePin === "pickup") onPickupChange(c, address);
      else onDestinationChange(c, address);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePin]);

  // Sync external coords -> markers
  useEffect(() => {
    if (!ready) return;
    if (pickup) setPickupMarker(pickup);
    if (destination) setDestMarker(destination);
    if (pickup && destination && mapRef.current && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(destination);
      mapRef.current.fitBounds(bounds, 64);
    } else if (pickup && mapRef.current) {
      mapRef.current.panTo(pickup);
    } else if (destination && mapRef.current) {
      mapRef.current.panTo(destination);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  function setPickupMarker(c: Coords) {
    if (!window.google || !mapRef.current) return;
    if (pickupMarkerRef.current) pickupMarkerRef.current.setPosition(c);
    else {
      pickupMarkerRef.current = new window.google.maps.Marker({
        position: c,
        map: mapRef.current,
        draggable: true,
        label: { text: "A", color: "#fff", fontWeight: "700" },
        icon: pinIcon("#22c55e"),
      });
      pickupMarkerRef.current.addListener("dragend", async (e: any) => {
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        const { address } = await reverseFn({ data: p });
        onPickupChange(p, address);
      });
    }
  }

  function setDestMarker(c: Coords) {
    if (!window.google || !mapRef.current) return;
    if (destMarkerRef.current) destMarkerRef.current.setPosition(c);
    else {
      destMarkerRef.current = new window.google.maps.Marker({
        position: c,
        map: mapRef.current,
        draggable: true,
        label: { text: "B", color: "#fff", fontWeight: "700" },
        icon: pinIcon("#ef4444"),
      });
      destMarkerRef.current.addListener("dragend", async (e: any) => {
        const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        const { address } = await reverseFn({ data: p });
        onDestinationChange(p, address);
      });
    }
  }

  return (
    <div className="relative">
      <div className="absolute left-2 right-2 top-2 z-10 flex items-center justify-between gap-2 rounded-lg bg-background/90 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur">
        <span className="text-muted-foreground">Tap map to drop pin</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setActivePin("pickup")}
            className={`rounded-md px-2 py-1 ${activePin === "pickup" ? "bg-emerald-500 text-white" : "bg-emerald-500/15 text-emerald-300"}`}
          >
            A · Pickup
          </button>
          <button
            type="button"
            onClick={() => setActivePin("destination")}
            className={`rounded-md px-2 py-1 ${activePin === "destination" ? "bg-red-500 text-white" : "bg-red-500/15 text-red-300"}`}
          >
            B · Drop-off
          </button>
        </div>
      </div>
      <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-xl border border-border bg-background" />
      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {error && (
        <div className="absolute inset-x-2 bottom-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Map unavailable: {error}
        </div>
      )}
    </div>
  );
}

function pinIcon(color: string) {
  if (!window.google) return undefined;
  return {
    path: "M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z",
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#0a0a0a",
    strokeWeight: 1.5,
    scale: 1.6,
    anchor: new window.google.maps.Point(12, 22),
    labelOrigin: new window.google.maps.Point(12, 9),
  };
}
