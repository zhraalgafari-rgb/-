import { createFileRoute, Outlet, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Wallet, Loader2, Bell } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="bg-gradient-hero text-white sticky top-0 z-30 shadow-elevated">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 font-bold">
            <div className="size-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            دفترك
          </Link>
          <Link to="/app/reminders" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="التذكيرات">
            <Bell className="size-5" />
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
