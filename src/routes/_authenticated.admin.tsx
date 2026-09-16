import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield, Users, Car, Map as MapIcon, DollarSign, BarChart3, Check, X, Loader2, Search, Save, AlertTriangle, Mail, RefreshCw,
} from "lucide-react";
import { getEmailLogs } from "@/lib/email-logs.functions";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/site/DashboardHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { getPricingConfig, updatePricingConfig, type PricingRow } from "@/lib/pricing.functions";
import { bulkSetDriverStatus } from "@/lib/drivers.functions";
import { setUserRole, setDriverStatus } from "@/lib/admin.functions";
import { adminListKyc, adminUpdateKycStatus } from "@/lib/driver-kyc.functions";
import { ensureAdmin } from "@/lib/admin-guard.functions";
import { MonitoringTab } from "@/components/admin/MonitoringTab";

export const Route = createFileRoute("/_authenticated/admin")({
  // Server-side admin guard runs before HTML is rendered. Non-admins are
  // redirected to /dashboard and never receive the admin panel shell.
  beforeLoad: async () => {
    try {
      await ensureAdmin();
    } catch {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPanel,
});

function AdminPanel() {
  const { roles, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-background grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!roles.includes("admin")) {
    return <Navigate to="/dashboard" />;
  }
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex items-center gap-2 text-xs font-bold tracking-[0.3em] text-primary">
          <Shield className="h-4 w-4" /> / ADMIN PANEL
        </div>
        <h1 className="mt-2 text-display text-5xl sm:text-6xl">CONTROL <span className="text-primary">CENTER</span></h1>
        <p className="mt-2 text-muted-foreground">Manage users, drivers, trips, pricing and view platform analytics.</p>

        <Tabs defaultValue="analytics" className="mt-10">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-8 bg-surface border border-border">
            <TabsTrigger value="analytics" className="gap-2"><BarChart3 className="h-4 w-4" /> Analytics</TabsTrigger>
            <TabsTrigger value="monitoring" className="gap-2"><AlertTriangle className="h-4 w-4" /> Monitoring</TabsTrigger>
            <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
            <TabsTrigger value="drivers" className="gap-2"><Car className="h-4 w-4" /> Drivers</TabsTrigger>
            <TabsTrigger value="kyc" className="gap-2"><Shield className="h-4 w-4" /> KYC</TabsTrigger>
            <TabsTrigger value="trips" className="gap-2"><MapIcon className="h-4 w-4" /> Trips</TabsTrigger>
            <TabsTrigger value="pricing" className="gap-2"><DollarSign className="h-4 w-4" /> Pricing</TabsTrigger>
            <TabsTrigger value="emails" className="gap-2"><Mail className="h-4 w-4" /> Emails</TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="mt-6"><AnalyticsTab /></TabsContent>
          <TabsContent value="monitoring" className="mt-6"><MonitoringTab /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
          <TabsContent value="drivers" className="mt-6"><DriversTab /></TabsContent>
          <TabsContent value="kyc" className="mt-6"><KycTab /></TabsContent>
          <TabsContent value="trips" className="mt-6"><TripsTab /></TabsContent>
          <TabsContent value="pricing" className="mt-6"><PricingTab /></TabsContent>
          <TabsContent value="emails" className="mt-6"><EmailsTab /></TabsContent>
        </Tabs>

        <p className="mt-10 text-xs text-muted-foreground">
          Need rider tools? Go back to <Link to="/dashboard" className="text-primary font-bold hover:underline">Dashboard</Link>.
        </p>
      </main>
    </div>
  );
}

const fmtMoney = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ============================== ANALYTICS ============================== */

function AnalyticsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const [trips, drivers, payments] = await Promise.all([
        supabase.from("trips").select("status, fare_cents, paid, payment_method, created_at"),
        supabase.from("driver_profiles").select("status"),
        supabase.from("payments").select("status, amount_cents"),
      ]);
      const tripRows = trips.data ?? [];
      const completed = tripRows.filter((t) => t.status === "completed");
      const cancelled = tripRows.filter((t) => t.status === "cancelled");
      const active = tripRows.filter((t) => ["requested", "accepted", "arriving", "in_progress"].includes(t.status as string));
      const grossCents = completed.reduce((s, t) => s + (t.fare_cents ?? 0), 0);
      const paidCents = (payments.data ?? [])
        .filter((p) => p.status === "succeeded" || p.status === "paid")
        .reduce((s, p) => s + (p.amount_cents ?? 0), 0);
      const driverCounts = (drivers.data ?? []).reduce<Record<string, number>>((acc, d) => {
        acc[d.status as string] = (acc[d.status as string] ?? 0) + 1;
        return acc;
      }, {});
      const last7 = tripRows.filter((t) => new Date(t.created_at as string) > new Date(Date.now() - 7 * 86400000));
      return {
        totalTrips: tripRows.length,
        completed: completed.length,
        cancelled: cancelled.length,
        active: active.length,
        grossCents,
        paidCents,
        driverCounts,
        trips7d: last7.length,
      };
    },
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading analytics…</div>;

  const stats: Array<{ label: string; value: string; sub?: string }> = [
    { label: "Total trips", value: String(data.totalTrips), sub: `${data.trips7d} in last 7 days` },
    { label: "Completed", value: String(data.completed) },
    { label: "Active now", value: String(data.active) },
    { label: "Cancelled", value: String(data.cancelled) },
    { label: "Gross fares", value: fmtMoney(data.grossCents), sub: "All completed trips" },
    { label: "Paid online", value: fmtMoney(data.paidCents), sub: "Card / Cash App / PayPal" },
    { label: "Approved drivers", value: String(data.driverCounts.approved ?? 0) },
    { label: "Pending drivers", value: String(data.driverCounts.pending ?? 0) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-2xl border border-border bg-surface p-5">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
          <div className="mt-1 text-display text-3xl">{s.value}</div>
          {s.sub && <div className="mt-1 text-xs text-muted-foreground">{s.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/* ============================== USERS ============================== */

interface ProfileRow { id: string; full_name: string | null; phone: string | null; created_at: string }
interface RoleRow { user_id: string; role: "rider" | "driver" | "admin" }

function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id, full_name, phone, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return {
        profiles: (p.data ?? []) as ProfileRow[],
        roles: (r.data ?? []) as RoleRow[],
      };
    },
  });

  const setRoleFn = useServerFn(setUserRole);
  const setRole = useMutation({
    mutationFn: async ({ userId, role, add }: { userId: string; role: RoleRow["role"]; add: boolean }) => {
      await setRoleFn({ data: { userId, role, add } });
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.add ? "Granted" : "Revoked"} ${vars.role}`);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading users…</div>;
  const roleMap = new Map<string, Set<RoleRow["role"]>>();
  for (const r of data.roles) {
    if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, new Set());
    roleMap.get(r.user_id)!.add(r.role);
  }
  const filtered = data.profiles.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (p.full_name ?? "").toLowerCase().includes(q) || (p.phone ?? "").includes(q) || p.id.includes(q);
  });

  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="p-4 border-b border-border flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, phone or user ID"
          className="border-0 focus-visible:ring-0 bg-transparent"
        />
        <span className="text-xs text-muted-foreground">{filtered.length} users</span>
      </div>
      <div className="divide-y divide-border">
        {filtered.map((p) => {
          const rs = roleMap.get(p.id) ?? new Set();
          return (
            <div key={p.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="font-bold">{p.full_name || "—"}</div>
                <div className="text-xs text-muted-foreground">{p.phone || "no phone"} · {p.id.slice(0, 8)}…</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(["rider", "driver", "admin"] as const).map((role) => {
                  const has = rs.has(role);
                  return (
                    <Button
                      key={role}
                      size="sm"
                      variant={has ? "default" : "outline"}
                      disabled={setRole.isPending}
                      onClick={() => setRole.mutate({ userId: p.id, role, add: !has })}
                    >
                      {has ? <Check className="h-3 w-3 mr-1" /> : null}{role}
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No users match.</div>}
      </div>
    </div>
  );
}

/* ============================== DRIVERS ============================== */

interface DriverRow {
  user_id: string; vehicle_type: string; make: string; model: string; year: number;
  license_plate: string; status: "pending" | "approved" | "rejected" | "suspended"; created_at: string;
  status_reason: string | null; status_changed_at: string | null;
}

type DriverWithProfile = DriverRow & { profile?: { full_name: string | null; phone: string | null } };

function DriversTab() {
  const qc = useQueryClient();
  const bulkSetStatusFn = useServerFn(bulkSetDriverStatus);
  const queryKey = ["admin-drivers"] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: drivers, error } = await supabase
        .from("driver_profiles")
        .select("user_id, vehicle_type, make, model, year, license_plate, status, created_at, status_reason, status_changed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (drivers ?? []).map((d) => d.user_id);
      const { data: profiles } = ids.length
        ? await supabase.from("profiles").select("id, full_name, phone").in("id", ids)
        : { data: [] };
      const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
      return (drivers as DriverRow[] ?? []).map((d) => ({ ...d, profile: pmap.get(d.user_id) }));
    },
  });

  // Single-driver confirmation + reason
  const [confirmAction, setConfirmAction] = useState<{ userId: string; status: DriverRow["status"]; name: string } | null>(null);
  const [pending, setPending] = useState<{ userId: string; status: DriverRow["status"]; name: string } | null>(null);
  const [reason, setReason] = useState("");

  // Bulk selection + dialogs
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<DriverRow["status"] | null>(null);
  const [bulkReasonOpen, setBulkReasonOpen] = useState<DriverRow["status"] | null>(null);
  const [bulkSharedReason, setBulkSharedReason] = useState("");
  const [bulkPerDriverReason, setBulkPerDriverReason] = useState<Record<string, string>>({});
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number; batch: number; batches: number } | null>(null);

  const setStatusFn = useServerFn(setDriverStatus);
  const setStatus = useMutation({
    mutationFn: async ({ userId, status, statusReason }: { userId: string; status: DriverRow["status"]; statusReason: string | null }) => {
      await setStatusFn({ data: { userId, status, statusReason } });
    },
    onMutate: async ({ userId, status, statusReason }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<DriverWithProfile[]>(queryKey);
      if (prev) {
        qc.setQueryData<DriverWithProfile[]>(queryKey, prev.map((d) =>
          d.user_id === userId
            ? { ...d, status, status_reason: statusReason, status_changed_at: new Date().toISOString() }
            : d,
        ));
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error(e.message);
    },
    onSuccess: (_d, v) => {
      toast.success(`Driver ${v.status}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey });
    },
  });

  const handleAction = (d: DriverWithProfile, status: DriverRow["status"]) => {
    setConfirmAction({
      userId: d.user_id,
      status,
      name: d.profile?.full_name || `${d.year} ${d.make} ${d.model}`,
    });
  };

  const proceedFromConfirm = () => {
    if (!confirmAction) return;
    const { userId, status, name } = confirmAction;
    setConfirmAction(null);
    if (status === "approved") {
      setStatus.mutate({ userId, status, statusReason: null });
    } else {
      setReason("");
      setPending({ userId, status, name });
    }
  };

  const submitReason = () => {
    if (!pending) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      toast.error("Please provide a reason (min 5 characters)");
      return;
    }
    if (trimmed.length > 500) {
      toast.error("Reason must be under 500 characters");
      return;
    }
    setStatus.mutate({ userId: pending.userId, status: pending.status, statusReason: trimmed });
    setPending(null);
  };

  // Bulk helpers
  const toggleSelect = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };
  const toggleSelectMany = (ids: string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedDrivers = useMemo(
    () => (data ?? []).filter((d) => selected.has(d.user_id)),
    [data, selected],
  );

  const startBulk = (status: DriverRow["status"]) => {
    if (selected.size === 0) return;
    setBulkConfirm(status);
  };

  const proceedBulkConfirm = () => {
    const status = bulkConfirm;
    if (!status) return;
    setBulkConfirm(null);
    if (status === "approved") {
      runBulk(status, {});
    } else {
      setBulkSharedReason("");
      setBulkPerDriverReason({});
      setBulkReasonOpen(status);
    }
  };

  const runBulk = async (status: DriverRow["status"], perDriver: Record<string, string>) => {
    const targets = selectedDrivers;
    if (targets.length === 0) return;
    setBulkRunning(true);
    setBulkProgress({ completed: 0, total: targets.length, batch: 0, batches: 0 });
    const now = new Date().toISOString();
    const prev = qc.getQueryData<DriverWithProfile[]>(queryKey);
    if (prev) {
      qc.setQueryData<DriverWithProfile[]>(queryKey, prev.map((d) =>
        selected.has(d.user_id)
          ? { ...d, status, status_reason: perDriver[d.user_id] ?? null, status_changed_at: now }
          : d,
      ));
    }
    try {
      let finalResult: { updated: number; batches: number } | null = null;
      const stream = await bulkSetStatusFn({
        data: {
          updates: targets.map((d) => ({
            userId: d.user_id,
            status,
            statusReason: perDriver[d.user_id] ?? null,
          })),
        },
      });
      for await (const chunk of stream) {
        if (chunk.type === "progress") {
          setBulkProgress({
            completed: (chunk as any).completed,
            total: (chunk as any).total,
            batch: (chunk as any).batch,
            batches: (chunk as any).batches,
          });
        } else if (chunk.type === "done") {
          finalResult = {
            updated: (chunk as any).updated,
            batches: (chunk as any).batches,
          };
        }
      }
      if (finalResult) {
        toast.success(
          `${finalResult.updated} driver${finalResult.updated === 1 ? "" : "s"} ${status}` +
            (finalResult.batches > 1 ? ` (${finalResult.batches} batches)` : ""),
        );
      }
      clearSelection();
    } catch (e) {
      if (prev) qc.setQueryData(queryKey, prev);
      toast.error(e instanceof Error ? e.message : "Bulk update failed");
    } finally {
      setBulkRunning(false);
      setBulkProgress(null);
      qc.invalidateQueries({ queryKey });
    }
  };

  const submitBulkReason = () => {
    const status = bulkReasonOpen;
    if (!status) return;
    const shared = bulkSharedReason.trim();
    // Build per-driver reasons: use per-driver text if provided, else shared
    const perDriver: Record<string, string> = {};
    for (const d of selectedDrivers) {
      const indiv = (bulkPerDriverReason[d.user_id] ?? "").trim();
      const reason = indiv || shared;
      if (reason.length < 5) {
        toast.error(`Reason for ${d.profile?.full_name || d.user_id.slice(0, 8)} is too short (min 5 chars)`);
        return;
      }
      if (reason.length > 500) {
        toast.error(`Reason for ${d.profile?.full_name || d.user_id.slice(0, 8)} exceeds 500 chars`);
        return;
      }
      perDriver[d.user_id] = reason;
    }
    setBulkReasonOpen(null);
    runBulk(status, perDriver);
  };

  if (isLoading || !data) return <div className="text-muted-foreground">Loading drivers…</div>;
  const pendingDrivers = data.filter((d) => d.status === "pending");
  const others = data.filter((d) => d.status !== "pending");

  const confirmLabels: Record<DriverRow["status"], { title: string; desc: string; variant: "default" | "destructive" }> = {
    pending: { title: "Mark as pending", desc: "The driver will be moved to pending status.", variant: "default" },
    approved: { title: "Approve driver", desc: "This driver will be able to accept and complete trips.", variant: "default" },
    rejected: { title: "Reject driver", desc: "You will be asked for a reason after confirming. The driver will not be able to operate on the platform.", variant: "destructive" },
    suspended: { title: "Suspend driver", desc: "You will be asked for a reason after confirming. The driver will be temporarily blocked from accepting trips.", variant: "destructive" },
  };
  const bulkLabels: Record<"approved" | "rejected" | "suspended", { variant: "default" | "destructive" }> = {
    approved: { variant: "default" },
    rejected: { variant: "destructive" },
    suspended: { variant: "destructive" },
  };

  const allPendingChecked = pendingDrivers.length > 0 && pendingDrivers.every((d) => selected.has(d.user_id));
  const allOthersChecked = others.length > 0 && others.every((d) => selected.has(d.user_id));

  return (
    <div className="space-y-6">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-surface/95 backdrop-blur px-4 py-3 shadow-lg">
          <div className="text-sm">
            <span className="font-bold">{selected.size}</span> driver{selected.size === 1 ? "" : "s"} selected
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={bulkRunning} onClick={() => startBulk("approved")}>
              <Check className="h-3 w-3 mr-1" /> Approve all
            </Button>
            <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => startBulk("rejected")}>
              <X className="h-3 w-3 mr-1" /> Reject all
            </Button>
            <Button size="sm" variant="outline" disabled={bulkRunning} onClick={() => startBulk("suspended")}>
              Suspend all
            </Button>
            <Button size="sm" variant="ghost" disabled={bulkRunning} onClick={clearSelection}>Clear</Button>
          </div>
        </div>
      )}

      <Section
        title={`Pending approval (${pendingDrivers.length})`}
        headerExtra={pendingDrivers.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground normal-case tracking-normal">
            <Checkbox
              checked={allPendingChecked}
              onCheckedChange={(v) => toggleSelectMany(pendingDrivers.map((d) => d.user_id), Boolean(v))}
            />
            Select all
          </label>
        ) : null}
      >
        {pendingDrivers.length === 0 && <p className="p-4 text-sm text-muted-foreground">No pending applications.</p>}
        {pendingDrivers.map((d) => (
          <DriverRowCard
            key={d.user_id}
            d={d}
            onSet={(s) => handleAction(d, s)}
            busy={setStatus.isPending || bulkRunning}
            checked={selected.has(d.user_id)}
            onToggle={() => toggleSelect(d.user_id)}
          />
        ))}
      </Section>
      <Section
        title={`All drivers (${others.length})`}
        headerExtra={others.length > 0 ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground normal-case tracking-normal">
            <Checkbox
              checked={allOthersChecked}
              onCheckedChange={(v) => toggleSelectMany(others.map((d) => d.user_id), Boolean(v))}
            />
            Select all
          </label>
        ) : null}
      >
        {others.map((d) => (
          <DriverRowCard
            key={d.user_id}
            d={d}
            onSet={(s) => handleAction(d, s)}
            busy={setStatus.isPending || bulkRunning}
            checked={selected.has(d.user_id)}
            onToggle={() => toggleSelect(d.user_id)}
          />
        ))}
      </Section>

      {/* Single confirmation dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              {confirmAction && confirmLabels[confirmAction.status].title}
            </DialogTitle>
            <DialogDescription>
              {confirmAction && (
                <>
                  You are about to <span className="font-bold text-foreground">{confirmAction.status}</span> <span className="font-semibold">{confirmAction.name}</span>.{" "}
                  {confirmLabels[confirmAction.status].desc}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button
              variant={confirmAction ? confirmLabels[confirmAction.status].variant : "default"}
              onClick={proceedFromConfirm}
              disabled={setStatus.isPending}
            >
              Confirm {confirmAction?.status}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single reason dialog */}
      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.status === "rejected" ? "Reject driver" : "Suspend driver"}
            </DialogTitle>
            <DialogDescription>
              {pending?.name} will be marked as <span className="font-bold text-foreground">{pending?.status}</span>. Provide a reason — this is stored on the driver record.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="reason"
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder={pending?.status === "rejected"
                ? "e.g. Vehicle does not meet age requirement, missing insurance documents"
                : "e.g. Multiple cancellations, customer complaints under review"}
              rows={4}
              autoFocus
            />
            <div className="text-xs text-muted-foreground text-right">{reason.length}/500</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button
              variant={pending?.status === "rejected" ? "destructive" : "default"}
              onClick={submitReason}
              disabled={setStatus.isPending || reason.trim().length < 5}
            >
              Confirm {pending?.status}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk confirmation dialog */}
      <Dialog open={!!bulkConfirm} onOpenChange={(o) => !o && setBulkConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              {bulkConfirm && `Bulk ${bulkConfirm} ${selectedDrivers.length} driver${selectedDrivers.length === 1 ? "" : "s"}`}
            </DialogTitle>
            <DialogDescription>
              {bulkConfirm === "approved"
                ? "All selected drivers will be approved and able to accept trips."
                : `You'll be asked for a reason next. Each driver can have an individual reason or share one.`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-48 overflow-auto rounded-md border border-border bg-background/50 p-3 text-xs space-y-1">
            {selectedDrivers.map((d) => (
              <div key={d.user_id} className="flex justify-between gap-2">
                <span className="truncate">{d.profile?.full_name || `${d.year} ${d.make} ${d.model}`}</span>
                <span className="text-muted-foreground">{d.status}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkConfirm(null)}>Cancel</Button>
            <Button
              variant={bulkConfirm ? bulkLabels[bulkConfirm as "approved" | "rejected" | "suspended"].variant : "default"}
              onClick={proceedBulkConfirm}
              disabled={bulkRunning}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk reason dialog */}
      <Dialog open={!!bulkReasonOpen} onOpenChange={(o) => !o && setBulkReasonOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Bulk {bulkReasonOpen} · {selectedDrivers.length} driver{selectedDrivers.length === 1 ? "" : "s"}
            </DialogTitle>
            <DialogDescription>
              Set a shared reason applied to all, or override per driver below. Each reason must be 5–500 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-shared">Shared reason (applied unless overridden)</Label>
              <Textarea
                id="bulk-shared"
                value={bulkSharedReason}
                onChange={(e) => setBulkSharedReason(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder={bulkReasonOpen === "rejected"
                  ? "e.g. Documents could not be verified"
                  : "e.g. Pending review of customer complaints"}
              />
              <div className="text-xs text-muted-foreground text-right">{bulkSharedReason.length}/500</div>
            </div>
            <div className="space-y-2">
              <Label>Per-driver overrides (optional)</Label>
              <div className="max-h-64 overflow-auto space-y-2 rounded-md border border-border p-2">
                {selectedDrivers.map((d) => (
                  <div key={d.user_id} className="grid sm:grid-cols-3 gap-2 items-start">
                    <div className="text-sm truncate sm:pt-2">
                      <div className="font-bold truncate">{d.profile?.full_name || `${d.year} ${d.make} ${d.model}`}</div>
                      <div className="text-xs text-muted-foreground">{d.license_plate}</div>
                    </div>
                    <Input
                      className="sm:col-span-2"
                      value={bulkPerDriverReason[d.user_id] ?? ""}
                      maxLength={500}
                      onChange={(e) => setBulkPerDriverReason({ ...bulkPerDriverReason, [d.user_id]: e.target.value })}
                      placeholder="Leave empty to use shared reason"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkReasonOpen(null)}>Cancel</Button>
            <Button
              variant={bulkReasonOpen === "rejected" ? "destructive" : "default"}
              onClick={submitBulkReason}
              disabled={bulkRunning}
            >
              {bulkRunning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Apply to {selectedDrivers.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk progress dialog */}
      <Dialog open={bulkRunning && !!bulkProgress} onOpenChange={() => {}}>
        <DialogContent
          className="sm:max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Updating drivers…</DialogTitle>
            <DialogDescription>
              {bulkProgress && `Batch ${bulkProgress.batch} of ${bulkProgress.batches} · ${bulkProgress.completed} of ${bulkProgress.total} drivers`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: bulkProgress && bulkProgress.total > 0
                    ? `${(bulkProgress.completed / bulkProgress.total) * 100}%`
                    : "0%",
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground text-center">
              {bulkProgress && bulkProgress.batches > 1
                ? `Processing batch ${bulkProgress.batch} of ${bulkProgress.batches}…`
                : "Processing…"}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children, headerExtra }: { title: string; children: React.ReactNode; headerExtra?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div className="text-display tracking-wider">{title.toUpperCase()}</div>
        {headerExtra}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function DriverRowCard({
  d, onSet, busy, checked, onToggle,
}: {
  d: DriverWithProfile;
  onSet: (s: DriverRow["status"]) => void;
  busy: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const colors: Record<DriverRow["status"], string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 border-red-500/30",
    suspended: "bg-muted text-muted-foreground border-border",
  };
  const showReason = (d.status === "rejected" || d.status === "suspended") && d.status_reason;
  return (
    <div className="p-4 flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <Checkbox checked={checked} onCheckedChange={onToggle} className="mt-1" aria-label="Select driver" />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{d.profile?.full_name || "—"} <span className="text-xs text-muted-foreground font-normal">· {d.profile?.phone || "no phone"}</span></div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {d.year} {d.make} {d.model} · {d.vehicle_type.toUpperCase()} · {d.license_plate}
          </div>
          <span className={`mt-2 inline-block text-[10px] font-bold uppercase tracking-wider rounded-full border px-2 py-0.5 ${colors[d.status]}`}>
            {d.status}
          </span>
          {showReason && (
            <div className="mt-2 rounded-md border border-border bg-background/50 p-2 text-xs">
              <div className="font-bold uppercase tracking-wider text-muted-foreground">
                {d.status} reason{d.status_changed_at ? ` · ${new Date(d.status_changed_at).toLocaleDateString()}` : ""}
              </div>
              <div className="mt-1 text-foreground/90">{d.status_reason}</div>
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" disabled={busy || d.status === "approved"} onClick={() => onSet("approved")}><Check className="h-3 w-3 mr-1" /> Approve</Button>
        <Button size="sm" variant="outline" disabled={busy || d.status === "rejected"} onClick={() => onSet("rejected")}><X className="h-3 w-3 mr-1" /> Reject</Button>
        <Button size="sm" variant="outline" disabled={busy || d.status === "suspended"} onClick={() => onSet("suspended")}>Suspend</Button>
      </div>
    </div>
  );
}

/* ============================== TRIPS ============================== */

interface AdminTripRow {
  id: string; status: string; pickup_address: string; destination_address: string;
  vehicle_type: string; payment_method: string; paid: boolean; fare_cents: number;
  rider_id: string; driver_id: string | null; created_at: string;
}

function TripsTab() {
  const [filter, setFilter] = useState<string>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-trips"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, status, pickup_address, destination_address, vehicle_type, payment_method, paid, fare_cents, rider_id, driver_id, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as AdminTripRow[];
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === "all") return data;
    if (filter === "active") return data.filter((t) => ["requested", "accepted", "arriving", "in_progress"].includes(t.status));
    return data.filter((t) => t.status === filter);
  }, [data, filter]);

  const filters = ["all", "active", "completed", "cancelled"];
  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      {isLoading && <div className="text-muted-foreground">Loading trips…</div>}
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {filtered.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="font-bold truncate">{t.pickup_address} → {t.destination_address}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(t.created_at).toLocaleString()} · {t.vehicle_type.toUpperCase()} · {t.payment_method} · {t.paid ? "paid" : "unpaid"}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                rider {t.rider_id.slice(0, 8)}… {t.driver_id ? `· driver ${t.driver_id.slice(0, 8)}…` : "· no driver"}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="outline">{t.status}</Badge>
              <span className="font-bold">{fmtMoney(t.fare_cents)}</span>
            </div>
          </div>
        ))}
        {!isLoading && filtered.length === 0 && <div className="p-6 text-sm text-muted-foreground">No trips.</div>}
      </div>
    </div>
  );
}

/* ============================== PRICING ============================== */

const PRICING_GROUPS: Array<{ title: string; fields: Array<{ key: keyof PricingRow; label: string; suffix?: string }> }> = [
  {
    title: "Sedan",
    fields: [
      { key: "sedan_base_cents", label: "Base", suffix: "¢" },
      { key: "sedan_per_mile_cents", label: "Per mile", suffix: "¢" },
      { key: "sedan_per_min_cents", label: "Per minute", suffix: "¢" },
    ],
  },
  {
    title: "SUV",
    fields: [
      { key: "suv_base_cents", label: "Base", suffix: "¢" },
      { key: "suv_per_mile_cents", label: "Per mile", suffix: "¢" },
      { key: "suv_per_min_cents", label: "Per minute", suffix: "¢" },
    ],
  },
  {
    title: "Truck",
    fields: [
      { key: "truck_base_cents", label: "Base", suffix: "¢" },
      { key: "truck_per_mile_cents", label: "Per mile", suffix: "¢" },
      { key: "truck_per_min_cents", label: "Per minute", suffix: "¢" },
    ],
  },
  {
    title: "Fees & taxes",
    fields: [
      { key: "booking_fee_cents", label: "Booking fee", suffix: "¢" },
      { key: "minimum_fare_cents", label: "Minimum fare", suffix: "¢" },
      { key: "service_fee_bps", label: "Service fee", suffix: "bps (100 = 1%)" },
      { key: "tax_bps", label: "Tax", suffix: "bps (100 = 1%)" },
    ],
  },
];

function PricingTab() {
  const qc = useQueryClient();
  const fetchPricing = useServerFn(getPricingConfig);
  const savePricing = useServerFn(updatePricingConfig);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: () => fetchPricing(),
  });

  const [form, setForm] = useState<Partial<PricingRow>>({});
  useEffect(() => { if (data) setForm(data); }, [data]);

  const mut = useMutation({
    mutationFn: async (payload: Record<string, number>) => savePricing({ data: payload }),
    onSuccess: () => {
      toast.success("Pricing updated");
      qc.invalidateQueries({ queryKey: ["admin-pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return <div className="text-muted-foreground">Loading pricing…</div>;

  const submit = () => {
    const payload: Record<string, number> = {};
    for (const g of PRICING_GROUPS) for (const f of g.fields) {
      payload[f.key as string] = Number(form[f.key] ?? 0);
    }
    mut.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        All values in cents (¢). Service fee and tax in basis points (100 bps = 1%). Changes apply to new bookings immediately.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        {PRICING_GROUPS.map((g) => (
          <div key={g.title} className="rounded-2xl border border-border bg-surface p-5">
            <div className="text-display tracking-wider mb-4">{g.title.toUpperCase()}</div>
            <div className="space-y-3">
              {g.fields.map((f) => (
                <div key={f.key as string} className="grid grid-cols-3 items-center gap-3">
                  <Label className="col-span-1 text-sm">{f.label}</Label>
                  <div className="col-span-2 flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={String(form[f.key] ?? 0)}
                      onChange={(e) => setForm({ ...form, [f.key]: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{f.suffix}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={mut.isPending}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save pricing
        </Button>
        <Button variant="outline" onClick={() => data && setForm(data)} disabled={mut.isPending}>Reset</Button>
        {data.updated_at && <span className="text-xs text-muted-foreground">Last updated {new Date(data.updated_at).toLocaleString()}</span>}
      </div>
    </div>
  );
}

/* ============================== KYC TAB ============================== */

function KycTab() {
  const qc = useQueryClient();
  const list = useServerFn(adminListKyc);
  const update = useServerFn(adminUpdateKycStatus);
  const { data, isLoading } = useQuery({ queryKey: ["admin-kyc"], queryFn: () => list() });

  const setStatus = useMutation({
    mutationFn: (v: { userId: string; kycStatus: "verified" | "rejected" | "in_review"; bgStatus: "clear" | "rejected" | "consider"; reviewerNotes: string | null }) =>
      update({ data: v }),
    onSuccess: () => { toast.success("KYC updated"); qc.invalidateQueries({ queryKey: ["admin-kyc"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="grid place-items-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data?.length) return <p className="text-sm text-muted-foreground">No KYC submissions yet.</p>;

  return (
    <div className="rounded-md border border-border bg-surface divide-y divide-border">
      {data.map((r) => (
        <div key={r.user_id} className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 p-4">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground font-mono">{r.user_id}</div>
            <div className="text-sm">SSN •••-••-{r.ssn_last4} · Vendor {r.vendor} · Ref {r.vendor_kyc_id ?? "—"}</div>
            <div className="flex gap-2">
              <Badge variant="outline" className="uppercase">KYC: {r.kyc_status}</Badge>
              <Badge variant="outline" className="uppercase">BG: {r.bg_status}</Badge>
            </div>
            {r.reviewer_notes && <div className="text-xs text-amber-300">Note: {r.reviewer_notes}</div>}
          </div>
          <div className="flex flex-wrap gap-2 items-start">
            <Button size="sm" variant="default" disabled={setStatus.isPending}
              onClick={() => setStatus.mutate({ userId: r.user_id, kycStatus: "verified", bgStatus: "clear", reviewerNotes: null })}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive" disabled={setStatus.isPending}
              onClick={() => {
                const notes = window.prompt("Rejection reason?", "") ?? "";
                setStatus.mutate({ userId: r.user_id, kycStatus: "rejected", bgStatus: "rejected", reviewerNotes: notes || null });
              }}>
              <X className="h-4 w-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================== EMAILS ============================== */

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
  dlq: "bg-red-700/20 text-red-300 border-red-700/40",
  suppressed: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  bounced: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  complained: "bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30",
};

function EmailsTab() {
  const fetchLogs = useServerFn(getEmailLogs);
  const [hours, setHours] = useState(72);
  const [status, setStatus] = useState<"all" | "pending" | "sent" | "failed" | "dlq" | "suppressed" | "bounced" | "complained">("all");
  const [authOnly, setAuthOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [template, setTemplate] = useState<string>("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["admin-email-logs", hours, status, authOnly, search, template],
    queryFn: () =>
      fetchLogs({
        data: {
          hours,
          status,
          authOnly,
          search: search || undefined,
          template: template || undefined,
          limit: 200,
        },
      }),
    refetchInterval: 15000,
  });

  const counts = data?.counts ?? { total: 0, sent: 0, pending: 0, failed: 0, dlq: 0, suppressed: 0, other: 0 };
  const rows = data?.rows ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
        {[
          { label: "Total", value: counts.total },
          { label: "Sent", value: counts.sent },
          { label: "Pending", value: counts.pending },
          { label: "Failed", value: counts.failed },
          { label: "DLQ", value: counts.dlq },
          { label: "Suppressed", value: counts.suppressed },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</div>
            <div className="text-display text-2xl">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-1 text-xs">
          {[24, 72, 168, 720].map((h) => (
            <Button key={h} size="sm" variant={hours === h ? "default" : "outline"} onClick={() => setHours(h)}>
              {h === 24 ? "24h" : h === 72 ? "3d" : h === 168 ? "7d" : "30d"}
            </Button>
          ))}
        </div>
        <div className="h-6 w-px bg-border mx-1" />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          {["all", "sent", "pending", "failed", "dlq", "suppressed", "bounced", "complained"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">All templates</option>
          {(data?.templates ?? []).map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={authOnly} onCheckedChange={(v) => setAuthOnly(Boolean(v))} />
          Auth/verification only
        </label>
        <div className="flex-1 min-w-[200px] flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email, error, or message ID"
            className="h-9"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading email logs…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No emails match the current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-background/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Time</th>
                  <th className="text-left p-3">Template</th>
                  <th className="text-left p-3">Recipient</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border align-top">
                    <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-xs">{r.template_name}</td>
                    <td className="p-3 break-all">{r.recipient_email}</td>
                    <td className="p-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_COLORS[r.status ?? ""] ?? "bg-muted text-muted-foreground border-border"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">
                      {r.error_message ? (
                        <div className="text-red-400 max-w-md break-words">{r.error_message}</div>
                      ) : (
                        <div className="text-muted-foreground font-mono">{r.message_id?.slice(0, 12) ?? "—"}…</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Auto-refreshes every 15s. Shows queued, sent, and failed sends through the SMTP provider with the failure reason when available.
      </p>
    </div>
  );
}

