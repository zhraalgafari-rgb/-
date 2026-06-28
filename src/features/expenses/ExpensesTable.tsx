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
  expenses: Expense[];
  categories: Category[];
  currencies: Currency[];
  onEdit: (e: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpensesTable({ expenses, categories, currencies, onEdit, onDelete }: Props) {
  let total = 0;
  return (
    <div className="rounded-xl border-2 border-border bg-card shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] border-collapse" dir="rtl">
          <thead>
            <tr className="bg-gradient-to-l from-danger/15 via-danger/10 to-danger/5 text-foreground">
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-10">#</th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-20">التاريخ</th>
              <th className="px-1.5 py-2 text-start font-bold border-b-2 border-l border-border">التصنيف</th>
              <th className="px-1.5 py-2 text-start font-bold border-b-2 border-l border-border">الوصف</th>
              <th className="px-1.5 py-2 text-end font-bold border-b-2 border-l border-border">المبلغ</th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-l border-border w-12">العملة</th>
              <th className="px-1.5 py-2 text-center font-bold border-b-2 border-border w-16">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((e, i) => {
              const cat = categories.find((c) => c.id === e.category_id);
              const cur = currencies.find((c) => c.id === e.currency_id);
              const color = cat?.color ?? "#94a3b8";
              const zebra = i % 2 === 0 ? "" : "bg-muted/30";
              total += Number(e.amount);
              return (
                <tr key={e.id} className={`${zebra} hover:bg-danger/5 transition-colors`}>
                  <td className="px-1.5 py-1.5 text-center border-b border-l border-border tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="px-1.5 py-1.5 text-center border-b border-l border-border tabular-nums text-[10px]">{fmtDate(e.expense_date)}</td>
                  <td className="px-1.5 py-1.5 text-start border-b border-l border-border">
                    <div className="flex items-center gap-1.5">
                      <span className="size-5 rounded-md flex items-center justify-center shrink-0 ring-1"
                        style={{ background: color + "22", color, boxShadow: `inset 0 0 0 1px ${color}33` }}>
                        <IconByName name={cat?.icon ?? "Tag"} className="size-3" />
                      </span>
                      <span className="font-semibold truncate">{cat?.name ?? "غير مصنّف"}</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5 text-start border-b border-l border-border max-w-[140px]">
                    <div className="truncate text-foreground/90">{e.note || "—"}</div>
                  </td>
                  <td className="px-1.5 py-1.5 text-end border-b border-l border-border font-bold tabular-nums text-danger">
                    -{fmtMoney(Number(e.amount))}
                  </td>
                  <td className="px-1.5 py-1.5 text-center border-b border-l border-border text-[10px] text-muted-foreground font-semibold">
                    {cur?.name ?? "—"}
                  </td>
                  <td className="px-1 py-1.5 text-center border-b border-border">
                    <div className="inline-flex items-center gap-0.5">
                      <button onClick={() => onEdit(e)} aria-label="تعديل" className="p-1 rounded text-muted-foreground hover:bg-primary/10 hover:text-primary">
                        <Pencil className="size-3" />
                      </button>
                      <button onClick={() => onDelete(e.id)} aria-label="حذف" className="p-1 rounded text-muted-foreground hover:bg-danger/10 hover:text-danger">
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gradient-to-l from-danger/15 via-danger/10 to-danger/5 font-bold">
              <td colSpan={4} className="px-2 py-2 text-end border-t-2 border-border">الإجمالي</td>
              <td className="px-1.5 py-2 text-end border-t-2 border-l border-border tabular-nums text-danger">-{fmtMoney(total)}</td>
              <td colSpan={2} className="border-t-2 border-border"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
