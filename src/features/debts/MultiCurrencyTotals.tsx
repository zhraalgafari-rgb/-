import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import type { CurrencyLite } from "@/lib/money/balances";
import { aggregateOwedOwePerCurrency, type MoneyTx } from "@/lib/money/balances";

interface Props {
  txs: MoneyTx[];
  currencies: CurrencyLite[];
}

/**
 * Per-currency compact chip rows. One row per currency, never mixed.
 * Designed for max density on small phone viewports.
 */
export function MultiCurrencyTotals({ txs, currencies }: Props) {
  const rows = aggregateOwedOwePerCurrency(txs, currencies);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="text-[9.5px] font-bold text-muted-foreground px-1 tracking-wide">الأرصدة حسب العملة</div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div
            key={r.currency.id}
            className="rounded-md bg-card border border-border shadow-sm grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5 px-2 py-1.5"
          >
            <div className="flex flex-col items-start min-w-0 pr-1 border-l border-border/60 pl-1.5">
              <span className="text-[11px] font-bold leading-tight truncate max-w-[80px]">{r.currency.name}</span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                صافي{" "}
                <span className={r.net >= 0 ? "text-success font-bold" : "text-danger font-bold"}>
                  {fmtMoney(Math.abs(r.net))}
                </span>
              </span>
            </div>
            <div className="bg-success/10 rounded-sm px-1.5 py-1 min-w-0">
              <div className="flex items-center gap-0.5 text-[9px] text-success font-semibold leading-none mb-0.5">
                <TrendingUp className="size-2.5" /> لك
              </div>
              <div className="text-[11.5px] font-black tabular-nums text-success leading-tight truncate">
                {fmtMoney(r.owed)} <span className="text-[9px]">{r.currency.symbol}</span>
              </div>
            </div>
            <div className="bg-danger/10 rounded-sm px-1.5 py-1 min-w-0">
              <div className="flex items-center gap-0.5 text-[9px] text-danger font-semibold leading-none mb-0.5">
                <TrendingDown className="size-2.5" /> عليك
              </div>
              <div className="text-[11.5px] font-black tabular-nums text-danger leading-tight truncate">
                {fmtMoney(r.owe)} <span className="text-[9px]">{r.currency.symbol}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
