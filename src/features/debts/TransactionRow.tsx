import { TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react";
import { fmtMoney, fmtDate, fmtTime } from "@/lib/format";

interface Tx {
  id: string;
  amount: number;
  direction: string;
  currency_id: string;
  transaction_date: string;
  details: string | null;
}
interface Currency { id: string; name: string }

interface Props {
  tx: Tx;
  currency?: Currency;
  runningBalance: number;
  onEdit: () => void;
  onDelete: () => void;
}

export function TransactionRow({ tx, currency, runningBalance, onEdit, onDelete }: Props) {
  const credit = tx.direction === "credit";
  return (
    <div className="bg-card border rounded-2xl p-3 shadow-card animate-in fade-in slide-in-from-bottom-1">
      <div className="flex items-start gap-3">
        <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${credit ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {credit ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className={`font-bold tabular-nums ${credit ? "text-success" : "text-danger"}`}>
              {credit ? "+" : "-"}{fmtMoney(Number(tx.amount))}
              <span className="text-xs text-muted-foreground font-normal ms-1">{currency?.name}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {fmtDate(tx.transaction_date)} · {fmtTime(tx.transaction_date)}
            </div>
          </div>
          {tx.details && <div className="text-sm text-muted-foreground mt-0.5 truncate">{tx.details}</div>}
          <div className="flex items-center justify-between mt-1.5">
            <div className="text-[11px] text-muted-foreground">
              الرصيد: <span className="tabular-nums">{fmtMoney(Math.abs(runningBalance))}</span> {runningBalance >= 0 ? "له" : "عليه"}
            </div>
            <div className="flex gap-1">
              <button onClick={onEdit} aria-label="تعديل" className="text-muted-foreground hover:text-primary p-1">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={onDelete} aria-label="حذف" className="text-muted-foreground hover:text-danger p-1">
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
