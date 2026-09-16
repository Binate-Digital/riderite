import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Star, Car, Loader2, X, Calendar, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cancelTrip, rescheduleTrip, type CancelResult } from "@/lib/cancel-trip.functions";
import { getStripeEnvironment } from "@/lib/stripe";
import { LiveTripMap } from "@/components/booking/LiveTripMap";

interface Props {
  tripId: string;
  onCanceled?: () => void;
}

type TripRow = {
  id: string;
  status: string;
  driver_id: string | null;
  vehicle_type: string;
  requested_at: string | null;
  scheduled_for: string | null;
  paid: boolean;
  fare_cents: number | null;
  payment_method: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
};

type DriverInfo = {
  name: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;
};

const GRACE_SEC = 120;
const FEE_AFTER_MATCH = 500;

const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;

export function BookingConfirmation({ tripId, onCanceled }: Props) {
  const [trip, setTrip] = useState<TripRow | null>(null);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [etaSec, setEtaSec] = useState<number>(() => (4 + Math.floor(Math.random() * 4)) * 60);
  const [phase, setPhase] = useState<"approaching" | "in_progress">("approaching");
  const [progress, setProgress] = useState(0);
  const [showCancel, setShowCancel] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [working, setWorking] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [error, setError] = useState<string | null>(null);

  const cancelFn = useServerFn(cancelTrip);
  const rescheduleFn = useServerFn(rescheduleTrip);

  // Poll trip status
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      const { data } = await supabase
        .from("trips")
        .select("id, status, driver_id, vehicle_type, requested_at, scheduled_for, paid, fare_cents, payment_method, pickup_lat, pickup_lng, destination_lat, destination_lng")
        .eq("id", tripId)
        .maybeSingle();
      if (cancelled || !data) return;
      setTrip(data as TripRow);
      if (data.driver_id && !driver) {
        const { data: dp } = await supabase
          .from("driver_profiles")
          .select("user_id, make, model, year, license_plate")
          .eq("user_id", data.driver_id)
          .maybeSingle();
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", data.driver_id)
          .maybeSingle();
        if (dp) {
          setDriver({
            name: prof?.full_name || "Your driver",
            make: dp.make,
            model: dp.model,
            year: dp.year,
            license_plate: dp.license_plate,
          });
        }
      }
    }
    void tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [tripId, driver]);

  // Live ETA + progress simulation
  useEffect(() => {
    if (!trip || cancelResult) return;
    if (trip.status === "completed" || trip.status === "cancelled") return;
    const id = setInterval(() => {
      setEtaSec((s) => {
        const next = Math.max(0, s - 5);
        return next;
      });
      setProgress((p) => {
        const inc = phase === "approaching" ? 0.012 : 0.008;
        const np = p + inc;
        if (np >= 1) {
          if (phase === "approaching") {
            setPhase("in_progress");
            setEtaSec(8 * 60);
            return 0;
          }
          return 1;
        }
        return np;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [trip, phase, cancelResult]);

  const elapsedSec = trip?.requested_at ? (Date.now() - new Date(trip.requested_at).getTime()) / 1000 : 0;
  const inGrace = elapsedSec < GRACE_SEC;
  const driverAssigned = !!trip?.driver_id;
  const isCanceled = trip?.status === "cancelled";
  const inProgress = trip?.status === "in_progress" || trip?.status === "completed";

  // Refund preview
  const refundPreview = useMemo(() => {
    const fare = trip?.fare_cents ?? 0;
    if (!trip?.paid) {
      return { fee: 0, refund: 0, label: "No charge — nothing to refund." };
    }
    if (inGrace || !driverAssigned) {
      return { fee: 0, refund: fare, label: "Full refund — within free window." };
    }
    const fee = Math.min(FEE_AFTER_MATCH, fare);
    return { fee, refund: Math.max(0, fare - fee), label: "Partial refund — driver assigned." };
  }, [trip, inGrace, driverAssigned]);

  const etaMin = Math.max(1, Math.round(etaSec / 60));

  const hasCoords =
    trip?.pickup_lat != null && trip?.pickup_lng != null &&
    trip?.destination_lat != null && trip?.destination_lng != null;

  async function handleCancel() {
    setWorking(true);
    setError(null);
    try {
      const res = await cancelFn({ data: { tripId, environment: getStripeEnvironment() } });
      setCancelResult(res);
      onCanceled?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel");
    } finally {
      setWorking(false);
    }
  }

  async function handleReschedule() {
    if (!rescheduleTime) return;
    setWorking(true);
    setError(null);
    try {
      await rescheduleFn({ data: { tripId, scheduledFor: new Date(rescheduleTime).toISOString() } });
      setShowReschedule(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reschedule");
    } finally {
      setWorking(false);
    }
  }

  if (cancelResult) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-200">
          <ShieldAlert className="h-4 w-4" /> Ride canceled
        </div>
        <p className="mt-2 text-sm text-amber-100/90">{cancelResult.message}</p>
        {cancelResult.refundCents > 0 && (
          <p className="mt-1 text-xs text-amber-200/80">
            Refund: {fmt(cancelResult.refundCents)}
            {cancelResult.feeCents > 0 && ` (after ${fmt(cancelResult.feeCents)} fee)`}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Live tracking map */}
      {hasCoords && driverAssigned && !isCanceled && (
        <LiveTripMap
          pickup={{ lat: trip!.pickup_lat!, lng: trip!.pickup_lng! }}
          destination={{ lat: trip!.destination_lat!, lng: trip!.destination_lng! }}
          driverProgress={progress}
          phase={phase}
        />
      )}

      {/* Driver / vehicle / ETA */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">
            {!driverAssigned ? "Finding your driver…" : phase === "approaching" ? "Driver on the way" : "En route to drop-off"}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-300">
            <Clock className="h-3 w-3" /> ETA {etaMin} min
          </span>
        </div>

        {driver ? (
          <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)] gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-display text-xl text-primary">
              {driver.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-base font-bold">
                {driver.name}
                <span className="inline-flex items-center gap-0.5 text-xs text-amber-300">
                  <Star className="h-3 w-3 fill-amber-300" /> 4.9
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Car className="h-3.5 w-3.5" />
                <span className="truncate">{driver.year} {driver.make} {driver.model}</span>
              </div>
              <div className="mt-1 inline-block rounded-md border border-border bg-background px-2 py-0.5 font-mono text-xs tracking-wider">
                {driver.license_plate}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Matching you with a nearby {trip?.vehicle_type ?? "driver"}…
          </div>
        )}
      </div>

      {/* Refund policy */}
      <div className="rounded-xl border border-border bg-background/50 p-4 text-xs text-muted-foreground">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-foreground">Cancellation policy</div>
        <ul className="list-inside list-disc space-y-0.5">
          <li>Free within <span className="font-bold text-foreground">2 minutes</span> or before a driver is matched.</li>
          <li>$5 fee after a driver is assigned; remainder refunded.</li>
          <li>No refund once the ride is in progress.</li>
        </ul>
      </div>

      {/* Actions */}
      {!isCanceled && !inProgress && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShowReschedule(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold hover:border-primary/60"
          >
            <Calendar className="h-4 w-4" /> Reschedule
          </button>
          <button
            type="button"
            onClick={() => setShowCancel(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/20"
          >
            <X className="h-4 w-4" /> Cancel ride
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Cancel modal with refund breakdown */}
      {showCancel && (
        <Modal onClose={() => setShowCancel(false)}>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Confirm cancel</div>
          <h2 className="mt-2 text-display text-2xl">REVIEW REFUND</h2>
          <p className="mt-2 text-sm text-muted-foreground">{refundPreview.label}</p>

          <div className="mt-4 space-y-2 rounded-xl border border-border bg-background/60 p-4 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Fare paid</span>
              <span className="font-mono">{fmt(trip?.fare_cents ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Cancellation fee</span>
              <span className="font-mono">{refundPreview.fee > 0 ? `− ${fmt(refundPreview.fee)}` : "—"}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold">
              <span>Refund to you</span>
              <span className="font-mono text-emerald-300">{fmt(refundPreview.refund)}</span>
            </div>
          </div>

          <ul className="mt-3 space-y-0.5 text-[11px] text-muted-foreground">
            <li>• Refunds post to the original payment method in 5–10 business days.</li>
            <li>• Offline payments (cash/Venmo/Zelle) aren't charged, so no refund is needed.</li>
          </ul>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowCancel(false)}
              className="rounded-md border border-border px-4 py-3 text-xs font-bold uppercase text-muted-foreground"
            >
              Keep ride
            </button>
            <button
              onClick={handleCancel}
              disabled={working}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-3 text-xs font-bold uppercase text-destructive-foreground disabled:opacity-50"
            >
              {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm cancel"}
            </button>
          </div>
        </Modal>
      )}

      {/* Reschedule modal with price diff */}
      {showReschedule && (
        <Modal onClose={() => setShowReschedule(false)}>
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Reschedule</div>
          <h2 className="mt-2 text-display text-2xl">PICK A NEW TIME</h2>
          <p className="mt-2 text-sm text-muted-foreground">Choose at least 5 minutes from now. Your payment stays on file.</p>
          <input
            type="datetime-local"
            value={rescheduleTime}
            onChange={(e) => setRescheduleTime(e.target.value)}
            className="mt-4 w-full rounded-md border border-border bg-background/60 px-3 py-3 text-sm outline-none focus:border-primary"
          />

          <div className="mt-4 space-y-2 rounded-xl border border-border bg-background/60 p-4 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Current fare</span>
              <span className="font-mono">{fmt(trip?.fare_cents ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Price change</span>
              <span className="font-mono text-emerald-300">$0.00</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-base font-bold">
              <span>New total</span>
              <span className="font-mono">{fmt(trip?.fare_cents ?? 0)}</span>
            </div>
            <p className="pt-1 text-[11px] text-muted-foreground">
              Same pickup, drop-off, and vehicle — price is unchanged. Surge or scheduled-time premiums would appear here.
            </p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => setShowReschedule(false)}
              className="rounded-md border border-border px-4 py-3 text-xs font-bold uppercase text-muted-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleReschedule}
              disabled={working || !rescheduleTime}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-3 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
            >
              {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (<><CheckCircle2 className="h-3.5 w-3.5" /> Confirm new time</>)}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
