import { fmtMoney } from "@/lib/format";
import type { PerCurrencyBalance } from "@/lib/money/balances";

interface Props {
  name: string;
  phone: string | null;
  balances: PerCurrencyBalance[];
  totalTxCount: number;
}

/**
 * One CARD per currency — balances never mix.
 * SAR is shown first (base), then secondary currencies.
 */
export function PersonBalancesByCurrency({ name, phone, balances, totalTxCount }: Props) {
  if (balances.length === 0) {
    return (
      <div className="rounded-xl p-3 bg-secondary text-foreground shadow-elevated">
        <div className="text-[11px] opacity-80">{name}</div>
        <div className="text-[10px] opacity-60 mt-1">لا توجد معاملات بعد</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="text-[12px] font-bold">{name}</div>
        {phone && <div className="text-[10px] text-muted-foreground" dir="ltr">{phone}</div>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {balances.map((b) => {
          const isCredit = b.balance >= 0;
          return (
            <div
              key={b.currency.id}
              className={`rounded-xl p-3 shadow-elevated text-white ${
                isCredit ? "bg-gradient-success" : "bg-gradient-danger"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] opacity-90">
                <span>{b.currency.name}</span>
                {b.currency.is_base && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-[9px]">أساسية</span>
                )}
              </div>
              <div className="mt-1">
                <div className="text-[10px] opacity-90">{isCredit ? "له عندك" : "عليه"}</div>
                <div className="text-2xl font-black tabular-nums leading-tight">
                  {fmtMoney(Math.abs(b.balance))}{" "}
                  <span className="text-[12px] font-bold opacity-90">{b.currency.symbol}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-1 text-[10px] opacity-85">
                <span>{b.txCount} معاملة</span>
                {b.opening !== 0 && <span>افتتاحي: {fmtMoney(Math.abs(b.opening))}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground text-center">
        إجمالي المعاملات: {totalTxCount}
      </div>
    </div>
  );
}
