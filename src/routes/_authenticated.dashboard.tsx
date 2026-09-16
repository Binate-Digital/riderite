import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Car, Gauge, Truck, ShieldCheck, Clock, Receipt, Shield } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/site/DashboardHeader";
import { PriceChecker } from "@/components/dashboard/PriceChecker";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — RideRite" },
      { name: "description", content: "Your RideRite dashboard: book a ride, manage trips, access the driver hub, and update your account." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

interface Profile {
  full_name: string | null;
  phone: string | null;
}
interface DriverProfile {
  vehicle_type: string;
  make: string;
  model: string;
  status: string;
}

function Dashboard() {
  const { user, roles, loading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<DriverProfile | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
    supabase.from("driver_profiles").select("vehicle_type, make, model, status").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setDriver(data));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("dashboard-driver")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "driver_profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setDriver(payload.new as DriverProfile);
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isDriver = roles.includes("driver");
  const isAdmin = roles.includes("admin");
  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Rider";

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />

      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] text-primary">
          / DASHBOARD
        </div>
        <h1 className="mt-2 text-display text-5xl sm:text-6xl">
          HEY, <span className="text-primary">{displayName.toUpperCase()}.</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          {loading ? "Loading your account..." : "Where are you headed today?"}
        </p>

        <div className="mt-10 grid lg:grid-cols-3 gap-6">
          <Card title="Book a ride" desc="Sedan, SUV or truck — on demand across Florida." icon={<Car className="h-6 w-6" />} cta="Start booking" href="/" />
          {isDriver ? (
            <Card
              title="Driver hub"
              desc={
                driver
                  ? `${driver.make} ${driver.model} · ${driver.vehicle_type.toUpperCase()} · ${driver.status.toUpperCase()}`
                  : "Earnings, performance and trips."
              }
              icon={<Gauge className="h-6 w-6" />}
              cta="Open hub"
              href="/driver"
              accent
            />
          ) : (
            <Card
              title="Become a driver"
              desc="Sign up your car and start earning. Sedan, SUV or truck welcome."
              icon={<Truck className="h-6 w-6" />}
              cta="Apply now"
              href="/become-driver"
              accent
            />
          )}
          <Card title="Trip history" desc="Receipts, status and totals for every ride." icon={<Receipt className="h-6 w-6" />} cta="View trips" href="/trips" />
          <Card title="Account" desc={profile?.phone ? `Phone: ${profile.phone}` : "Add a phone number for ride alerts."} icon={<ShieldCheck className="h-6 w-6" />} cta="Manage" href="/account" />
          {isAdmin && (
            <Card title="Admin panel" desc="Users, drivers, trips, pricing and analytics." icon={<Shield className="h-6 w-6" />} cta="Open admin" href="/admin" accent />
          )}
        </div>

        <div className="mt-10">
          <PriceChecker />
        </div>

        <div className="mt-10 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-display text-2xl tracking-wider">QUICK GLANCE</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Head to <Link to="/trips" className="text-primary font-bold hover:underline">My trips</Link> for receipts and ride history{isDriver && <>, or open the <Link to="/driver" className="text-primary font-bold hover:underline">Driver hub</Link> to see earnings and performance</>}.
          </p>
        </div>
      </main>
    </div>
  );
}

function Card({
  title, desc, icon, cta, href, accent,
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  cta: string;
  href: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={href}
      className={`group rounded-2xl border p-6 transition shadow-elevated ${
        accent ? "bg-gradient-red border-primary text-primary-foreground" : "bg-surface border-border hover:border-primary"
      }`}
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${accent ? "bg-background/20" : "bg-primary/10 text-primary"}`}>
        {icon}
      </div>
      <h3 className="mt-4 text-display text-2xl tracking-wider">{title.toUpperCase()}</h3>
      <p className={`mt-1 text-sm ${accent ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{desc}</p>
      <span className="mt-4 inline-block text-sm font-bold underline-offset-4 group-hover:underline">{cta} →</span>
    </Link>
  );
}
