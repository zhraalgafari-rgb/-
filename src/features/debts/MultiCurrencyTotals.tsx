import { TrendingUp, TrendingDown } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import type { CurrencyLite } from "@/lib/money/balances";
import { aggregateOwedOwePerCurrency, type MoneyTx } from "@/lib/money/balances";

interface Props {
  txs: MoneyTx[];
  currencies: CurrencyLite[];
}

/**
 * Per-currency totals row. Each currency = independent card.
 * Currencies NEVER mix here.
 */
export function MultiCurrencyTotals({ txs, currencies }: Props) {
  const rows = aggregateOwedOwePerCurrency(txs, currencies);
  if (rows.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-bold text-muted-foreground px-1">الأرصدة حسب العملة</div>
      <div className="grid grid-cols-1 gap-1.5">
        {rows.map((r) => (
          <div
            key={r.currency.id}
            className="rounded-lg p-2 bg-card border-2 border-border shadow-sm"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold">{r.currency.name}</span>
                {r.currency.is_base && (
                  <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[9px] font-semibold">
                    أساسية
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                صافي:{" "}
                <span className={r.net >= 0 ? "text-success font-bold" : "text-danger font-bold"}>
                  {fmtMoney(Math.abs(r.net))} {r.currency.symbol}
                </span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-success/10 rounded-md p-1.5">
                <div className="flex items-center gap-1 text-[9px] text-success font-semibold mb-0.5">
                  <TrendingUp className="size-2.5" /> لك
                </div>
                <div className="text-[13px] font-black tabular-nums text-success leading-tight">
                  {fmtMoney(r.owed)} <span className="text-[10px]">{r.currency.symbol}</span>
                </div>
              </div>
              <div className="bg-danger/10 rounded-md p-1.5">
                <div className="flex items-center gap-1 text-[9px] text-danger font-semibold mb-0.5">
                  <TrendingDown className="size-2.5" /> عليك
                </div>
                <div className="text-[13px] font-black tabular-nums text-danger leading-tight">
                  {fmtMoney(r.owe)} <span className="text-[10px]">{r.currency.symbol}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
