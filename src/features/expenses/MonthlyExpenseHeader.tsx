import { fmtMoney } from "@/lib/format";
import { MonthSwitcher } from "@/components/common/MonthSwitcher";

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  total: number;
  budget: number;
  baseName: string;
}

export function MonthlyExpenseHeader({ month, onMonthChange, total, budget, baseName }: Props) {
  const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
  const over = budget > 0 && total > budget;
  return (
    <div className="bg-gradient-primary text-primary-foreground rounded-xl p-2.5 shadow-elevated">
      <MonthSwitcher month={month} onChange={onMonthChange} label="إجمالي مصاريف" />
      <div className="text-center mt-0.5">
        <div className="font-black text-[20px] tabular-nums leading-tight">{fmtMoney(total)}</div>
        <div className="text-[9px] opacity-80 mt-0.5">{baseName}</div>
      </div>
      {budget > 0 && (
        <div className="mt-1.5 bg-white/10 rounded-lg p-1.5">
          <div className="flex justify-between text-[10px] mb-1">
            <span>الميزانية: {fmtMoney(budget)}</span>
            <span className={over ? "font-bold" : ""}>{Math.round(pct)}%</span>
          </div>
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${over ? "bg-red-300" : pct > 80 ? "bg-yellow-200" : "bg-white"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {over && <div className="text-[9px] mt-1 opacity-95">⚠️ تجاوزت الميزانية بـ {fmtMoney(total - budget)}</div>}
          {!over && pct > 80 && <div className="text-[9px] mt-1 opacity-95">⚡ اقتربت من حد الميزانية</div>}
        </div>
      )}
    </div>
  );
}
