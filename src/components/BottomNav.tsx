import { Link, useLocation } from "@tanstack/react-router";
import { Home, Wallet, BarChart3, Settings } from "lucide-react";

const items = [
  { to: "/app", label: "الديون", icon: Home, match: (p: string) => p === "/app" || p === "/app/" || p.startsWith("/app/person") },
  { to: "/app/expenses", label: "المصاريف", icon: Wallet, match: (p: string) => p.startsWith("/app/expenses") || p.startsWith("/app/budgets") },
  { to: "/app/reports", label: "التقارير", icon: BarChart3, match: (p: string) => p.startsWith("/app/reports") },
  { to: "/app/settings", label: "الإعدادات", icon: Settings, match: (p: string) => p.startsWith("/app/settings") || p.startsWith("/app/currencies") || p.startsWith("/app/categories") || p.startsWith("/app/reminders") },
] as const;

export function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto grid grid-cols-4 h-16">
        {items.map((it) => {
          const active = it.match(loc.pathname);
          const Icon = it.icon;
          return (
            <Link
              key={it.to}
              to={it.to}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <div className={`size-9 rounded-xl flex items-center justify-center transition-all ${active ? "bg-gradient-primary text-primary-foreground shadow-glow" : ""}`}>
                <Icon className="size-[18px]" />
              </div>
              {it.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
