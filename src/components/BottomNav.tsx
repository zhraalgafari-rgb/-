import { Link, useLocation } from "@tanstack/react-router";
import { Users, Wallet, BarChart3, Settings, Tags, PieChart, Archive, Coins } from "lucide-react";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Users;
  match: (p: string) => boolean;
}

// Debts module nav (when current path is in debts area)
const debtsItems: NavItem[] = [
  { to: "/app", label: "الديون", icon: Users, match: (p) => p === "/app" || p === "/app/" },
  { to: "/app/archive", label: "الأرشيف", icon: Archive, match: (p) => p.startsWith("/app/archive") },
  { to: "/app/reports", label: "التقارير", icon: BarChart3, match: (p) => p.startsWith("/app/reports") },
  { to: "/app/settings", label: "الإعدادات", icon: Settings, match: (p) => p.startsWith("/app/settings") || p.startsWith("/app/currencies") || p.startsWith("/app/reminders") || p.startsWith("/app/recurring") },
];

// Expenses module nav
const expensesItems: NavItem[] = [
  { to: "/app/expenses", label: "المصاريف", icon: Wallet, match: (p) => p === "/app/expenses" || p === "/app/expenses/" },
  { to: "/app/budgets", label: "الميزانيات", icon: Coins, match: (p) => p.startsWith("/app/budgets") },
  { to: "/app/categories", label: "التصنيفات", icon: Tags, match: (p) => p.startsWith("/app/categories") },
  { to: "/app/insights", label: "تحليلات", icon: PieChart, match: (p) => p.startsWith("/app/insights") },
];

export function BottomNav() {
  const loc = useLocation();
  const path = loc.pathname;
  const isExpensesArea =
    path === "/app/expenses" || path.startsWith("/app/expenses/") ||
    path.startsWith("/app/budgets") || path.startsWith("/app/categories") ||
    path.startsWith("/app/insights");
  const items = isExpensesArea ? expensesItems : debtsItems;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-card/95 backdrop-blur border-t z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto grid grid-cols-4 h-16">
        {items.map((it) => {
          const active = it.match(path);
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
