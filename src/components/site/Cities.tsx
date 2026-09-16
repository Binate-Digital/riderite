const cities = [
  { name: "Miami", status: "LIVE" },
  { name: "Orlando", status: "LIVE" },
  { name: "Tampa", status: "LIVE" },
  { name: "Jacksonville", status: "LIVE" },
  { name: "Fort Lauderdale", status: "LIVE" },
  { name: "Tallahassee", status: "SOON" },
  { name: "Atlanta", status: "SOON" },
  { name: "Houston", status: "SOON" },
  { name: "New York", status: "SOON" },
];

export function Cities() {
  return (
    <section id="cities" className="py-28 bg-surface border-t border-border">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-14">
          <div>
            <span className="text-xs font-bold tracking-[0.3em] text-primary">/ CITIES</span>
            <h2 className="mt-2 text-display text-5xl sm:text-6xl">STARTING IN <span className="text-primary">FLORIDA.</span><br />ROLLING NATIONWIDE.</h2>
          </div>
          <p className="max-w-md text-muted-foreground">
            We launched in the Sunshine State and we're not stopping. New cities every quarter.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {cities.map((c) => (
            <div key={c.name}
              className="group flex items-center justify-between rounded-md border border-border bg-background px-4 py-4 hover:border-primary transition">
              <span className="text-display text-xl tracking-wider">{c.name.toUpperCase()}</span>
              <span className={`text-[10px] font-bold tracking-widest px-2 py-1 rounded ${c.status === "LIVE" ? "bg-primary text-primary-foreground" : "bg-background border border-border text-muted-foreground"}`}>
                {c.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
