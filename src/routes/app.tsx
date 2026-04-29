import { createFileRoute, Outlet, useNavigate, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Wallet, Home, Coins, LogOut, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

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

  const isHome = loc.pathname === "/app" || loc.pathname === "/app/";

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-gradient-hero text-white sticky top-0 z-30 shadow-elevated">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/app" className="flex items-center gap-2 font-bold">
            <div className="size-8 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <Wallet className="size-4" />
            </div>
            دفترك
          </Link>
          <button onClick={() => signOut()} className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="خروج">
            <LogOut className="size-5" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-4">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t shadow-elevated z-30">
        <div className="max-w-3xl mx-auto grid grid-cols-2 h-16">
          <Link to="/app" className={`flex flex-col items-center justify-center gap-1 text-xs transition-colors ${isHome ? "text-primary" : "text-muted-foreground"}`}>
            <Home className="size-5" /> الرئيسية
          </Link>
          <Link to="/app/currencies" className={`flex flex-col items-center justify-center gap-1 text-xs transition-colors ${loc.pathname.includes("currencies") ? "text-primary" : "text-muted-foreground"}`}>
            <Coins className="size-5" /> العملات
          </Link>
        </div>
      </nav>
    </div>
  );
}
