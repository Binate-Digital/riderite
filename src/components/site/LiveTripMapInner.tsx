import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const driverIcon = L.divIcon({
  className: "",
  html: `<div style="background:#dc2626;color:white;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.45);border:2px solid white;font-weight:700;">🚗</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

interface Coords { lat: number; lng: number; speed?: number | null }

function Recenter({ coords }: { coords: Coords | null }) {
  const map = useMap();
  useEffect(() => {
    if (coords) map.setView([coords.lat, coords.lng], Math.max(map.getZoom(), 14), { animate: true });
  }, [coords, map]);
  return null;
}

export default function LiveTripMapInner({ coords }: { coords: Coords | null }) {
  const center = useMemo<[number, number]>(
    () => (coords ? [coords.lat, coords.lng] : [27.9944, -81.7603]),
    [coords],
  );
  return (
    <MapContainer center={center} zoom={coords ? 14 : 7} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {coords && (
        <>
          <Marker position={[coords.lat, coords.lng]} icon={driverIcon}>
            <Popup>
              Driver en route<br />
              {coords.speed != null ? `${Math.round((coords.speed ?? 0) * 2.237)} mph` : ""}
            </Popup>
          </Marker>
          <Recenter coords={coords} />
        </>
      )}
    </MapContainer>
  );
}
