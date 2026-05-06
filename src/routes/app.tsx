import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Loader2, Bell } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { BadgeCount } from "@/components/common/BadgeCount";
import { fetchPending, pollAndNotify } from "@/lib/notifications";
import { maybeRunAutoBackup } from "@/lib/backup";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const items = await fetchPending(user.id);
      if (!cancelled) setPending(items.length);
      const { data } = await supabase.from("profiles").select("backup_frequency").eq("user_id", user.id).maybeSingle();
      const freq = (data?.backup_frequency ?? "off") as "off" | "daily" | "weekly" | "monthly";
      maybeRunAutoBackup(user.id, freq);
      pollAndNotify(user.id);
    })();
    const t = setInterval(async () => {
      const items = await fetchPending(user.id);
      if (!cancelled) setPending(items.length);
    }, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-hero text-white sticky top-0 z-30 shadow-elevated">
        <div className="max-w-3xl mx-auto px-3 h-12 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 font-black text-sm">
            <div className="size-7 rounded-lg bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/15">
              <Wallet className="size-3.5" />
            </div>
            دفترك
          </Link>
          <Link to="/app/notifications" className="relative p-1.5 rounded-lg hover:bg-white/10 transition-colors" aria-label="الإشعارات">
            <Bell className="size-4" />
            {pending > 0 && (
              <span className="absolute top-0.5 right-0.5">
                <BadgeCount count={pending} tone="danger" />
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 py-3">
        <ModuleTabs />
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
