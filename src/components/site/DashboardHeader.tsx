import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { NotificationBell } from "./NotificationBell";
import logo from "@/assets/riderite-logo.jpeg";

export function DashboardHeader() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-md sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src={logo} alt="RideRite" width={36} height={36} className="h-9 w-9 rounded-md object-cover" />
          <span className="text-display text-xl tracking-wider">RIDE<span className="text-primary">RITE</span></span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm font-bold text-muted-foreground">
          <Link to="/dashboard" activeProps={{ className: "text-primary" }} className="hover:text-primary">Dashboard</Link>
          <Link to="/trips" activeProps={{ className: "text-primary" }} className="hover:text-primary">My trips</Link>
          <Link to="/driver" activeProps={{ className: "text-primary" }} className="hover:text-primary">Driver hub</Link>
        </nav>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

