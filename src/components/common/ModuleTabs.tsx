import { Link, useLocation } from "@tanstack/react-router";
import { Users, Wallet } from "lucide-react";

/** Top-level tabs separating the two modules: Debts vs Expenses. */
export function ModuleTabs() {
  const loc = useLocation();
  const isExpenses =
    loc.pathname.startsWith("/app/expenses") ||
    loc.pathname.startsWith("/app/budgets") ||
    loc.pathname.startsWith("/app/categories");
  const isDebts = !isExpenses && (
    loc.pathname === "/app" ||
    loc.pathname === "/app/" ||
    loc.pathname.startsWith("/app/person") ||
    loc.pathname.startsWith("/app/archive")
  );

  // Hide on shared/utility pages (insights, reports, settings, reminders, recurring)
  if (!isDebts && !isExpenses) return null;

  const base = "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-xl transition-all";
  return (
    <div className="bg-secondary/60 p-1 rounded-2xl flex items-center gap-1 mb-4 sticky top-14 z-20 backdrop-blur shadow-card">
      <Link
        to="/app"
        className={`${base} ${isDebts ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}
      >
        <Users className="size-4" />
        الديون
      </Link>
      <Link
        to="/app/expenses"
        className={`${base} ${isExpenses ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}
      >
        <Wallet className="size-4" />
        المصاريف
      </Link>
    </div>
  );
}
