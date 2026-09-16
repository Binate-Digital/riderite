import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/unsubscribe")({
  component: UnsubscribePage,
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) ?? "" }),
});

type Status = "loading" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

function UnsubscribePage() {
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<Status>("loading");
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) { setStatus("invalid"); return; }
        if (data.alreadyUnsubscribed || data.used) { setStatus("already"); return; }
        setEmail(data.email ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function confirm() {
    setStatus("submitting");
    try {
      const r = await fetch(`/email/unsubscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setStatus(r.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight">Unsubscribe from RideRite emails</h1>
        <div className="mt-6 text-sm text-muted-foreground">
          {status === "loading" && "Checking your link…"}
          {status === "invalid" && "This unsubscribe link is invalid or has expired."}
          {status === "already" && "You're already unsubscribed."}
          {status === "ready" && (
            <>Click below to stop receiving emails{email ? ` at ${email}` : ""}.</>
          )}
          {status === "submitting" && "Updating your preferences…"}
          {status === "done" && "You've been unsubscribed. We're sorry to see you go."}
          {status === "error" && "Something went wrong. Please try again later."}
        </div>
        {status === "ready" && (
          <button
            onClick={confirm}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Confirm unsubscribe
          </button>
        )}
      </div>
    </div>
  );
}
