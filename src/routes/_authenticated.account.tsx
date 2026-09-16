import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/account")({
  component: AccountPage,
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(80),
  phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/),
});

function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [full_name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        setName(data?.full_name ?? "");
        setPhone(data?.phone ?? "");
      });
  }, [user]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const parsed = schema.parse({ full_name, phone });
      setLoading(true);
      const { error } = await supabase.from("profiles").update(parsed).eq("id", user.id);
      if (error) throw error;
      toast.success("Account updated.");
    } catch (err: unknown) {
      const msg =
        err instanceof z.ZodError ? err.issues[0]?.message : err instanceof Error ? err.message : "Failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero py-12 px-4">
      <div className="mx-auto max-w-xl">
        <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground hover:text-primary transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div className="mt-6 rounded-2xl border border-border bg-surface/90 backdrop-blur-xl p-8 shadow-elevated">
          <span className="text-xs font-bold tracking-[0.3em] text-primary">/ ACCOUNT</span>
          <h1 className="mt-2 text-display text-4xl">YOUR DETAILS</h1>
          <p className="mt-1 text-sm text-muted-foreground">Signed in as {user?.email}</p>

          <form onSubmit={save} className="mt-6 space-y-4">
            <Field label="Full name" value={full_name} onChange={setName} />
            <Field label="Phone" value={phone} onChange={setPhone} type="tel" />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-primary py-3 text-sm font-bold text-primary-foreground shadow-red hover:brightness-110 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </form>

          <button
            onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-md border border-border py-3 text-sm font-bold text-muted-foreground hover:text-primary hover:border-primary transition"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-bold tracking-widest text-muted-foreground">{label.toUpperCase()}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3 text-sm text-foreground outline-none focus:border-primary transition"
      />
    </label>
  );
}
