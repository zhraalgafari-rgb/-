interface Person { 
  id: string; 
  name: string; 
  phone: string | null; 
  credit_limit: number | null 
}

export interface Bucket {
  person: Person;
  net: number;
  currency: string;
  daysOverdue: number;
  oldestDue: string | null;
  txCount: number;
  severity: "ok" | "soon" | "late" | "critical";
}

export function severityFor(days: number, amount: number, limit: number | null): Bucket["severity"] {
  if (days >= 30 || (limit && amount > limit * 1.2)) return "critical";
  if (days >= 7) return "late";
  if (days >= 0) return "soon";
  return "ok";
}

export const severityMeta: Record<Bucket["severity"], { label: string; cls: string; ring: string }> = {
  ok: { label: "ضمن المهلة", cls: "bg-success-soft text-success", ring: "ring-success/30" },
  soon: { label: "قريباً", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", ring: "ring-amber-400/40" },
  late: { label: "متأخر", cls: "bg-danger-soft text-danger", ring: "ring-danger/30" },
  critical: { label: "حرج", cls: "bg-danger text-danger-foreground", ring: "ring-danger/50" },
};

export function buildBuckets(txs: any[], peopleMap: Map<string, Person>, currencyMap: Map<string, any>): Bucket[] {
  const grouped = new Map<string, { person: Person; net: number; currency: string; oldestDue: string | null; daysOverdue: number; count: number }>();
  const today = Date.now();
  
  (txs ?? []).forEach((t: any) => {
    const person = peopleMap.get(t.person_id);
    if (!person) return;
    const currencyName = currencyMap.get(t.currency_id)?.name ?? t.currency_id;
    const key = `${t.person_id}|${t.currency_id}`;
    const sign = t.direction === "credit" ? 1 : -1; // credit = he owes me
    const entry = grouped.get(key) ?? { person, net: 0, currency: currencyName, oldestDue: null, daysOverdue: -9999, count: 0 };
    
    entry.net += sign * Number(t.amount);
    entry.count += 1;
    
    if (t.due_date) {
      const d = new Date(t.due_date).getTime();
      const days = Math.floor((today - d) / 86400000);
      if (days > entry.daysOverdue) {
        entry.daysOverdue = days;
        entry.oldestDue = t.due_date;
      }
    }
    grouped.set(key, entry);
  });

  const list: Bucket[] = [];
  grouped.forEach((g) => {
    if (g.net <= 0) return; // only show debtors (people who owe the user)
    list.push({
      person: g.person,
      net: g.net,
      currency: g.currency,
      daysOverdue: g.daysOverdue,
      oldestDue: g.oldestDue,
      txCount: g.count,
      severity: severityFor(g.daysOverdue, g.net, g.person.credit_limit),
    });
  });

  return list.sort((a, b) => b.net - a.net).sort((a, b) => b.daysOverdue - a.daysOverdue);
}
