import heroImg from "@/assets/hero-suv.jpg";
import { MapPin, Navigation } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

export function Hero() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [vehicle, setVehicle] = useState<"sedan" | "suv" | "truck">("sedan");
  const goBook = () =>
    navigate({
      to: "/book",
      search: {
        pickup,
        destination,
        vehicle,
        ...(pickupCoords && { pLat: pickupCoords.lat, pLng: pickupCoords.lng }),
        ...(destinationCoords && { dLat: destinationCoords.lat, dLng: destinationCoords.lng }),
      },
    });
  return (
    <section className="relative min-h-[100svh] overflow-hidden pt-24 bg-gradient-hero" id="book">
      <div className="absolute inset-0 -z-0">
        <img src={heroImg} alt="Black SUV on a Miami street at night" width={1600} height={1200}
             className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-background/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-transparent to-transparent" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 pt-16 pb-24 grid lg:grid-cols-12 gap-12 items-center">
        <div className="lg:col-span-7 animate-slide-in">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse-red" />
            NOW LIVE IN FLORIDA
          </div>
          <h1 className="mt-6 text-display text-6xl sm:text-7xl lg:text-8xl leading-[0.9]">
            YOUR RIDE.<br />
            <span className="text-primary">DONE RIGHT.</span><br />
            EVERY TIME.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Sedans, SUVs and trucks — one app, on demand. RideRite is Florida's bold new way to move,
            built for riders who expect more and drivers who deserve better.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <button onClick={goBook} className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-red hover:brightness-110 transition">
              Book a ride
            </button>
            <a href="#drive" className="inline-flex items-center justify-center rounded-md border border-border bg-surface/60 px-6 py-3 text-base font-bold text-foreground hover:border-primary transition">
              Drive & earn
            </a>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <Stat value="3 min" label="Avg. pickup" />
            <Stat value="24/7" label="Always on" />
            <Stat value="100%" label="Vetted drivers" />
          </div>
        </div>

        {/* Booking card */}
        <div className="lg:col-span-5 animate-slide-in" style={{ animationDelay: "0.15s" }}>
          <div className="rounded-2xl bg-surface/90 backdrop-blur-xl border border-border p-6 shadow-elevated">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-display text-2xl tracking-wider">REQUEST A RIDE</h3>
              <span className="text-xs font-semibold text-primary">LIVE</span>
            </div>
            <div className="space-y-3">
              <AddressAutocomplete icon={<MapPin className="h-4 w-4 text-primary" />} placeholder="Pickup location" value={pickup} onChange={(v, c) => { setPickup(v); setPickupCoords(c ?? null); }} />
              <AddressAutocomplete icon={<Navigation className="h-4 w-4 text-primary" />} placeholder="Where to?" value={destination} onChange={(v, c) => { setDestination(v); setDestinationCoords(c ?? null); }} />
              <div className="grid grid-cols-3 gap-2 pt-2">
                {(["sedan", "suv", "truck"] as const).map((t) => (
                  <button key={t} onClick={() => setVehicle(t)} className={`rounded-md border px-3 py-3 text-xs font-bold uppercase transition ${vehicle === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <button onClick={goBook} className="mt-2 w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-red hover:brightness-110 transition">
                See price & book
              </button>
              <p className="text-center text-xs text-muted-foreground">Estimates from $7 · Pay securely with Stripe</p>
            </div>
          </div>
        </div>
      </div>

      <div className="red-stripe" />
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-display text-3xl text-foreground">{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ icon, placeholder, value, onChange }: { icon: React.ReactNode; placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-background/60 px-3 py-3">
      {icon}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
      />
    </div>
  );
}
