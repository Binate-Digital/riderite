import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Loader2,
  MapPin,
  Navigation,
  Truck,
  Users,
  CheckCircle2,
} from "lucide-react";
import { DashboardHeader } from "@/components/site/DashboardHeader";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { getFareEstimate } from "@/lib/booking.functions";
import { PickupDropoffMap } from "@/components/booking/PickupDropoffMap";
import { FareBreakdown } from "@/components/booking/FareBreakdown";
import type { PromoResult } from "@/lib/promos.functions";

export const Route = createFileRoute("/_authenticated/ride")({
  component: RidePage,
});

type Vehicle = "sedan" | "suv" | "truck";
type Coords = { lat: number; lng: number } | null;

const VEHICLES: Array<{
  id: Vehicle;
  title: string;
  subtitle: string;
  blurb: string;
  Icon: typeof Truck;
}> = [
  {
    id: "truck",
    title: "Truck",
    subtitle: "Hauls & big loads",
    blurb: "Pickup truck — move furniture, gear, or oversize items.",
    Icon: Truck,
  },
  {
    id: "suv",
    title: "SUV",
    subtitle: "Up to 6 riders",
    blurb: "Roomy SUV — extra seats and cargo room.",
    Icon: Users,
  },
  {
    id: "sedan",
    title: "Salon (Sedan)",
    subtitle: "Up to 4 riders",
    blurb: "Standard sedan — quick, affordable everyday ride.",
    Icon: Car,
  },
];

type Estimate = {
  totalCents: number;
  baseFareCents: number;
  baseRateCents: number;
  distanceCents: number;
  timeCents: number;
  bookingFeeCents: number;
  serviceFeeCents: number;
  taxCents: number;
  discountCents: number;
  distanceMiles: number;
  durationMinutes: number;
};

