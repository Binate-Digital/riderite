import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CustomCheckoutDrawer, type CheckoutPurpose } from "@/components/CustomCheckoutDrawer";

export const Route = createFileRoute("/_authenticated/pay")({
  component: PayPage,
});

const PRESETS: Array<{ cents: number; label: string }> = [
  { cents: 500, label: "$5" },
  { cents: 1000, label: "$10" },
  { cents: 2000, label: "$20" },
  { cents: 5000, label: "$50" },
  { cents: 10000, label: "$100" },
];

const PURPOSES: Array<{ id: CheckoutPurpose; label: string; help: string }> = [
  { id: "ride", label: "Ride fare", help: "Pay for a completed or upcoming ride." },
  { id: "tip", label: "Tip your driver", help: "Add a tip on top of the ride fare." },
  { id: "topup", label: "Wallet top-up", help: "Add credit to your RideRite balance." },
  { id: "custom", label: "Custom charge", help: "Pay any amount you've been quoted." },
];

function PayPage() {
  const [purpose, setPurpose] = useState<CheckoutPurpose>("ride");
  const [amountCents, setAmountCents] = useState(2000);
  const [customAmount, setCustomAmount] = useState("");
  const [open, setOpen] = useState(false);

  const handleCustomChange = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    setCustomAmount(cleaned);
    const dollars = parseFloat(cleaned);
    if (!isNaN(dollars) && dollars > 0) {
      setAmountCents(Math.round(dollars * 100));
    }
  };

  const canPay = amountCents >= 50 && amountCents <= 1_000_000;

  return (
    <div className="min-h-screen bg-gradient-hero py-10 px-4">
      <div className="mx-auto max-w-xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mt-6 rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-6 shadow-elevated">
          <span className="text-xs font-bold tracking-[0.3em] text-primary">/ QUICK PAY</span>
          <h1 className="mt-2 text-display text-4xl">PAY ANY AMOUNT</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Apple Pay, Google Pay, and cards — instant checkout, no redirects.
          </p>

          <div className="mt-6">
            <div className="text-xs font-bold tracking-widest text-muted-foreground">PURPOSE</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {PURPOSES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPurpose(p.id)}
                  className={`rounded-md border px-3 py-3 text-left text-sm transition ${
                    purpose === p.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/60"
                  }`}
                >
                  <div className="font-bold">{p.label}</div>
                  <div className="text-xs opacity-80">{p.help}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-xs font-bold tracking-widest text-muted-foreground">AMOUNT</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.cents}
                  type="button"
                  onClick={() => {
                    setAmountCents(p.cents);
                    setCustomAmount("");
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    amountCents === p.cents && !customAmount
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-foreground hover:border-primary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <label className="mt-4 block">
              <span className="text-xs font-bold tracking-widest text-muted-foreground">CUSTOM AMOUNT (USD)</span>
              <div className="mt-1 flex items-center rounded-md border border-border bg-background px-3 focus-within:border-primary transition">
                <span className="text-muted-foreground">$</span>
                <input
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(e) => handleCustomChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent px-2 py-3 text-base outline-none"
                />
              </div>
              {amountCents < 50 && (
                <p className="mt-1 text-xs text-destructive">Minimum amount is $0.50.</p>
              )}
            </label>
          </div>

          <button
            type="button"
            disabled={!canPay}
            onClick={() => setOpen(true)}
            className="mt-6 w-full rounded-md bg-primary py-4 text-base font-bold text-primary-foreground shadow-red hover:brightness-110 transition disabled:opacity-50"
          >
            Continue to payment
          </button>
        </div>
      </div>

      <CustomCheckoutDrawer
        open={open}
        onOpenChange={setOpen}
        amountCents={amountCents}
        purpose={purpose}
        description={PURPOSES.find((p) => p.id === purpose)?.label}
      />
    </div>
  );
}
