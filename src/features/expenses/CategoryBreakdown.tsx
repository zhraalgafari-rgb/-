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
    <div className="bg-card border rounded-xl shadow-card p-2.5">
      <h3 className="font-semibold text-[10px] mb-1.5 text-muted-foreground uppercase tracking-wide">أعلى التصنيفات</h3>
      <div className="space-y-1.5">
        {top.map((d) => {
          const pct = (d.value / total) * 100;
          return (
            <div key={d.id} className="space-y-0.5">
              <div className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div className="size-2 rounded-sm shrink-0" style={{ background: d.color }} />
                  <span className="truncate font-medium">{d.name}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-muted-foreground tabular-nums">{fmtMoney(d.value)}</span>
                  <span className="font-bold w-7 text-left">{Math.round(pct)}%</span>
                </div>
              </div>
              <div className="h-0.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: d.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
