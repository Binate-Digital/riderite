import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Tag, X } from "lucide-react";
import { validatePromoCode, type PromoResult } from "@/lib/promos.functions";

const fmt = (c: number) =>
  `$${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Props {
  vehicleLabel: string;
  distanceMiles: number;
  durationMinutes: number;
  baseRateCents: number;
  distanceCents: number;
  timeCents: number;
  bookingFeeCents: number;
  serviceFeeCents: number;
  taxCents: number;
  totalCents: number;
  discountCents: number;
  subtotalBeforeDiscount: number;
  promo: PromoResult | null;
  onPromoChange: (p: PromoResult | null) => void;
}

export function FareBreakdown(props: Props) {
  const {
    vehicleLabel, distanceMiles, durationMinutes,
    baseRateCents, distanceCents, timeCents, bookingFeeCents,
    serviceFeeCents, taxCents, totalCents, discountCents,
    subtotalBeforeDiscount, promo, onPromoChange,
  } = props;

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const validateFn = useServerFn(validatePromoCode);

  async function apply() {
    if (!code.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await validateFn({ data: { code: code.trim(), subtotalCents: subtotalBeforeDiscount } });
      if (!res.ok) {
        setErr(res.error ?? "Invalid code");
        onPromoChange(null);
      } else {
        onPromoChange(res);
        setCode("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not validate code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">{vehicleLabel}</div>
          <div className="text-xs text-muted-foreground">{distanceMiles} mi · {durationMinutes} min</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Total</div>
          <div className="text-display text-3xl text-primary">{fmt(totalCents)}</div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
        <Row label="Base rate" value={fmt(baseRateCents)} />
        <Row label={`Distance · ${distanceMiles} mi`} value={fmt(distanceCents)} />
        <Row label={`Time · ${durationMinutes} min`} value={fmt(timeCents)} />
        <Row label="Booking fee" value={fmt(bookingFeeCents)} />
        <Row label="Service fee" value={fmt(serviceFeeCents)} />
        <Row label="Tax" value={fmt(taxCents)} />
        {discountCents > 0 && promo && (
          <Row label={`Promo · ${promo.code}`} value={`−${fmt(discountCents)}`} accent />
        )}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-bold">
          <span>Total</span>
          <span>{fmt(totalCents)}</span>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground mb-2">Promo code</div>
        {promo?.ok ? (
          <div className="flex items-center justify-between rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-2 font-bold text-emerald-300">
              <Tag className="h-3.5 w-3.5" /> {promo.code} · {promo.label}
            </span>
            <button
              type="button"
              onClick={() => onPromoChange(null)}
              className="text-emerald-300 hover:text-emerald-200"
              aria-label="Remove promo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder="Enter code (try WELCOME10)"
              className="flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm uppercase tracking-wider outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={apply}
              disabled={busy || !code.trim()}
              className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Apply"}
            </button>
          </div>
        )}
        {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "font-bold text-emerald-300" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}
