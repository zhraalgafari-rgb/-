import { TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { fmtMoney } from "@/lib/format";

interface Props {
  owed: number;        // money owed TO user
  owe: number;         // money user OWES
  baseName: string;
  peopleCount: number;
  txCount: number;
  filter: "all" | "credit" | "debit";
  onFilterChange: (f: "all" | "credit" | "debit") => void;
}

export function DebtsHeader({ owed, owe, baseName, peopleCount, txCount, filter, onFilterChange }: Props) {
  const net = owed - owe;
  return (
    <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-4 shadow-elevated">
      <div className="flex items-center justify-between text-xs opacity-80 mb-2">
        <span>إجمالي الأرصدة ({baseName})</span>
        <Link to="/app/insights" className="flex items-center gap-1 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full hover:bg-white/25 transition-colors">
          <Sparkles className="size-3" /> ذكاء
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onFilterChange(filter === "credit" ? "all" : "credit")}
          className={`bg-white/10 backdrop-blur rounded-xl p-3 text-right hover:bg-white/15 transition-all active:scale-[0.98] ${filter === "credit" ? "ring-2 ring-white/40" : ""}`}
        >
          <div className="flex items-center gap-1 text-xs opacity-90 mb-1"><TrendingUp className="size-3.5" /> لك</div>
          <div className="font-black text-lg tabular-nums">{fmtMoney(owed)}</div>
        </button>
        <button
          onClick={() => onFilterChange(filter === "debit" ? "all" : "debit")}
          className={`bg-white/10 backdrop-blur rounded-xl p-3 text-right hover:bg-white/15 transition-all active:scale-[0.98] ${filter === "debit" ? "ring-2 ring-white/40" : ""}`}
        >
          <div className="flex items-center gap-1 text-xs opacity-90 mb-1"><TrendingDown className="size-3.5" /> عليك</div>
          <div className="font-black text-lg tabular-nums">{fmtMoney(owe)}</div>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="text-[11px] opacity-80 text-center">
          الصافي: <span className="tabular-nums font-semibold">{fmtMoney(net)}</span>
        </div>
        <div className="text-[11px] opacity-80 text-center">{peopleCount} شخص · {txCount} معاملة</div>
      </div>
    </div>
  );
}
