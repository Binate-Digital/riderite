import logo from "@/assets/riderite-logo.jpeg";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-6 py-14 grid md:grid-cols-4 gap-10">
        <div className="md:col-span-2">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RideRite" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
            <span className="text-display text-2xl tracking-wider">RIDE<span className="text-primary">RITE</span></span>
          </div>
          <p className="mt-4 text-sm text-muted-foreground max-w-sm">
            Your ride done right — every time. Headquartered in Florida, built for everywhere.
          </p>
        </div>
        <Col title="Riders" links={["Book a ride", "Pricing", "Cities", "Safety"]} />
        <Col title="Drivers" links={["Become a driver", "Requirements", "Earnings", "Driver support"]} />
      </div>
      <div className="border-t border-border">
        <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} RideRite Mobility, Inc. Florida, USA.</p>
          <div className="flex gap-5">
            <a href="#" className="hover:text-foreground transition">Privacy</a>
            <a href="#" className="hover:text-foreground transition">Terms</a>
            <a href="/legal/florida" className="hover:text-foreground transition">Florida Compliance</a>
            <a href="/legal/florida#report" className="hover:text-foreground transition">Report a concern</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-xs font-bold tracking-[0.3em] text-primary">{title.toUpperCase()}</h4>
      <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
        {links.map((l) => <li key={l}><a href="#" className="hover:text-foreground transition">{l}</a></li>)}
      </ul>
    </div>
  );
}
