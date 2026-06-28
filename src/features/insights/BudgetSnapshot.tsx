import { Card } from "@/components/ui/card";
import { Target } from "lucide-react";
import { fmtMoney } from "@/lib/format";

interface Props { total: number; spent: number; baseName?: string }

export function BudgetSnapshot({ total, spent, baseName }: Props) {
  if (total <= 0) return null;
  const remaining = total - spent;
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="size-4 text-primary" />
        <h3 className="font-semibold text-sm">حالة الميزانية</h3>
      </div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="text-muted-foreground">متبقّي</span>
        <span className={`font-bold tabular-nums ${remaining < 0 ? "text-danger" : "text-success"}`}>
          {fmtMoney(remaining)} {baseName}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${spent > total ? "bg-danger" : "bg-gradient-primary"}`}
          style={{ width: `${Math.min(100, (spent / total) * 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
        <span>{fmtMoney(spent)}</span>
        <span>{fmtMoney(total)}</span>
      </div>
    </Card>
  );
}
