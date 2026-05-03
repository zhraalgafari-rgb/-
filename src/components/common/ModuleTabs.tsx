import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function ModuleTabs() {
  const loc = useLocation();
  const { user } = useAuth();
  const [counts, setCounts] = useState({ people: 0, expenses: 0 });

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

  useEffect(() => {
    if (!user) return;
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    Promise.all([
      supabase.from("people").select("id", { count: "exact", head: true }).eq("is_archived", false),
      supabase.from("expenses").select("id", { count: "exact", head: true }).gte("expense_date", start.toISOString()),
    ]).then(([p, e]) => setCounts({ people: p.count ?? 0, expenses: e.count ?? 0 }));
  }, [user, loc.pathname]);

  if (!isDebts && !isExpenses) return null;

  const base = "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-bold rounded-xl transition-all active:scale-[0.98]";
  return (
    <div className="bg-secondary/60 p-1 rounded-2xl flex items-center gap-1 mb-4 sticky top-14 z-20 backdrop-blur shadow-card" role="tablist">
      <Link
        to="/app"
        role="tab"
        aria-selected={isDebts}
        className={`${base} ${isDebts ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}
      >
        <Users className="size-4" />
        <span>الديون</span>
        {counts.people > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${isDebts ? "bg-primary/15" : "bg-card/80"}`}>
            {counts.people}
          </span>
        )}
      </Link>
      <Link
        to="/app/expenses"
        role="tab"
        aria-selected={isExpenses}
        className={`${base} ${isExpenses ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}
      >
        <Wallet className="size-4" />
        <span>المصاريف</span>
        {counts.expenses > 0 && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${isExpenses ? "bg-primary/15" : "bg-card/80"}`}>
            {counts.expenses}
          </span>
        )}
      </Link>
    </div>
  );
}
