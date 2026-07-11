import { Link, useLocation } from "@tanstack/react-router";
import { Users, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery } from "@tanstack/react-query";

export function ModuleTabs() {
  const loc = useLocation();
  const { user } = useAuth();

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

  const { data } = useQuery({
    queryKey: ["moduleTabsCounts", user?.id],
    queryFn: async () => {
      const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
      const [p, e] = await Promise.all([
        supabase.from("people").select("id", { count: "exact", head: true }).eq("is_archived", false),
        supabase.from("expenses").select("id", { count: "exact", head: true }).gte("expense_date", start.toISOString()),
      ]);
      return { people: p.count ?? 0, expenses: e.count ?? 0 };
    },
    enabled: !!user,
  });

  const counts = data ?? { people: 0, expenses: 0 };

  if (!isDebts && !isExpenses) return null;

  const base = "flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-bold rounded-md transition-all active:scale-[0.98]";
  return (
    <div className="bg-secondary/70 p-0.5 rounded-lg flex items-center gap-0.5 mb-2.5 sticky top-10 z-20 backdrop-blur shadow-card border border-border/60" role="tablist">
      <Link
        to="/app"
        role="tab"
        aria-selected={isDebts}
        className={`${base} ${isDebts ? "bg-card text-primary shadow-card" : "text-muted-foreground"}`}
      >
        <Users className="size-3.5" />
        <span>الديون</span>
        {counts.people > 0 && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full tabular-nums font-black ${isDebts ? "bg-primary/15 text-primary" : "bg-card/80"}`}>
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
        <Wallet className="size-3.5" />
        <span>المصاريف</span>
        {counts.expenses > 0 && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full tabular-nums font-black ${isExpenses ? "bg-primary/15 text-primary" : "bg-card/80"}`}>
            {counts.expenses}
          </span>
        )}
      </Link>
    </div>
  );
}
