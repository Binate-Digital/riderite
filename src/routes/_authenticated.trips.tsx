import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, MapPin, Receipt, Car, CheckCircle2, XCircle, Loader2, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/site/DashboardHeader";
import { TripTimeline } from "@/components/site/TripTimeline";
import { LiveTripMap } from "@/components/site/LiveTripMap";
import { CancelTripDialog } from "@/components/site/CancelTripDialog";

export const Route = createFileRoute("/_authenticated/trips")({
  component: TripsPage,
});

interface Trip {
  id: string;
  pickup_address: string;
  destination_address: string;
  vehicle_type: string;
  status: string;
  fare_cents: number;
  base_fare_cents: number;
  service_fee_cents: number;
  tax_cents: number;
  paid: boolean;
  payment_method: string;
  distance_miles: number;
  duration_minutes: number;
  rating: number | null;
  requested_at: string;
  completed_at: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
}

const fmtMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const PAYMENT_LABELS: Record<string, string> = {
  card: "Card",
  cashapp: "Cash App",
  paypal: "PayPal",
  cash: "Cash",
  venmo: "Venmo",
  zelle: "Zelle",
};
const OFFLINE_METHODS = new Set(["cash", "venmo", "zelle"]);

function PaymentBadge({ method, paid }: { method?: string | null; paid: boolean }) {
  const safeMethod = (method ?? "").trim().toLowerCase();
  const known = safeMethod in PAYMENT_LABELS;
  const label = known ? PAYMENT_LABELS[safeMethod] : safeMethod ? safeMethod : "Not set";
  const offline = OFFLINE_METHODS.has(safeMethod);
  const cls = !known
    ? "bg-muted text-muted-foreground border-dashed border-border"
    : offline
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : paid
        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
        : "bg-muted text-muted-foreground border-border";
  const status = !known ? "Confirm on pickup" : offline ? "Pay on pickup" : paid ? "Paid" : "Unpaid";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      <Receipt className="h-3 w-3" /> {label} · {status}
    </span>
  );
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    completed: { label: "Completed", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: <CheckCircle2 className="h-3 w-3" /> },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border", icon: <XCircle className="h-3 w-3" /> },
    in_progress: { label: "In progress", cls: "bg-primary/15 text-primary border-primary/30", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    arriving: { label: "Arriving", cls: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30", icon: <Navigation className="h-3 w-3" /> },
    accepted: { label: "Accepted", cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: <Car className="h-3 w-3" /> },
    requested: { label: "Requested", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: <Clock className="h-3 w-3" /> },
  };
  const s = map[status] ?? map.requested;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>
      {s.icon} {s.label}
    </span>
  );
}

function TripsPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [selected, setSelected] = useState<Trip | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("trips")
      .select("*")
      .eq("rider_id", user.id)
      .order("requested_at", { ascending: false })
      .then(({ data }) => setTrips((data as Trip[]) ?? []));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("rider-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `rider_id=eq.${user.id}` },
        (payload) => {
          setTrips((prev) => {
            if (!prev) return prev;
            if (payload.eventType === "INSERT") {
              return [payload.new as Trip, ...prev];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((t) => (t.id === (payload.new as Trip).id ? (payload.new as Trip) : t));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((t) => t.id !== (payload.old as Trip).id);
            }
            return prev;
          });
          // Keep selected receipt in sync if open
          setSelected((prev) => {
            if (!prev || prev.id !== (payload.new as Trip | null)?.id) return prev;
            return payload.new as Trip;
          });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const stats = useMemo(() => {
    const list = trips ?? [];
    const completed = list.filter((t) => t.status === "completed");
    return {
      total: list.length,
      completed: completed.length,
      spent: completed.reduce((a, t) => a + t.fare_cents, 0),
      miles: completed.reduce((a, t) => a + Number(t.distance_miles), 0),
    };
  }, [trips]);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] text-primary">/ MY TRIPS</div>
        <h1 className="mt-2 text-display text-5xl sm:text-6xl">YOUR <span className="text-primary">RIDE HISTORY.</span></h1>
        <p className="mt-2 text-muted-foreground">Receipts, status and totals — every trip on RideRite.</p>

        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Total rides" value={String(stats.total)} />
          <Stat label="Completed" value={String(stats.completed)} />
          <Stat label="Total spent" value={fmtMoney(stats.spent)} />
          <Stat label="Miles travelled" value={stats.miles.toFixed(1)} />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-border">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />
              <h2 className="text-display text-2xl tracking-wider">RECENT TRIPS</h2>
            </div>
            <Link to="/" className="text-sm font-bold text-primary hover:underline">Book a new ride →</Link>
          </div>
          {trips === null ? (
            <div className="p-10 text-center text-muted-foreground">Loading…</div>
          ) : trips.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-muted-foreground">No trips yet.</p>
              <Link to="/" className="mt-4 inline-block rounded-md bg-primary px-5 py-2 text-sm font-bold text-primary-foreground">Book your first ride</Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {trips.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => setSelected(t)}
                    className="w-full text-left p-6 hover:bg-background/40 transition flex items-start gap-4"
                  >
                    <div className="h-10 w-10 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                      <Car className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {statusBadge(t.status)}
                        <PaymentBadge method={t.payment_method} paid={t.paid} />
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.requested_at).toLocaleString()}
                        </span>
                        <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground">· {t.vehicle_type}</span>
                      </div>
                      <div className="mt-2 flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="truncate">{t.pickup_address} → {t.destination_address}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-display text-2xl">{fmtMoney(t.fare_cents)}</div>
                      <div className="text-xs text-muted-foreground">{Number(t.distance_miles).toFixed(1)} mi · {t.duration_minutes} min</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {selected && <ReceiptModal trip={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground uppercase">{label}</div>
      <div className="mt-2 text-display text-3xl text-primary">{value}</div>
    </div>
  );
}

