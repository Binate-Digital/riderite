import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CreditCard, Smartphone, Wallet, Send, Banknote } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Navigation, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { DashboardHeader } from "@/components/site/DashboardHeader";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { StripeEmbeddedCheckoutPanel } from "@/components/StripeEmbeddedCheckout";
import { createRideAndCheckout, getFareEstimate } from "@/lib/booking.functions";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { getStripeEnvironment } from "@/lib/stripe";
import { supabase } from "@/integrations/supabase/client";
import { BookingConfirmation } from "@/components/booking/BookingConfirmation";

const searchSchema = z.object({
  pickup: z.string().optional(),
  destination: z.string().optional(),
  vehicle: z.enum(["sedan", "suv", "truck"]).optional(),
  pLat: z.number().optional(),
  pLng: z.number().optional(),
  dLat: z.number().optional(),
  dLng: z.number().optional(),
  promo: z.string().optional(),
  session_id: z.string().optional(),
  trip_id: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/book")({
  validateSearch: (s) => searchSchema.parse(s),
  component: BookPage,
});

const fmtMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function BookPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const [pickup, setPickup] = useState(search.pickup ?? "");
  const [destination, setDestination] = useState(search.destination ?? "");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(
    search.pLat != null && search.pLng != null ? { lat: search.pLat, lng: search.pLng } : null,
  );
  const [destinationCoords, setDestinationCoords] = useState<{ lat: number; lng: number } | null>(
    search.dLat != null && search.dLng != null ? { lat: search.dLat, lng: search.dLng } : null,
  );
  const [vehicle, setVehicle] = useState<"sedan" | "suv" | "truck">(search.vehicle ?? "sedan");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cashapp" | "paypal" | "cash" | "venmo" | "zelle">("card");
  const [estimate, setEstimate] = useState<{ totalCents: number; distanceMiles: number; durationMinutes: number } | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [receipt, setReceipt] = useState<{
    baseFareCents: number; serviceFeeCents: number; taxCents: number; totalCents: number;
    distanceMiles: number; durationMinutes: number; pickup: string; destination: string;
  } | null>(null);

  const estimateFn = useServerFn(getFareEstimate);
  const checkoutFn = useServerFn(createRideAndCheckout);

  // After Stripe redirects back with session_id, poll trip.paid then load receipt
  useEffect(() => {
    if (!search.trip_id) return;
    setTripId(search.trip_id);
    let cancelled = false;
    const poll = async () => {
      for (let i = 0; i < 20 && !cancelled; i++) {
        const { data } = await supabase
          .from("trips")
          .select("paid, base_fare_cents, service_fee_cents, tax_cents, fare_cents, distance_miles, duration_minutes, pickup_address, destination_address")
          .eq("id", search.trip_id!)
          .maybeSingle();
        if (data?.paid) {
          setPaid(true);
          setReceipt({
            baseFareCents: data.base_fare_cents ?? 0,
            serviceFeeCents: data.service_fee_cents ?? 0,
            taxCents: data.tax_cents ?? 0,
            totalCents: data.fare_cents ?? 0,
            distanceMiles: Number(data.distance_miles ?? 0),
            durationMinutes: data.duration_minutes ?? 0,
            pickup: data.pickup_address ?? "",
            destination: data.destination_address ?? "",
          });
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void poll();
    return () => { cancelled = true; };
  }, [search.trip_id]);

  const runEstimate = async () => {
    if (!pickup.trim() || !destination.trim()) return;
    setEstimating(true);
    setError(null);
    try {
      const res = await estimateFn({ data: { pickup, destination, pickupCoords, destinationCoords, vehicle } });
      setEstimate(res);
    } catch (e: any) {
      setError(e?.message ?? "Could not estimate fare");
    } finally {
      setEstimating(false);
    }
  };

  const startCheckout = async () => {
    if (!pickup.trim() || !destination.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("session_id", "{CHECKOUT_SESSION_ID}");
      const res = await checkoutFn({
        data: {
          pickup,
          destination,
          pickupCoords,
          destinationCoords,
          vehicle,
          paymentMethod,
          environment: getStripeEnvironment(),
          returnUrl: url.toString().replace("%7BCHECKOUT_SESSION_ID%7D", "{CHECKOUT_SESSION_ID}"),
          promoCode: search.promo,
        },
      });
      setTripId(res.tripId);
      if (res.offline) {
        // Pay-on-pickup: skip Stripe, jump straight to confirmation
        setReceipt({
          baseFareCents: res.fare.baseFareCents,
          serviceFeeCents: res.fare.serviceFeeCents,
          taxCents: res.fare.taxCents,
          totalCents: res.fare.totalCents,
          distanceMiles: estimate?.distanceMiles ?? 0,
          durationMinutes: estimate?.durationMinutes ?? 0,
          pickup,
          destination,
        });
        setPaid(true);
      } else {
        setClientSecret(res.clientSecret);
        const next = new URL(window.location.href);
        next.searchParams.set("trip_id", res.tripId);
        window.history.replaceState({}, "", next.toString());
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not start checkout");
    } finally {
      setBusy(false);
    }
  };

  if (paid && tripId) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <DashboardHeader />
        <main className="mx-auto max-w-xl px-6 py-12">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-400" />
            <h1 className="mt-4 text-display text-4xl">RIDE BOOKED</h1>
            {(() => {
              const labels: Record<string, string> = { card: "Card", cashapp: "Cash App", paypal: "PayPal", cash: "Cash", venmo: "Venmo", zelle: "Zelle" };
              const offline = paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle";
              return (
                <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  offline ? "border-amber-500/40 bg-amber-500/10 text-amber-300" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                }`}>
                  {labels[paymentMethod]} · {offline ? "Pay on pickup" : "Paid"}
                </span>
              );
            })()}
            <p className="mt-3 text-muted-foreground">
              {paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle"
                ? `Pay your driver with ${paymentMethod === "cash" ? "cash" : paymentMethod === "venmo" ? "Venmo" : "Zelle"} on pickup. Matching you with a driver now.`
                : "Payment confirmed. We're matching you with a driver now."}
            </p>
          </div>

          <div className="mt-6">
            <BookingConfirmation tripId={tripId} />
          </div>


          {receipt && (
            <div className="mt-8 rounded-2xl border border-border bg-surface p-6 text-left print:border-black">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Receipt</div>
                  <div className="mt-1 text-display text-2xl">RIDERITE</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>{new Date().toLocaleString()}</div>
                  <div className="mt-0.5 font-mono">#{tripId?.slice(0, 8).toUpperCase()}</div>
                </div>
              </div>

              <div className="mt-4 space-y-1 text-sm">
                <div className="text-muted-foreground text-xs uppercase tracking-wider">From</div>
                <div className="text-foreground">{receipt.pickup}</div>
                <div className="mt-2 text-muted-foreground text-xs uppercase tracking-wider">To</div>
                <div className="text-foreground">{receipt.destination}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {receipt.distanceMiles} mi · {receipt.durationMinutes} min · {vehicle.toUpperCase()}
                </div>
              </div>

              <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <Row label="Base fare" value={fmtMoney(receipt.baseFareCents)} />
                <Row label="Service fee" value={fmtMoney(receipt.serviceFeeCents)} />
                <Row label="Tax" value={fmtMoney(receipt.taxCents)} />
                <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
                  <div className="text-xs font-bold uppercase tracking-wider">
                    {paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle" ? "Due on pickup" : "Paid"}
                  </div>
                  <div className="text-display text-2xl text-primary">{fmtMoney(receipt.totalCents)}</div>
                </div>
                <div className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">
                  via {paymentMethod === "cashapp" ? "Cash App" : paymentMethod === "paypal" ? "PayPal" : paymentMethod === "card" ? "Card" : paymentMethod}
                </div>
              </div>

              <div className="mt-4 border-t border-border pt-3 text-[10px] text-muted-foreground">
                Trip ID: <span className="font-mono">{tripId}</span>
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center gap-3 print:hidden">
            <button
              onClick={() => window.print()}
              className="rounded-md border border-border bg-surface px-5 py-3 text-sm font-bold text-foreground hover:border-primary/60"
            >
              Print receipt
            </button>
            <button
              onClick={() => navigate({ to: "/trips" })}
              className="rounded-md bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
            >
              View trip →
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (search.session_id && tripId && !paid) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <DashboardHeader />
        <main className="mx-auto max-w-xl px-6 py-20 text-center">
          <Loader2 className="mx-auto h-12 w-12 text-primary animate-spin" />
          <h1 className="mt-4 text-display text-3xl">CONFIRMING PAYMENT</h1>
          <p className="mt-2 text-muted-foreground">Hang tight — Stripe is letting us know your charge went through.</p>
        </main>
      </div>
    );
  }

  if (clientSecret) {
    return (
      <div className="min-h-screen bg-background">
        <PaymentTestModeBanner />
        <DashboardHeader />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <button onClick={() => { setClientSecret(null); router.invalidate(); }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h1 className="mt-4 text-display text-4xl">PAY <span className="text-primary">FOR YOUR RIDE</span></h1>
          <div className="mt-6 rounded-2xl border border-border bg-surface p-2">
            <StripeEmbeddedCheckoutPanel clientSecret={clientSecret} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
      <DashboardHeader />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <div className="text-xs font-bold tracking-[0.3em] text-primary">/ BOOK A RIDE</div>
        <h1 className="mt-2 text-display text-5xl">REQUEST <span className="text-primary">YOUR RIDE.</span></h1>
        <p className="mt-2 text-muted-foreground">Pickup, drop-off, vehicle. Pay up front — driver matched right after.</p>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-6 space-y-3">
          <AddressAutocomplete icon={<MapPin className="h-4 w-4 text-primary" />} placeholder="Pickup location" value={pickup} onChange={(v, c) => { setPickup(v); setPickupCoords(c ?? null); setEstimate(null); }} />
          <AddressAutocomplete icon={<Navigation className="h-4 w-4 text-primary" />} placeholder="Where to?" value={destination} onChange={(v, c) => { setDestination(v); setDestinationCoords(c ?? null); setEstimate(null); }} />
          <div className="grid grid-cols-3 gap-2 pt-2">
            {(["sedan", "suv", "truck"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setVehicle(t); setEstimate(null); }}
                className={`rounded-md border px-3 py-3 text-xs font-bold uppercase transition ${
                  vehicle === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="pt-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">Pay with</div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "card", label: "Card", icon: CreditCard },
                { id: "cashapp", label: "Cash App", icon: Smartphone },
                { id: "paypal", label: "PayPal", icon: Wallet },
                { id: "pickup", label: "Pay on pickup", icon: Banknote },
              ] as const).map((m) => {
                const Icon = m.icon;
                const isPickup = m.id === "pickup";
                const active = isPickup
                  ? (paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle")
                  : paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(isPickup ? "cash" : (m.id as typeof paymentMethod))}
                    className={`flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-[11px] font-bold uppercase transition ${
                      active ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </button>
                );
              })}
            </div>
            {(paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle") && (
              <div className="mt-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
                  Will you pay with cash or transfer?
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[11px] font-bold uppercase transition ${
                      paymentMethod === "cash" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    <Banknote className="h-4 w-4" /> Cash
                  </button>
                  <button
                    onClick={() => setPaymentMethod((p) => (p === "zelle" ? "zelle" : "venmo"))}
                    className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-[11px] font-bold uppercase transition ${
                      paymentMethod === "venmo" || paymentMethod === "zelle" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                    }`}
                  >
                    <Send className="h-4 w-4" /> Transfer
                  </button>
                </div>
                {(paymentMethod === "venmo" || paymentMethod === "zelle") && (
                  <div className="grid grid-cols-2 gap-2">
                    {(["venmo", "zelle"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setPaymentMethod(t)}
                        className={`rounded-md border px-3 py-2 text-[11px] font-bold uppercase transition ${
                          paymentMethod === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/60"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-300/90">
                  Pay your driver directly on pickup. No upfront charge — driver confirms collection.
                </div>
              </div>
            )}
          </div>

          <button
            onClick={runEstimate}
            disabled={estimating || !pickup.trim() || !destination.trim()}
            className="mt-2 w-full rounded-md border border-primary/40 bg-primary/10 py-3 text-sm font-bold text-primary disabled:opacity-50"
          >
            {estimating ? "Estimating…" : "See price"}
          </button>

          {estimate && (
            <div className="mt-3 rounded-md border border-border bg-background/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">{estimate.distanceMiles} mi · {estimate.durationMinutes} min</div>
                <div className="text-display text-3xl text-primary">{fmtMoney(estimate.totalCents)}</div>
              </div>

              {/* Vehicle + driver ETA preview, before payment */}
              {(() => {
                const vehicleMeta: Record<typeof vehicle, { name: string; seats: string; bag: string }> = {
                  sedan: { name: "Salon · Sedan", seats: "Up to 4 riders", bag: "2 bags" },
                  suv:   { name: "SUV",           seats: "Up to 6 riders", bag: "4 bags" },
                  truck: { name: "Pickup Truck",  seats: "Up to 2 riders", bag: "Cargo bed" },
                };
                const meta = vehicleMeta[vehicle];
                const etaLow = 3, etaHigh = 7;
                return (
                  <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/15 text-primary">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-tight">{meta.name}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{meta.seats} · {meta.bag}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Driver ETA</div>
                      <div className="text-sm font-bold text-emerald-300">{etaLow}–{etaHigh} min</div>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => {
                  if (paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle") {
                    setConfirmOffline(true);
                  } else {
                    void startCheckout();
                  }
                }}
                disabled={busy}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-50"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle" ? "Booking…" : "Starting checkout…"}</>
                ) : (
                  paymentMethod === "cash" || paymentMethod === "venmo" || paymentMethod === "zelle"
                    ? `Book ride · pay on pickup`
                    : `Book & pay ${fmtMoney(estimate.totalCents)}`
                )}
              </button>
            </div>
          )}


          {error && <div className="mt-2 text-sm text-amber-400">{error}</div>}
        </div>
      </main>

      {confirmOffline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6">
            <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary">Confirm payment</div>
            <h2 className="mt-2 text-display text-2xl">PAY ON PICKUP</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              You'll pay your driver <span className="font-bold text-foreground">{fmtMoney(estimate?.totalCents ?? 0)}</span> on arrival. Confirm how:
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-xs font-bold uppercase ${
                  paymentMethod === "cash" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <Banknote className="h-4 w-4" /> Cash
              </button>
              <button
                onClick={() => setPaymentMethod((p) => (p === "zelle" ? "zelle" : "venmo"))}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-3 text-xs font-bold uppercase ${
                  paymentMethod === "venmo" || paymentMethod === "zelle" ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <Send className="h-4 w-4" /> Transfer
              </button>
            </div>
            {(paymentMethod === "venmo" || paymentMethod === "zelle") && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(["venmo", "zelle"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPaymentMethod(t)}
                    className={`rounded-md border px-3 py-2 text-[11px] font-bold uppercase ${
                      paymentMethod === t ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-5 flex items-center gap-2">
              <button
                onClick={() => setConfirmOffline(false)}
                className="flex-1 rounded-md border border-border px-4 py-3 text-xs font-bold uppercase text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmOffline(false); void startCheckout(); }}
                disabled={busy}
                className="flex-1 rounded-md bg-primary px-4 py-3 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
              >
                Confirm & book
              </button>
            </div>
          </div>
        </div>
      )}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-foreground">{value}</div>
    </div>
  );
}
