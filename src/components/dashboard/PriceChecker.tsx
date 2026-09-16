import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Users, Clock, Zap, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import {
  fetchLiveQuotes,
  formatPrice,
  type QuoteResponse,
  type RideTier,
} from "@/lib/riderite-price-api";

const REFRESH_MS = 30_000;

export function PriceChecker() {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [prevPrices, setPrevPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [selected, setSelected] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canQuote = pickup.trim().length > 2 && destination.trim().length > 2;

  // Fetcher — re-runs whenever route changes, and on a 30s interval thereafter.
  useEffect(() => {
    if (!canQuote) {
      setQuote(null);
      return;
    }
    let cancelled = false;

    const run = async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetchLiveQuotes({ pickup, destination }, ctrl.signal);
        if (cancelled) return;
        setQuote((old) => {
          if (old) {
            const map: Record<string, number> = {};
            for (const t of old.tiers) map[t.id] = t.priceCents;
            setPrevPrices(map);
          }
          return res;
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    const interval = setInterval(() => {
      run();
      setCountdown(REFRESH_MS / 1000);
    }, REFRESH_MS);
    const tick = setInterval(() => setCountdown((c) => (c <= 1 ? REFRESH_MS / 1000 : c - 1)), 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(tick);
      abortRef.current?.abort();
    };
  }, [pickup, destination, canQuote]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-elevated">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] text-primary">
            <Zap className="h-3.5 w-3.5" /> / LIVE PRICE CHECKER
          </div>
          <h2 className="mt-2 text-display text-3xl tracking-wider">
            REAL-TIME <span className="text-primary">RIDE PRICES</span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Compare fares across vehicle classes. Prices update every 30s to reflect live surge.
          </p>
        </div>
        {quote && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs">
            <span className={`h-2 w-2 rounded-full ${loading ? "bg-yellow-400 animate-pulse" : "bg-green-500"}`} />
            <span className="font-bold text-muted-foreground">
              {loading ? "Updating…" : `Refresh in ${countdown}s`}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <AddressAutocomplete
          icon={<MapPin className="h-4 w-4 text-primary" />}
          placeholder="Pickup location"
          value={pickup}
          onChange={(v) => setPickup(v)}
        />
        <AddressAutocomplete
          icon={<Navigation className="h-4 w-4 text-primary" />}
          placeholder="Destination"
          value={destination}
          onChange={(v) => setDestination(v)}
        />
      </div>

      {!canQuote && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Enter pickup and destination to see live price estimates.
        </div>
      )}

      {canQuote && quote && (
        <>
          <div className="mt-6 flex items-center gap-6 text-xs font-bold text-muted-foreground">
            <span>DISTANCE · <span className="text-foreground">{quote.distanceMiles} mi</span></span>
            <span>EST · <span className="text-foreground">{quote.durationMinutes} min</span></span>
          </div>

          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {quote.tiers.map((tier) => (
              <TierCard
                key={tier.id}
                tier={tier}
                prevPrice={prevPrices[tier.id]}
                selected={selected === tier.id}
                onSelect={() => setSelected(tier.id)}
              />
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" /> Auto-refreshes every 30 seconds
            </span>
            {selected && (
              <span className="font-bold text-primary">
                {quote.tiers.find((t) => t.id === selected)?.label} selected
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function TierCard({
  tier,
  prevPrice,
  selected,
  onSelect,
}: {
  tier: RideTier;
  prevPrice?: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const delta = prevPrice ? tier.priceCents - prevPrice : 0;
  const isSurge = tier.surgeMultiplier >= 1.2;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`group w-full text-left rounded-xl border p-4 transition ${
          selected
            ? "border-primary bg-primary/10 shadow-elevated"
            : "border-border bg-background/40 hover:border-primary"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-display text-xl tracking-wider">{tier.label.toUpperCase()}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{tier.tagline}</p>
          </div>
          {isSurge && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              <Zap className="h-3 w-3" /> {tier.surgeMultiplier}x
            </span>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-foreground transition-all">
                {formatPrice(tier.priceCents)}
              </span>
              {delta !== 0 && (
                <span
                  className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                    delta > 0 ? "text-primary" : "text-green-500"
                  }`}
                >
                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {delta > 0 ? "+" : ""}{formatPrice(Math.abs(delta))}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {tier.etaMinutes} min</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {tier.capacity}</span>
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}
