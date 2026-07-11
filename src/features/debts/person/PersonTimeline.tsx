import { useMemo, useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { TransactionTable } from "@/features/debts/TransactionTable";
import { fmtMonthAr } from "@/lib/format";

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string; details: string | null; due_date: string | null; is_paid: boolean; allocations?: { allocated_amount: number }[] }

interface Props {
  txs: Tx[];
  currencies: Currency[];
  running: Record<string, number>;
  onEdit: (t: Tx) => void;
  onDelete: (id: string) => void;
  onPay: (t: Tx) => void;
}

export function PersonTimeline({ txs, currencies, running, onEdit, onDelete, onPay }: Props) {
  const [visibleCount, setVisibleCount] = useState(30);
  const visibleTxs = useMemo(() => txs.slice(0, visibleCount), [txs, visibleCount]);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount((prev) => Math.min(prev + 30, txs.length));
      }
    }, { rootMargin: "400px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [txs.length]);

  const grouped = useMemo(() => {
    const g = new Map<string, Tx[]>();
    for (const t of visibleTxs) {
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const a = g.get(key) ?? [];
      a.push(t); g.set(key, a);
    }
    return Array.from(g.entries()).map(([key, items]) => {
      const [y, m] = key.split("-").map(Number);
      return { key, label: fmtMonthAr(new Date(y, m, 1)), items };
    });
  }, [visibleTxs]);

  return (
    <div className="space-y-3">
      {grouped.map((g) => (
        <div key={g.key} className="space-y-1.5">
          <div className="flex items-center gap-2 px-1">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-bold text-primary bg-primary/10 ring-1 ring-primary/20 px-2 py-0.5 rounded-full">{g.label}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <TransactionTable
            txs={g.items}
            currencies={currencies}
            running={running}
            onEdit={onEdit}
            onDelete={onDelete}
            onPay={onPay}
          />
        </div>
      ))}
      
      {visibleTxs.length > 0 && visibleTxs.length < txs.length && (
        <div ref={loadMoreRef} className="h-20 flex items-center justify-center text-muted-foreground pb-20">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
