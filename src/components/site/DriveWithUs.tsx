import driver from "@/assets/driver.jpg";
import { Check } from "lucide-react";

const perks = [
  "Keep more of every fare — industry-low service fee",
  "Drive your own car: sedan, SUV or pickup",
  "Weekly cash-out, instant payout option",
  "24/7 driver support and dedicated dispatch",
];

export function DriveWithUs() {
  return (
    <section id="drive" className="relative py-28 bg-background overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-14 items-center">
        <div className="relative">
          <div className="absolute -inset-4 bg-gradient-red opacity-20 blur-3xl rounded-full" />
          <img src={driver} alt="RideRite driver behind the wheel" loading="lazy" width={1200} height={1400}
               className="relative rounded-2xl object-cover shadow-elevated border border-border" />
          <div className="absolute -bottom-6 -right-6 hidden sm:block bg-primary text-primary-foreground px-6 py-4 rounded-xl shadow-red">
            <div className="text-display text-3xl">$1,400+</div>
            <div className="text-xs font-bold tracking-widest">EARNED / WEEK</div>
          </div>
        </div>

        <div>
          <span className="text-xs font-bold tracking-[0.3em] text-primary">/ DRIVE & EARN</span>
          <h2 className="mt-2 text-display text-5xl sm:text-6xl leading-[0.95]">
            YOUR CAR.<br />YOUR HOURS.<br /><span className="text-primary">YOUR MONEY.</span>
          </h2>
          <p className="mt-5 text-muted-foreground max-w-lg">
            Sign up with your own vehicle and start earning with RideRite. Whether you drive a sedan,
            SUV or pickup truck, we'll match you with riders the moment you go online.
          </p>

          <ul className="mt-8 space-y-3">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm text-foreground">{p}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-wrap gap-4">
            <a href="#" className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-base font-bold text-primary-foreground shadow-red hover:brightness-110 transition">
              Become a driver
            </a>
            <a href="#" className="inline-flex items-center justify-center rounded-md border border-border px-6 py-3 text-base font-bold text-foreground hover:border-primary transition">
              See requirements
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
