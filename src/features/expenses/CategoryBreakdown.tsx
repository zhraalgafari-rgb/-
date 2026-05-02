import { fmtMoney } from "@/lib/format";

interface Cat { id: string; name: string; color: string; value: number }

interface Props {
  data: Cat[];
  total: number;
}

/** Compact horizontal bars showing top categories. Pure CSS — no recharts dep. */
export function CategoryBreakdown({ data, total }: Props) {
  if (data.length === 0 || total <= 0) return null;
  const top = data.slice(0, 5);
  return (
    <div className="bg-card border rounded-2xl shadow-card p-4">
      <h3 className="font-semibold text-sm mb-3">أعلى التصنيفات</h3>
      <div className="space-y-2.5">
        {top.map((d) => {
          const pct = (d.value / total) * 100;
          return (
            <div key={d.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-2.5 rounded-sm shrink-0" style={{ background: d.color }} />
                  <span className="truncate">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-muted-foreground tabular-nums">{fmtMoney(d.value)}</span>
                  <span className="font-bold w-9 text-left">{Math.round(pct)}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: d.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
