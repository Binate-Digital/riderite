import { Check, Clock, Car, Navigation, Flag, XCircle, Loader2 } from "lucide-react";

type Status = "requested" | "accepted" | "arriving" | "in_progress" | "completed" | "cancelled";

const FLOW: { key: Status; label: string; sub: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "requested", label: "Requested", sub: "We're matching you with a driver", Icon: Clock },
  { key: "accepted", label: "Accepted", sub: "Driver is on the way", Icon: Car },
  { key: "arriving", label: "Arriving", sub: "Driver is close to your pickup", Icon: Navigation },
  { key: "in_progress", label: "In progress", sub: "Enjoy your ride", Icon: Loader2 },
  { key: "completed", label: "Completed", sub: "Trip done — ride right ✓", Icon: Flag },
];

export function TripTimeline({ status, cancellationReason }: { status: string; cancellationReason?: string | null }) {
  const cancelled = status === "cancelled";
  const currentIdx = FLOW.findIndex((s) => s.key === status);

  if (cancelled) {
    return (
      <div className="rounded-xl border border-border bg-background/40 p-5">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-muted-foreground uppercase mb-4">
          / TRIP TIMELINE
        </div>
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-full border border-border bg-muted text-muted-foreground inline-flex items-center justify-center shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold uppercase tracking-wider text-sm">Cancelled</div>
            <div className="text-xs text-muted-foreground mt-0.5">This trip was cancelled.</div>
            {cancellationReason && (
              <div className="mt-2 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs">
                <span className="font-bold uppercase tracking-wider text-muted-foreground">Reason: </span>
                <span className="text-foreground">{cancellationReason}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-5">
      <div className="flex items-center gap-2 text-xs font-bold tracking-[0.25em] text-muted-foreground uppercase mb-4">
        / TRIP TIMELINE
      </div>
      <ol className="relative">
        {FLOW.map((step, i) => {
          const done = currentIdx > i;
          const active = currentIdx === i;
          const Icon = step.Icon;
          const isLast = i === FLOW.length - 1;
          return (
            <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={`absolute left-[18px] top-9 bottom-0 w-px ${
                    done ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
              <div
                className={`h-9 w-9 rounded-full inline-flex items-center justify-center shrink-0 border transition ${
                  done
                    ? "bg-primary text-primary-foreground border-primary"
                    : active
                    ? "bg-primary/15 text-primary border-primary animate-pulse"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {done ? (
                  <Check className="h-4 w-4" />
                ) : active && step.key === "in_progress" ? (
                  <Icon className="h-4 w-4 animate-spin" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </div>
              <div className="pt-1">
                <div
                  className={`font-bold uppercase tracking-wider text-sm ${
                    active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                  {active && (
                    <span className="ml-2 inline-block rounded-full bg-primary/15 text-primary text-[10px] font-bold px-2 py-0.5 tracking-[0.2em]">
                      NOW
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{step.sub}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
