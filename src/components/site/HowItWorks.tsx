const steps = [
  { n: "01", t: "Open the app", d: "Set your pickup and destination in seconds." },
  { n: "02", t: "Pick your vehicle", d: "Sedan, SUV or truck — your call, your price." },
  { n: "03", t: "Track in real time", d: "Watch your driver arrive and share trip status." },
  { n: "04", t: "Pay & rate", d: "Tap to pay. Rate your ride. Done right." },
];

export function HowItWorks() {
  return (
    <section id="how" className="py-28 bg-surface border-y border-border">
      <div className="mx-auto max-w-7xl px-6">
        <div className="max-w-2xl">
          <span className="text-xs font-bold tracking-[0.3em] text-primary">/ HOW IT WORKS</span>
          <h2 className="mt-2 text-display text-5xl sm:text-6xl">FOUR TAPS. <span className="text-primary">YOU'RE MOVING.</span></h2>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden">
          {steps.map((s) => (
            <div key={s.n} className="bg-surface p-8 hover:bg-background transition group">
              <div className="text-display text-6xl text-primary group-hover:scale-110 origin-left transition-transform">{s.n}</div>
              <h3 className="mt-4 text-display text-2xl tracking-wider">{s.t.toUpperCase()}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
