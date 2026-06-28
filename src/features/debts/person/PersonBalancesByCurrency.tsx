import { fmtMoney } from "@/lib/format";
import type { PerCurrencyBalance, MoneyTx } from "@/lib/money/balances";
import { BalanceCard, type BalanceCardData } from "@/components/common/BalanceCard";
import { User, Phone } from "lucide-react";

interface Props {
  name: string;
  phone: string | null;
  balances: PerCurrencyBalance[];
  totalTxCount: number;
  txs?: MoneyTx[];
}

/**
 * Header + 2-per-row interactive balance cards.
 * Each card expands to show owed / owe / opening / count.
 * Currencies stay strictly separate.
 */
export function PersonBalancesByCurrency({ name, phone, balances, totalTxCount, txs = [] }: Props) {
  // Split owed/owe per currency from raw txs (kept here so the card stays generic)
  const breakdown = new Map<string, { owed: number; owe: number }>();
  for (const t of txs) {
    const slot = breakdown.get(t.currency_id) ?? { owed: 0, owe: 0 };
    if (t.direction === "credit") slot.owed += Number(t.amount);
    else slot.owe += Number(t.amount);
    breakdown.set(t.currency_id, slot);
  }

  if (balances.length === 0) {
    return (
      <div className="rounded-xl p-3 bg-secondary text-foreground shadow-sm border border-border">
        <div className="text-[11px] font-bold">{name}</div>
        <div className="text-[10px] text-muted-foreground mt-1">لا توجد معاملات بعد</div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Identity strip */}
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-card border border-border shadow-sm">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="size-6 rounded-full bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <User className="size-3.5" />
          </div>
          <span className="text-[12px] font-bold truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {phone && (
            <span className="flex items-center gap-0.5" dir="ltr">
              <Phone className="size-2.5" />
              {phone}
            </span>
          )}
          <span className="font-bold text-foreground tabular-nums">{totalTxCount} معاملة</span>
        </div>
      </div>

      {/* 2-per-row interactive balance cards */}
      <div className="grid grid-cols-2 gap-1.5">
        {balances.map((b) => {
          const bd = breakdown.get(b.currency.id) ?? { owed: 0, owe: 0 };
          const data: BalanceCardData = {
            currency: b.currency,
            owed: bd.owed,
            owe: bd.owe,
            opening: b.opening,
            txCount: b.txCount,
          };
          return <BalanceCard key={b.currency.id} data={data} defaultOpen={b.currency.is_base} />;
        })}
      </div>
    </div>
  );
}

// Re-export for backward compat where fmtMoney was used elsewhere
export { fmtMoney };