function ReceiptModal({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { user } = useAuth();
  const [showCancel, setShowCancel] = useState(false);
  // Prefer real stored breakdown; fall back to a derived split for legacy rows.
  const base = trip.base_fare_cents || Math.round(trip.fare_cents * 0.78);
  const service = trip.service_fee_cents || Math.round(trip.fare_cents * 0.15);
  const tax = trip.tax_cents || Math.max(0, trip.fare_cents - base - service);
  const canCancel = ["requested", "accepted", "arriving"].includes(trip.status);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-elevated max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h3 className="text-display text-xl tracking-wider">RECEIPT</h3>
          </div>
          {statusBadge(trip.status)}
        </div>
        <div className="p-6 space-y-4">
          <div className="text-xs text-muted-foreground">{new Date(trip.requested_at).toLocaleString()}</div>
          <TripTimeline status={trip.status} cancellationReason={trip.cancellation_reason} />
          {["accepted", "arriving", "in_progress"].includes(trip.status) && (
            <LiveTripMap tripId={trip.id} />
          )}
          <div className="space-y-2 text-sm">
            <div className="flex gap-2"><MapPin className="h-4 w-4 text-primary mt-0.5" /><span><b>Pickup:</b> {trip.pickup_address}</span></div>
            <div className="flex gap-2"><MapPin className="h-4 w-4 text-primary mt-0.5" /><span><b>Drop-off:</b> {trip.destination_address}</span></div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">Vehicle</div><div className="font-bold uppercase text-sm">{trip.vehicle_type}</div></div>
            <div className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">Distance</div><div className="font-bold text-sm">{Number(trip.distance_miles).toFixed(1)} mi</div></div>
            <div className="rounded-md border border-border p-2"><div className="text-xs text-muted-foreground">Duration</div><div className="font-bold text-sm">{trip.duration_minutes} min</div></div>
          </div>
          {trip.status === "cancelled" && trip.cancellation_reason && (
            <div className="rounded-md border border-border bg-background/40 p-3 text-sm">
              <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground uppercase mb-1">Cancellation reason</div>
              <div className="text-foreground">{trip.cancellation_reason}</div>
              {trip.cancelled_at && (
                <div className="text-xs text-muted-foreground mt-1">{new Date(trip.cancelled_at).toLocaleString()}</div>
              )}
            </div>
          )}
          <div className="border-t border-border pt-4 space-y-1.5 text-sm">
            <Row label="Base fare" value={fmtMoney(base)} />
            <Row label="Service fee" value={fmtMoney(service)} />
            <Row label="Tax" value={fmtMoney(tax)} />
            <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
              <span className="text-display text-lg tracking-wider">TOTAL</span>
              <span className="text-display text-2xl text-primary">{fmtMoney(trip.fare_cents)}</span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Payment</span>
              <PaymentBadge method={trip.payment_method} paid={trip.paid} />
            </div>
          </div>
          <div className="flex gap-2">
            {canCancel && user && (
              <button
                onClick={() => setShowCancel(true)}
                className="flex-1 rounded-md border border-primary/40 bg-primary/10 py-2.5 text-sm font-bold text-primary uppercase tracking-wider hover:bg-primary/20 inline-flex items-center justify-center gap-2"
              >
                <XCircle className="h-4 w-4" /> Cancel trip
              </button>
            )}
            <button onClick={onClose} className="flex-1 rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground uppercase tracking-wider">Close</button>
          </div>
        </div>
      </div>
      {showCancel && user && (
        <CancelTripDialog
          tripId={trip.id}
          userId={user.id}
          onClose={() => setShowCancel(false)}
          onCancelled={() => { setShowCancel(false); }}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span><span className="text-foreground">{value}</span>
    </div>
  );
}
