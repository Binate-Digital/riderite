import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    if (!user) return;
    let active = true;

    supabase
      .from("notifications")
      .select("id,type,title,body,link,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => { if (active && data) setItems(data as Notif[]); });

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev].slice(0, 20));
          toast(n.title, { description: n.body ?? undefined });
        },
      )
      .subscribe();

    return () => { active = false; supabase.removeChannel(ch); };
  }, [user]);

  const unread = items.filter((i) => !i.read_at).length;

  async function markAllRead() {
    if (!user || unread === 0) return;
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    setItems((prev) => prev.map((i) => (i.read_at ? i : { ...i, read_at: new Date().toISOString() })));
    await supabase.rpc("mark_notifications_read", { _ids: ids });
  }

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead(); }}
        aria-label="Notifications"
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-accent transition"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-lg border border-border bg-surface shadow-xl z-50">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold">Notifications</span>
              {items.length > 0 && (
                <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-primary">
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const content = (
                    <div className={`px-4 py-3 ${!n.read_at ? "bg-accent/30" : ""}`}>
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-3">{n.body}</p>}
                      <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  );
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link to={n.link} onClick={() => setOpen(false)} className="block hover:bg-accent/50">
                          {content}
                        </Link>
                      ) : content}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
