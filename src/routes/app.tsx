import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Loader2, Bell, Search, Moon, Sun } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { ModuleTabs } from "@/components/common/ModuleTabs";
import { BadgeCount } from "@/components/common/BadgeCount";
import { GlobalSearchDialog } from "@/components/GlobalSearchDialog";
import { useTheme } from "@/lib/theme";
import { fetchPending, pollAndNotify } from "@/lib/notifications";
import { maybeRunAutoBackup } from "@/lib/backup";
import { syncRemindersFromTransactions } from "@/lib/reminders";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, set: setTheme } = useTheme();
  const isDark = theme === "dark" || (theme === "system" && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      await syncRemindersFromTransactions(user.id).catch(() => 0);
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
    <div className="min-h-screen bg-background pb-16">
      <header className="bg-gradient-hero text-white sticky top-0 z-30 shadow-elevated">
        <div className="max-w-3xl mx-auto px-2.5 h-10 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-1.5 font-black text-[13px]">
            <div className="size-6 rounded-md bg-white/20 backdrop-blur flex items-center justify-center ring-1 ring-white/15">
              <Wallet className="size-3" />
            </div>
            دفترك
          </Link>
          <div className="flex items-center gap-1">
            <Link to="/app/search" className="p-1 rounded-md hover:bg-white/10 transition-colors" aria-label="بحث">
              <Search className="size-3.5" />
            </Link>
            <Link to="/app/notifications" className="relative p-1 rounded-md hover:bg-white/10 transition-colors" aria-label="الإشعارات">
              <Bell className="size-3.5" />
              {pending > 0 && (
                <span className="absolute top-0 right-0">
                  <BadgeCount count={pending} tone="danger" />
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-2.5 py-2.5">
        <ModuleTabs />
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
