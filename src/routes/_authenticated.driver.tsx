import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { DollarSign, Car, Star, TrendingUp, Clock, MapPin, Gauge, ShieldAlert, Navigation, Radio, Receipt, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/site/DashboardHeader";
import { useDriverLocationBroadcaster } from "@/hooks/use-driver-location";
import { completeTripAndSendReceipt, advanceTripStatus } from "@/lib/trips.functions";
import { useDriverEligibility } from "@/hooks/use-driver-eligibility";


export const Route = createFileRoute("/_authenticated/driver")({
  component: DriverHubGated,
});

function DriverHubGated() {
  const { user } = useAuth();
  const elig = useDriverEligibility(user?.id);
  if (elig.loading) return null;
  if (elig.suspended) return <Navigate to="/account/suspended" />;
  return (
    <>
      {!elig.canAccept && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-4 py-2 text-center text-xs font-bold text-amber-200">
          You can't accept trips yet — {elig.reason}.{" "}
          <Link to="/driver/billing" className="underline inline-flex items-center gap-1">
            <CreditCard className="h-3 w-3" /> Fix in billing
          </Link>
        </div>
      )}
      <DriverHub />
    </>
  );
}

interface Trip {
  id: string;
  pickup_address: string;
  destination_address: string;
  vehicle_type: string;
  status: string;
  fare_cents: number;
  distance_miles: number;
  duration_minutes: number;
  rating: number | null;
  requested_at: string;
  completed_at: string | null;
  payment_method: string;
  paid: boolean;
}
interface DriverProfile {
  vehicle_type: string;
  make: string;
  model: string;
  year: number;
  license_plate: string;
  status: string;
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

function DriverHub() {
  const { user, roles } = useAuth();
  const isDriver = roles.includes("driver");
  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [openRequests, setOpenRequests] = useState<Trip[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("driver_profiles").select("*").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setDriver(data as DriverProfile | null));
    supabase.from("trips").select("*").eq("driver_id", user.id).order("requested_at", { ascending: false })
      .then(({ data }) => setTrips((data as Trip[]) ?? []));
  }, [user]);

  // Open paid requests — limited fields only (no rider addresses/coords) via SECURITY DEFINER RPC
  useEffect(() => {
    if (!user || !isDriver) return;
    const fetchOpen = async () => {
      const { data } = await supabase.rpc("list_open_trip_requests");
      setOpenRequests((data as Trip[]) ?? []);
    };
    void fetchOpen();
    const interval = setInterval(() => { void fetchOpen(); }, 10000);
    const ch = supabase
      .channel("open-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => { void fetchOpen(); })
      .subscribe();
    return () => { clearInterval(interval); supabase.removeChannel(ch); };
  }, [user, isDriver]);

  const acceptTrip = async (tripId: string) => {
    if (!user) return;
    const { error } = await supabase.rpc("accept_trip_request", { _trip_id: tripId });
    if (error) return alert(error.message);
    const { data } = await supabase.from("trips").select("*").eq("id", tripId).maybeSingle();
    if (data) setTrips((prev) => [data as Trip, ...(prev ?? [])]);
  };

  const completeTrip = useServerFn(completeTripAndSendReceipt);
  const advanceTrip = useServerFn(advanceTripStatus);

  const advanceStatus = async (tripId: string, next: "arriving" | "in_progress" | "completed") => {
    try {
      if (next === "completed") {
        await completeTrip({ data: { tripId } });
      } else {
        await advanceTrip({ data: { tripId, next } });
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update trip");
    }
  };


  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("driver-trips")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trips", filter: `driver_id=eq.${user.id}` },
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
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const stats = useMemo(() => {
    const list = (trips ?? []).filter((t) => t.status === "completed");
    const earnings = list.reduce((a, t) => a + Math.round(t.fare_cents * 0.8), 0);
    const ratings = list.filter((t) => t.rating !== null).map((t) => t.rating as number);
    const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
    const minutes = list.reduce((a, t) => a + t.duration_minutes, 0);
    const earningsPerHour = minutes > 0 ? earnings / (minutes / 60) : 0;
    // Last 7 days
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const week = list.filter((t) => new Date(t.completed_at ?? t.requested_at).getTime() >= since);
    return {
      trips: list.length,
      earnings,
      miles: list.reduce((a, t) => a + Number(t.distance_miles), 0),
      hours: minutes / 60,
      avgRating,
      acceptanceRate: trips && trips.length ? (list.length / trips.length) * 100 : 0,
      weekEarnings: week.reduce((a, t) => a + Math.round(t.fare_cents * 0.8), 0),
      weekTrips: week.length,
      earningsPerHour,
    };
  }, [trips]);

  if (!isDriver) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardHeader />
        <main className="mx-auto max-w-3xl px-6 py-20 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-display text-4xl">DRIVER ACCESS REQUIRED</h1>
          <p className="mt-2 text-muted-foreground">You're not registered as a driver yet. Sign up your vehicle to access earnings, trip performance and the driver hub.</p>
          <Link to="/become-driver" className="mt-6 inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">Become a driver →</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] text-primary">/ DRIVER HUB</div>
        <h1 className="mt-2 text-display text-5xl sm:text-6xl">YOUR <span className="text-primary">EARNINGS.</span></h1>
        <p className="mt-2 text-muted-foreground">Performance, payouts and trips delivered.</p>

        {driver && (
          <div className="mt-8 rounded-2xl border border-border bg-gradient-red text-primary-foreground p-6 flex items-center justify-between flex-wrap gap-4 shadow-elevated">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-background/20 inline-flex items-center justify-center"><Car className="h-6 w-6" /></div>
              <div>
                <div className="text-xs font-bold tracking-[0.25em] uppercase opacity-80">Active vehicle</div>
                <div className="text-display text-2xl">{driver.year} {driver.make.toUpperCase()} {driver.model.toUpperCase()}</div>
                <div className="text-sm opacity-90">{driver.vehicle_type.toUpperCase()} · Plate {driver.license_plate}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-bold tracking-[0.25em] uppercase opacity-80">Status</div>
              <div className="text-display text-2xl">{driver.status.toUpperCase()}</div>
            </div>
          </div>
        )}

        <LiveShareCard trips={trips} />

        {/* Open ride requests */}
        <div className="mt-8 rounded-2xl border border-primary/40 bg-surface overflow-hidden">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <Radio className="h-5 w-5 text-primary animate-pulse" />
            <h2 className="text-display text-2xl tracking-wider">OPEN REQUESTS</h2>
            <span className="ml-auto text-xs text-muted-foreground">{openRequests.length} waiting</span>
          </div>
          {openRequests.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No open requests right now. They'll show here in real time.</div>
          ) : (
            <ul className="divide-y divide-border">
              {openRequests.map((t) => (
                <li key={t.id} className="p-5 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground"><span className="uppercase font-bold">{t.vehicle_type}</span> · {Number(t.distance_miles).toFixed(1)} mi · {t.duration_minutes} min</span>
                      <PaymentBadge method={t.payment_method} paid={t.paid} />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Pickup &amp; drop-off revealed after you accept.
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-display text-xl text-primary">{fmtMoney(Math.round(t.fare_cents * 0.8))}</div>
                    <button onClick={() => acceptTrip(t.id)} className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110">Accept</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat icon={<DollarSign className="h-4 w-4" />} label="Total earnings" value={fmtMoney(stats.earnings)} />
          <Stat icon={<Car className="h-4 w-4" />} label="Trips completed" value={String(stats.trips)} />
          <Stat icon={<Star className="h-4 w-4" />} label="Avg rating" value={stats.avgRating ? stats.avgRating.toFixed(2) : "—"} />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Earnings / hr" value={fmtMoney(Math.round(stats.earningsPerHour))} />
        </div>

        <div className="mt-6 grid lg:grid-cols-3 gap-4">
          <Stat icon={<Gauge className="h-4 w-4" />} label="Miles driven" value={stats.miles.toFixed(1)} />
          <Stat icon={<Clock className="h-4 w-4" />} label="Hours online" value={stats.hours.toFixed(1)} />
          <Stat icon={<TrendingUp className="h-4 w-4" />} label="Acceptance rate" value={`${stats.acceptanceRate.toFixed(0)}%`} />
        </div>

        <div className="mt-8 rounded-2xl border border-primary/30 bg-surface p-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-[10px] font-bold tracking-[0.3em] text-primary uppercase">This week</div>
              <div className="mt-1 text-display text-4xl">{fmtMoney(stats.weekEarnings)}</div>
              <div className="text-sm text-muted-foreground">{stats.weekTrips} trips · last 7 days</div>
            </div>
            <div className="text-right text-sm text-muted-foreground max-w-xs">
              Payouts run weekly to your linked account. Drive more during peak hours to boost surge earnings.
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="p-6 border-b border-border flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-display text-2xl tracking-wider">TRIP PERFORMANCE</h2>
          </div>
          {trips === null ? (
            <div className="p-10 text-center text-muted-foreground">Loading…</div>
          ) : trips.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">No trips assigned yet. Stay online — requests are coming.</div>
          ) : (
            <ul className="divide-y divide-border">
              {trips.map((t) => {
                const earned = Math.round(t.fare_cents * 0.8);
                const nextStatus: Record<string, "arriving" | "in_progress" | "completed" | undefined> = {
                  accepted: "arriving",
                  arriving: "in_progress",
                  in_progress: "completed",
                };
                const next = nextStatus[t.status];
                const nextLabel: Record<string, string> = {
                  arriving: "Mark arriving",
                  in_progress: "Start trip",
                  completed: "Complete trip",
                };
                return (
                  <li key={t.id} className="p-6 flex items-start gap-4">
                    <div className="h-10 w-10 rounded-md bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
                      <Car className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.requested_at).toLocaleString()} · <span className="uppercase font-bold">{t.status.replace("_", " ")}</span>
                        </span>
                        <PaymentBadge method={t.payment_method} paid={t.paid} />
                      </div>
                      <div className="mt-1 flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="truncate">{t.pickup_address} → {t.destination_address}</span>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">{Number(t.distance_miles).toFixed(1)} mi · {t.duration_minutes} min{t.rating ? ` · ★ ${t.rating}` : ""}</div>
                      {next && (
                        <button
                          onClick={() => advanceStatus(t.id, next)}
                          className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:brightness-110"
                        >
                          {nextLabel[next]} →
                        </button>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-display text-2xl text-primary">{fmtMoney(earned)}</div>
                      <div className="text-xs text-muted-foreground">fare {fmtMoney(t.fare_cents)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] text-muted-foreground uppercase">
        <span className="text-primary">{icon}</span> {label}
      </div>
      <div className="mt-2 text-display text-3xl">{value}</div>
    </div>
  );
}

function LiveShareCard({ trips }: { trips: Trip[] | null }) {
  const active = (trips ?? []).find((t) => ["accepted", "arriving", "in_progress"].includes(t.status));
  const [sharing, setSharing] = useState(false);
  const { active: broadcasting, error } = useDriverLocationBroadcaster(active?.id ?? null, sharing);

  if (!active) return null;
  return (
    <div className="mt-8 rounded-2xl border border-primary/40 bg-surface p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.3em] text-primary uppercase">
            <Radio className="h-3.5 w-3.5" /> Live trip
          </div>
          <div className="mt-1 text-display text-2xl tracking-wider">SHARE LIVE LOCATION</div>
          <div className="mt-1 text-sm text-muted-foreground flex items-start gap-1.5">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span className="truncate">{active.pickup_address} → {active.destination_address}</span>
          </div>
          {error && <div className="mt-2 text-xs text-amber-400">⚠ {error}</div>}
        </div>
        <button
          onClick={() => setSharing((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-bold transition ${
            sharing
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-primary text-primary-foreground hover:opacity-90"
          }`}
        >
          <Navigation className={`h-4 w-4 ${broadcasting ? "animate-pulse" : ""}`} />
          {sharing ? (broadcasting ? "Broadcasting…" : "Connecting…") : "Start sharing"}
        </button>
      </div>
    </div>
  );
}
