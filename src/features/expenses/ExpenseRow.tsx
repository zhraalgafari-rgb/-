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
    <div className="bg-card border rounded-xl p-2 shadow-card flex items-center gap-2 animate-in fade-in slide-in-from-bottom-1">
      <div
        className="size-8 rounded-lg flex items-center justify-center shrink-0 ring-1"
        style={{ background: color + "22", color, boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        <IconByName name={category?.icon ?? "Tag"} className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[13px] truncate leading-tight">{category?.name ?? "غير مصنّف"}</div>
        {expense.note && <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">{expense.note}</div>}
        <div className="text-[9px] text-muted-foreground mt-0.5">{fmtDate(expense.expense_date)}</div>
      </div>
      <div className="text-left shrink-0">
        <div className="font-bold text-danger tabular-nums text-[13px] leading-tight">-{fmtMoney(Number(expense.amount))}</div>
        <div className="text-[9px] text-muted-foreground mt-0.5">{currency?.name}</div>
      </div>
      <div className="flex flex-col -my-1">
        <button onClick={onEdit} aria-label="تعديل" className="p-1 text-muted-foreground hover:text-primary">
          <Pencil className="size-3" />
        </button>
        <button onClick={onDelete} aria-label="حذف" className="p-1 text-muted-foreground hover:text-danger">
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  );
}
