import { useMemo } from "react";
import { TransactionRow } from "@/features/debts/TransactionRow";
import { fmtMonthAr } from "@/lib/format";

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string; details: string | null; due_date: string | null; is_paid: boolean }

interface Props {
  txs: Tx[];
  currencies: Currency[];
  running: Record<string, number>;
  onEdit: (t: Tx) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (t: Tx) => void;
}

export function PersonTimeline({ txs, currencies, running, onEdit, onDelete, onTogglePaid }: Props) {
  const grouped = useMemo(() => {
    const g = new Map<string, Tx[]>();
    for (const t of txs) {
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const a = g.get(key) ?? [];
      a.push(t); g.set(key, a);
    }
    return Array.from(g.entries()).map(([key, items]) => {
      const [y, m] = key.split("-").map(Number);
      return { key, label: fmtMonthAr(new Date(y, m, 1)), items };
    });
  }, [txs]);

  return (
    <div className="space-y-4">
      {grouped.map((g) => (
        <div key={g.key} className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{g.label}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {g.items.map((t) => (
            <TransactionRow
              key={t.id}
              tx={t}
              currency={currencies.find((c) => c.id === t.currency_id)}
              runningBalance={running[t.id] ?? 0}
              onEdit={() => onEdit(t)}
              onDelete={() => onDelete(t.id)}
              onTogglePaid={() => onTogglePaid(t)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
