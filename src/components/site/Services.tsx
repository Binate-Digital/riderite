import sedan from "@/assets/service-sedan.jpg";
import suv from "@/assets/service-suv.jpg";
import truck from "@/assets/service-truck.jpg";

const services = [
  { name: "Sedan", img: sedan, tagline: "Daily rides, done right.", desc: "Affordable, comfortable, fast. Up to 4 riders.", price: "from $7" },
  { name: "SUV", img: suv, tagline: "Roll deep in style.", desc: "Premium space for groups, luggage, and long trips. Up to 6.", price: "from $14" },
  { name: "Truck", img: truck, tagline: "Heavy lifting, handled.", desc: "Move furniture, gear or cargo. Pickups & flatbeds.", price: "from $29" },
];

export function Services() {
  return (
    <section id="services" className="relative py-28 bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <span className="text-xs font-bold tracking-[0.3em] text-primary">/ FLEET</span>
            <h2 className="mt-2 text-display text-5xl sm:text-6xl">PICK YOUR RIDE.</h2>
          </div>
          <p className="max-w-md text-muted-foreground">
            One app. Three ways to move. Whether you're hopping across town or hauling cargo across the state, RideRite has the right vehicle.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {services.map((s, i) => (
            <article key={s.name}
              className="group relative overflow-hidden rounded-2xl border border-border bg-surface hover:border-primary/60 transition shadow-elevated">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img src={s.img} alt={s.name} loading="lazy" width={1200} height={900}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
                <div className="absolute top-4 left-4 inline-flex items-center rounded-md bg-primary px-2 py-1 text-[10px] font-bold tracking-widest text-primary-foreground">
                  TIER 0{i + 1}
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-display text-3xl">{s.name.toUpperCase()}</h3>
                  <span className="text-sm font-bold text-primary">{s.price}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-foreground">{s.tagline}</p>
                <p className="mt-3 text-sm text-muted-foreground">{s.desc}</p>
                <button className="mt-5 w-full rounded-md border border-border py-2.5 text-sm font-bold text-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground transition">
                  Book {s.name}
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
