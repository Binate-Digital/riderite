import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, User } from "lucide-react";
import logo from "@/assets/riderite-logo.jpeg";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/70 border-b border-border">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <img src={logo} alt="RideRite" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
          <span className="text-display text-2xl tracking-wider">
            RIDE<span className="text-primary">RITE</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#services" className="hover:text-foreground transition">Services</a>
          <a href="#how" className="hover:text-foreground transition">How it works</a>
          <a href="#drive" className="hover:text-foreground transition">Drive with us</a>
          <a href="#cities" className="hover:text-foreground transition">Cities</a>
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/dashboard" className="hidden sm:inline-flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition">
                <User className="h-4 w-4" /> Dashboard
              </Link>
              <button
                onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                title="Sign out"
                className="inline-flex items-center justify-center rounded-md border border-border p-2 text-muted-foreground hover:text-primary hover:border-primary transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex text-sm font-semibold text-foreground hover:text-primary transition">
                Sign in
              </Link>
              <Link to="/signup" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-red hover:brightness-110 transition">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
