import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  getMonitoringOverview,
  listSystemEvents,
  listMonitoringAlerts,
  resolveMonitoringAlert,
} from "@/lib/monitoring.functions";

const CATEGORIES = ["stripe_webhook", "payout", "subscription", "connect", "cron"] as const;
const LABEL: Record<string, string> = {
  stripe_webhook: "Stripe Webhooks",
  payout: "Payouts",
  subscription: "Subscriptions",
  connect: "Connect Accounts",
  cron: "Cron Jobs",
};

function severityBadge(sev: string) {
  const tone =
    sev === "critical" ? "bg-destructive text-destructive-foreground"
    : sev === "error" ? "bg-destructive/80 text-destructive-foreground"
    : sev === "warning" ? "bg-amber-500 text-black"
    : "bg-muted text-muted-foreground";
  return <Badge className={tone}>{sev}</Badge>;
}

function timeAgo(iso: string | null | undefined) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

export function MonitoringTab() {
  const fetchOverview = useServerFn(getMonitoringOverview);
  const fetchEvents = useServerFn(listSystemEvents);
  const fetchAlerts = useServerFn(listMonitoringAlerts);
  const resolveFn = useServerFn(resolveMonitoringAlert);
  const qc = useQueryClient();

  const overview = useQuery({
    queryKey: ["monitoring", "overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
  });

  const alerts = useQuery({
    queryKey: ["monitoring", "alerts"],
    queryFn: () => fetchAlerts({ data: { includeResolved: false } }),
    refetchInterval: 30_000,
  });

  const events = useQuery({
    queryKey: ["monitoring", "events"],
    queryFn: () => fetchEvents({ data: { limit: 100 } }),
    refetchInterval: 30_000,
  });

  const failures = useQuery({
    queryKey: ["monitoring", "events", "failure"],
    queryFn: () => fetchEvents({ data: { limit: 50, status: "failure" } }),
    refetchInterval: 30_000,
  });

  const resolve = useMutation({
    mutationFn: (id: string) => resolveFn({ data: { id } }),
    onSuccess: () => { toast.success("Alert resolved"); qc.invalidateQueries({ queryKey: ["monitoring"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to resolve"),
  });

  const byCat = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of overview.data?.categories ?? []) map.set(c.category, c);
    return map;
  }, [overview.data]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["monitoring"] });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Production Monitoring</h2>
          {overview.data?.last_webhook_at && (
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3 w-3" /> last webhook {timeAgo(overview.data.last_webhook_at)}
            </Badge>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        {CATEGORIES.map((cat) => {
          const c = byCat.get(cat);
          const total = Number(c?.total_24h ?? 0);
          const fails = Number(c?.fail_24h ?? 0);
          const rate = total ? (fails / total) * 100 : 0;
          const tone = rate >= 20 ? "border-destructive" : rate >= 5 ? "border-amber-500" : "border-border";
          return (
            <Card key={cat} className={`p-4 border ${tone}`}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{LABEL[cat]}</div>
              <div className="mt-2 flex items-baseline gap-2">
                <div className="text-2xl font-bold">{total}</div>
                <div className="text-xs text-muted-foreground">/ 24h</div>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                {fails > 0 ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                <span className={fails > 0 ? "text-destructive" : "text-muted-foreground"}>
                  {fails} failure{fails === 1 ? "" : "s"} ({rate.toFixed(1)}%)
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                1h: {c?.total_1h ?? 0} / err {c?.fail_1h ?? 0} · 7d: {c?.total_7d ?? 0} / err {c?.fail_7d ?? 0}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Active alerts */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <h3 className="font-bold">Active Alerts</h3>
          <Badge variant="secondary">{alerts.data?.length ?? 0}</Badge>
        </div>
        {alerts.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (alerts.data?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">All clear. No open alerts.</div>
        ) : (
          <div className="space-y-2">
            {alerts.data!.map((a: any) => (
              <div key={a.id} className="flex items-start justify-between gap-3 p-3 border border-border rounded-md">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {severityBadge(a.severity)}
                    <span className="font-semibold">{a.title}</span>
                    <span className="text-xs text-muted-foreground">· {a.rule}</span>
                  </div>
                  {a.message && <p className="text-sm text-muted-foreground mt-1">{a.message}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(a.created_at)}</p>
                </div>
                <Button size="sm" variant="outline" disabled={resolve.isPending} onClick={() => resolve.mutate(a.id)}>
                  Resolve
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent failures */}
      <Card className="p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2"><XCircle className="h-4 w-4 text-destructive" /> Recent Failures</h3>
        {failures.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (failures.data?.length ?? 0) === 0 ? (
          <div className="text-sm text-muted-foreground">No recent failures.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase">
                <tr><th className="text-left p-2">When</th><th className="text-left p-2">Category</th><th className="text-left p-2">Event</th><th className="text-left p-2">Error</th><th className="text-left p-2">Env</th></tr>
              </thead>
              <tbody>
                {failures.data!.map((e: any) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-2 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                    <td className="p-2"><Badge variant="outline">{e.category}</Badge></td>
                    <td className="p-2 font-mono text-xs">{e.event_type}</td>
                    <td className="p-2 text-destructive max-w-[420px] truncate" title={e.error_message ?? ""}>{e.error_message ?? "—"}</td>
                    <td className="p-2 text-xs text-muted-foreground">{e.environment ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Recent events */}
      <Card className="p-4">
        <h3 className="font-bold mb-3">Recent Events</h3>
        {events.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background text-xs text-muted-foreground uppercase">
                <tr><th className="text-left p-2">When</th><th className="text-left p-2">Category</th><th className="text-left p-2">Event</th><th className="text-left p-2">Status</th><th className="text-left p-2">Latency</th><th className="text-left p-2">Ref</th></tr>
              </thead>
              <tbody>
                {(events.data ?? []).map((e: any) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="p-2 whitespace-nowrap">{timeAgo(e.created_at)}</td>
                    <td className="p-2"><Badge variant="outline">{e.category}</Badge></td>
                    <td className="p-2 font-mono text-xs">{e.event_type}</td>
                    <td className="p-2">
                      {e.status === "success"
                        ? <span className="text-emerald-500 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> ok</span>
                        : <span className="text-destructive inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> {e.status}</span>}
                    </td>
                    <td className="p-2 text-xs">{e.latency_ms != null ? `${e.latency_ms}ms` : "—"}</td>
                    <td className="p-2 font-mono text-xs truncate max-w-[180px]" title={e.reference_id ?? ""}>{e.reference_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
