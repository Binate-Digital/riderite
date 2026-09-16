import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

interface TripRow {
  id: string;
  status: string;
  rider_id: string;
  driver_id: string | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  pickup_address: string;
  destination_address: string;
}

/**
 * Listens for trip status changes on any trip the current user is part of
 * (as rider OR driver) and surfaces a toast the moment it flips to "cancelled".
 * The party who initiated the cancel does NOT get the alert — only the other side.
 */
export function useTripCancellationAlerts() {
  const { user } = useAuth();
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const handle = (row: TripRow, role: "rider" | "driver") => {
      if (row.status !== "cancelled") return;
      if (announced.current.has(row.id)) return;
      if (row.cancelled_by === user.id) return; // don't notify the canceller
      announced.current.add(row.id);

      const route = `${row.pickup_address} → ${row.destination_address}`;
      toast.error(
        role === "driver" ? "Rider cancelled the trip" : "Trip was cancelled",
        {
          description: row.cancellation_reason
            ? `Reason: ${row.cancellation_reason}\n${route}`
            : route,
          duration: 8000,
        },
      );
    };

    const riderCh = supabase
      .channel(`alerts-rider:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `rider_id=eq.${user.id}` },
        (p) => handle(p.new as TripRow, "rider"),
      )
      .subscribe();

    const driverCh = supabase
      .channel(`alerts-driver:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `driver_id=eq.${user.id}` },
        (p) => handle(p.new as TripRow, "driver"),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(riderCh);
      supabase.removeChannel(driverCh);
    };
  }, [user]);
}