function RidePage() {
  const navigate = useNavigate();
  const estimateFn = useServerFn(getFareEstimate);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [vehicle, setVehicle] = useState<Vehicle>("truck");
  const [pickup, setPickup] = useState("");
  const [pickupCoords, setPickupCoords] = useState<Coords>(null);
  const [destination, setDestination] = useState("");
  const [destinationCoords, setDestinationCoords] = useState<Coords>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [promo, setPromo] = useState<PromoResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAdvanceAddresses = pickup.trim().length > 1 && destination.trim().length > 1;

  async function fetchEstimate(promoCode?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await estimateFn({
        data: { pickup, destination, pickupCoords, destinationCoords, vehicle, promoCode },
      });
      setEstimate({
        totalCents: res.totalCents,
        baseFareCents: res.baseFareCents,
        baseRateCents: res.baseRateCents,
        distanceCents: res.distanceCents,
        timeCents: res.timeCents,
        bookingFeeCents: res.bookingFeeCents,
        serviceFeeCents: res.serviceFeeCents,
        taxCents: res.taxCents,
        discountCents: res.discountCents,
        distanceMiles: res.distanceMiles,
        durationMinutes: res.durationMinutes,
      });
      return res;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not estimate fare");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function goToEstimate() {
    if (!canAdvanceAddresses) return;
    const res = await fetchEstimate();
    if (res) setStep(3);
  }

  async function handlePromoChange(p: PromoResult | null) {
    setPromo(p);
    // Re-fetch with new code to keep totals server-validated
    await fetchEstimate(p?.code);
  }

  function confirmAndBook() {
    navigate({
      to: "/book",
      search: {
        pickup,
        destination,
        vehicle,
        pLat: pickupCoords?.lat,
        pLng: pickupCoords?.lng,
        dLat: destinationCoords?.lat,
        dLng: destinationCoords?.lng,
        promo: promo?.ok ? promo.code : undefined,
      } as any,
    });
  }

  const subtotalBeforeDiscount = estimate
    ? estimate.baseFareCents + estimate.serviceFeeCents + estimate.taxCents
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-6 sm:max-w-lg sm:px-6">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition ${
                step >= n ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
            / Step {step} of 3
          </span>
          {step > 1 && (
            <button
              onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)}
              className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
          )}
        </div>

        {step === 1 && (
          <section className="mt-5">
            <h1 className="text-display text-3xl leading-tight sm:text-4xl">
              PICK YOUR <span className="text-primary">RIDE</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose the vehicle that fits your trip.</p>
            <div className="mt-5 space-y-3">
              {VEHICLES.map(({ id, title, subtitle, blurb, Icon }) => {
                const active = vehicle === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVehicle(id)}
                    className={`grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border p-4 text-left transition ${
                      active ? "border-primary bg-primary/10 shadow-elevated" : "border-border bg-surface hover:border-primary/60"
                    }`}
                    aria-pressed={active}
                  >
                    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-background text-primary"}`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold tracking-wide">{title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{subtitle} · {blurb}</span>
                    </span>
                    <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${active ? "border-primary bg-primary" : "border-border"}`} aria-hidden />
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(2)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-red transition hover:brightness-110"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="mt-5">
            <h1 className="text-display text-3xl leading-tight sm:text-4xl">
              WHERE TO, <span className="text-primary">RIDER?</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Search, type, or drop pins on the map.
            </p>

            <div className="mt-4">
              <PickupDropoffMap
                pickup={pickupCoords}
                destination={destinationCoords}
                onPickupChange={(c, addr) => {
                  setPickupCoords(c);
                  if (addr) setPickup(addr);
                  setEstimate(null);
                }}
                onDestinationChange={(c, addr) => {
                  setDestinationCoords(c);
                  if (addr) setDestination(addr);
                  setEstimate(null);
                }}
              />
            </div>

            <div className="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
              <AddressAutocomplete
                icon={<MapPin className="h-4 w-4 text-primary" />}
                placeholder="Pickup location"
                value={pickup}
                onChange={(v, c) => {
                  setPickup(v);
                  setPickupCoords(c ?? null);
                  setEstimate(null);
                }}
              />
              <AddressAutocomplete
                icon={<Navigation className="h-4 w-4 text-primary" />}
                placeholder="Where to?"
                value={destination}
                onChange={(v, c) => {
                  setDestination(v);
                  setDestinationCoords(c ?? null);
                  setEstimate(null);
                }}
              />
            </div>

            {error && (
              <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            <button
              onClick={goToEstimate}
              disabled={!canAdvanceAddresses || loading}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-red transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (<><Loader2 className="h-4 w-4 animate-spin" /> Estimating…</>) : (<>Get estimate <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </section>
        )}

        {step === 3 && estimate && (
          <section className="mt-5">
            <h1 className="text-display text-3xl leading-tight sm:text-4xl">
              YOUR <span className="text-primary">FARE</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Full breakdown — apply a promo code or confirm to continue.
            </p>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Route</div>
                <div className="mt-2 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="min-w-0 break-words">{pickup}</span>
                </div>
                <div className="mt-1 flex items-start gap-2 text-sm">
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  <span className="min-w-0 break-words">{destination}</span>
                </div>
              </div>

              <FareBreakdown
                vehicleLabel={VEHICLES.find((v) => v.id === vehicle)?.title ?? vehicle}
                distanceMiles={estimate.distanceMiles}
                durationMinutes={estimate.durationMinutes}
                baseRateCents={estimate.baseRateCents}
                distanceCents={estimate.distanceCents}
                timeCents={estimate.timeCents}
                bookingFeeCents={estimate.bookingFeeCents}
                serviceFeeCents={estimate.serviceFeeCents}
                taxCents={estimate.taxCents}
                totalCents={estimate.totalCents}
                discountCents={estimate.discountCents}
                subtotalBeforeDiscount={subtotalBeforeDiscount}
                promo={promo}
                onPromoChange={handlePromoChange}
              />
            </div>

            <div className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <button
                onClick={() => setStep(2)}
                className="rounded-xl border border-border bg-surface px-4 py-4 text-sm font-bold text-foreground hover:border-primary/60"
              >
                Edit
              </button>
              <button
                onClick={confirmAndBook}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-bold text-primary-foreground shadow-red transition hover:brightness-110"
              >
                <CheckCircle2 className="h-4 w-4" /> Confirm & pay
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
