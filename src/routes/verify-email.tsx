import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MailCheck, RefreshCw, LogOut, Inbox } from "lucide-react";
import logo from "@/assets/riderite-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/verify-email")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
    if (data.session.user.email_confirmed_at) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: VerifyEmailPage,
  head: () => ({
    meta: [
      { title: "Verify your email — RideRite" },
      { name: "description", content: "Check your inbox and click the verification link to activate your RideRite account." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user.email_confirmed_at) {
        toast.success("Email verified. Welcome aboard.");
        navigate({ to: "/dashboard" });
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setResending(false);
    if (error) {
      toast.error(error.message || "Could not resend verification email");
    } else {
      toast.success("Verification email sent. Check your inbox (and spam folder).");
    }
  };

  const handleRefresh = async () => {
    setChecking(true);
    const { data, error } = await supabase.auth.refreshSession();
    setChecking(false);
    if (error) {
      toast.error("Could not refresh status. Try again.");
      return;
    }
    if (data.session?.user.email_confirmed_at) {
      toast.success("Email verified.");
      navigate({ to: "/dashboard" });
    } else {
      toast("Still waiting — make sure you clicked the link in the email.");
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-hero px-4 py-12">
      <Link to="/" className="flex items-center gap-3 mb-8">
        <img src={logo} alt="RideRite" width={40} height={40} className="h-10 w-10 rounded-md object-cover" />
        <span className="text-display text-3xl tracking-wider">
          RIDE<span className="text-primary">RITE</span>
        </span>
      </Link>

      <div className="w-full max-w-md rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-8 shadow-elevated">
        <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/15 text-primary mx-auto">
          <MailCheck className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-display text-3xl text-center">VERIFY YOUR EMAIL</h1>
        <p className="mt-2 text-sm text-center text-muted-foreground">
          We sent a verification link to
        </p>
        <p className="mt-1 text-center text-sm font-bold text-foreground break-all">{email || "your email"}</p>

        <div className="mt-6 space-y-3 text-sm text-muted-foreground">
          <Step n={1} icon={<Inbox className="h-4 w-4" />} text="Open the email from RideRite (check spam or promotions if you don't see it)." />
          <Step n={2} icon={<MailCheck className="h-4 w-4" />} text="Click the 'Verify Email' button inside." />
          <Step n={3} icon={<RefreshCw className="h-4 w-4" />} text="You'll be brought back here automatically once verified." />
        </div>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={checking}
            className="w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-red hover:brightness-110 transition disabled:opacity-50"
          >
            {checking ? "Checking..." : "I've verified — continue"}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending || !email}
            className="w-full rounded-md border border-border bg-background py-3 text-sm font-bold hover:border-primary transition disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground hover:text-foreground transition"
          >
            <LogOut className="h-3.5 w-3.5" /> Use a different account
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Need help? Contact{" "}
          <a href="mailto:support@getriderite.com" className="text-primary font-bold hover:underline">
            support@getriderite.com
          </a>
        </p>
      </div>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background/40 p-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold">
        {n}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-foreground/90">{text}</span>
      </div>
    </div>
  );
}
