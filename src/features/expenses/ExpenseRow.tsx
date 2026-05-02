import { Pencil, Trash2 } from "lucide-react";
import { IconByName } from "@/components/IconByName";
import { fmtMoney, fmtDate } from "@/lib/format";

interface Expense {
  id: string;
  amount: number;
  category_id: string | null;
  currency_id: string;
  note: string | null;
  expense_date: string;
}
interface Category { id: string; name: string; icon: string; color: string }
interface Currency { id: string; name: string }

interface Props {
  expense: Expense;
  category?: Category;
  currency?: Currency;
  onEdit: () => void;
  onDelete: () => void;
}

export function ExpenseRow({ expense, category, currency, onEdit, onDelete }: Props) {
  const color = category?.color ?? "#94a3b8";
  return (
    <div className="bg-card border rounded-2xl p-3 shadow-card flex items-center gap-3 animate-in fade-in slide-in-from-bottom-1">
      <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: color + "22", color }}>
        <IconByName name={category?.icon ?? "Tag"} className="size-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{category?.name ?? "غير مصنّف"}</div>
        {expense.note && <div className="text-xs text-muted-foreground truncate">{expense.note}</div>}
        <div className="text-[10px] text-muted-foreground">{fmtDate(expense.expense_date)}</div>
      </div>
      <div className="text-left shrink-0">
        <div className="font-bold text-danger tabular-nums">-{fmtMoney(Number(expense.amount))}</div>
        <div className="text-[10px] text-muted-foreground">{currency?.name}</div>
      </div>
      <div className="flex flex-col">
        <button onClick={onEdit} aria-label="تعديل" className="p-1 text-muted-foreground hover:text-primary">
          <Pencil className="size-3.5" />
        </button>
        <button onClick={onDelete} aria-label="حذف" className="p-1 text-muted-foreground hover:text-danger">
          <Trash2 className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
