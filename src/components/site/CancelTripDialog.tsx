import { useState } from "react";
import { XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const REASONS = [
  "Driver is taking too long",
  "Wrong pickup location",
  "Changed my mind",
  "Found another ride",
  "Driver asked me to cancel",
  "Safety concern",
  "Other",
];

export function CancelTripDialog({
  tripId,
  userId,
  onClose,
  onCancelled,
}: {
  tripId: string;
  userId: string;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    const finalReason = reason === "Other" && note.trim() ? note.trim() : reason;
    const { error } = await supabase
      .from("trips")
      .update({
        status: "cancelled",
        cancellation_reason: finalReason,
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
      })
      .eq("id", tripId);
    setSubmitting(false);
    if (error) { setError(error.message); return; }
    onCancelled();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-elevated" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-primary" />
            <h3 className="text-display text-xl tracking-wider">CANCEL TRIP</h3>
          </div>
          <button onClick={onClose} className="text-xs font-bold text-muted-foreground hover:text-primary uppercase tracking-wider">Keep ride</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2 text-xs text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Repeated cancellations may incur a small fee. Help us improve by telling us why.</span>
          </div>

          <div>
            <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground uppercase mb-2">Reason</div>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`w-full text-left rounded-md border px-3 py-2.5 text-sm font-bold uppercase tracking-wider transition ${
                    reason === r
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-background/40 text-foreground hover:border-primary/40"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {reason === "Other" && (
            <div>
              <div className="text-[10px] font-bold tracking-[0.25em] text-muted-foreground uppercase mb-2">Tell us more</div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={280}
                placeholder="Add a short note (optional)"
                className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          )}

          {error && <div className="text-xs text-amber-400">⚠ {error}</div>}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-border py-2.5 text-sm font-bold uppercase tracking-wider hover:border-primary/40"
            >
              Keep ride
            </button>
            <button
              onClick={submit}
              disabled={!reason || submitting}
              className="flex-1 rounded-md bg-primary py-2.5 text-sm font-bold text-primary-foreground uppercase tracking-wider disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel trip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
