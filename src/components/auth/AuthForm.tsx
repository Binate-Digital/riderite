import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/riderite-logo.jpeg";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "Min 8 characters").max(72);
const nameSchema = z.string().trim().min(2, "Tell us your name").max(80);
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9 ()-]{7,20}$/i, "Enter a valid phone number");

interface Props {
  mode: "login" | "signup";
}

export function AuthForm({ mode }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const handleResend = async () => {
    try {
      const validEmail = emailSchema.parse(email);
      setResending(true);
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: validEmail,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) throw error;
      toast.success("Verification email sent. Check your inbox (and spam folder).");
    } catch (err: unknown) {
      const msg =
        err instanceof z.ZodError
          ? "Enter your email above first, then tap resend."
          : err instanceof Error
            ? err.message
            : "Could not resend verification email";
      toast.error(msg);
    } finally {
      setResending(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validEmail = emailSchema.parse(email);
      const validPassword = passwordSchema.parse(password);

      setLoading(true);
      if (mode === "signup") {
        const validName = nameSchema.parse(fullName);
        const validPhone = phoneSchema.parse(phone);
        const { error } = await supabase.auth.signUp({
          email: validEmail,
          password: validPassword,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: validName, phone: validPhone },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your email to verify, then sign in.");
        navigate({ to: "/login" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: validEmail,
          password: validPassword,
        });
        if (error) throw error;
        toast.success("Welcome back.");
        navigate({ to: "/dashboard" });
      }
    } catch (err: unknown) {
      const msg =
        err instanceof z.ZodError
          ? err.issues[0]?.message
          : err instanceof Error
            ? err.message
            : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/dashboard`,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
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
        <h1 className="text-display text-4xl">
          {mode === "login" ? "WELCOME BACK." : "JOIN THE RIDE."}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to book or to drive."
            : "Create a rider account in seconds. You can become a driver right after."}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-3 rounded-md border border-border bg-background px-4 py-3 text-sm font-bold hover:border-primary transition disabled:opacity-50"
        >
          <GoogleIcon /> Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          {mode === "signup" && (
            <>
              <Field label="Full name" value={fullName} onChange={setFullName} placeholder="Jordan Rivera" autoComplete="name" />
              <Field label="Phone" value={phone} onChange={setPhone} placeholder="+1 305 555 0123" type="tel" autoComplete="tel" />
            </>
          )}
          <Field label="Email" value={email} onChange={setEmail} placeholder="you@example.com" type="email" autoComplete="email" />
          <Field
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-red hover:brightness-110 transition disabled:opacity-50"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="mt-4 rounded-md border border-dashed border-border bg-background/40 p-3 text-center">
          <p className="text-xs text-muted-foreground">
            Didn't get the verification email?
          </p>
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="mt-1 text-sm font-bold text-primary hover:underline disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend verification email"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>New to RideRite? <Link to="/signup" className="text-primary font-bold hover:underline">Sign up</Link></>
          ) : (
            <>Already with us? <Link to="/login" className="text-primary font-bold hover:underline">Sign in</Link></>
          )}
        </p>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.61z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.32A9 9 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.29-1.71V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l3.01-2.32z"/>
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.97l3.01 2.32C4.68 5.16 6.66 3.58 9 3.58z"/>
    </svg>
  );
}
