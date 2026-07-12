import { useState, useDeferredValue, useMemo } from "react";
import { type PersonBalance } from "@/features/debts/PersonRow";
import { type Person } from "./useDashboardData";

export type Filter = "all" | "credit" | "debit";
export type Sort = "active" | "name" | "recent";
export type ViewMode = "cards" | "table";

export function useDashboardFilter(
  people: Person[],
  personBalances: Map<string, PersonBalance>
) {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("active");

  const filtered = useMemo(() => {
    const list = people.filter((p) => {
      if (deferredQ && !p.name.toLowerCase().includes(deferredQ.toLowerCase())) return false;
      const b = personBalances.get(p.id);
      if (filter === "credit") return (b?.net ?? 0) > 0.001;
      if (filter === "debit") return (b?.net ?? 0) < -0.001;
      return true;
    });
    
    return list.sort((a, b) => {
      const ba = personBalances.get(a.id);
      const bb = personBalances.get(b.id);
      if (sort === "name") return a.name.localeCompare(b.name, "ar");
      if (sort === "recent") return (bb?.lastDate ?? 0) - (ba?.lastDate ?? 0);
      
      // active: most-owed/owing first
      const aActive = Math.abs(ba?.net ?? 0);
      const bActive = Math.abs(bb?.net ?? 0);
      return bActive - aActive;
    });
  }, [people, deferredQ, filter, sort, personBalances]);

  return {
    q, setQ,
    deferredQ,
    filter, setFilter,
    sort, setSort,
    filtered
  };
}
