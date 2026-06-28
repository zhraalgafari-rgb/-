import { Card } from "@/components/ui/card";
import { fmtMoney } from "@/lib/format";

interface Props { map: Map<number, number>; max: number; total: number }

export function SpendingHeatmap({ map, max, total }: Props) {
  if (max <= 0) return null;
  return (
    <Card className="p-4">
      <h3 className="font-semibold text-sm mb-3">خريطة الإنفاق اليومي</h3>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: total }).map((_, i) => {
          const d = i + 1;
          const v = map.get(d) ?? 0;
          const intensity = max > 0 ? v / max : 0;
          return (
            <div
              key={d}
              title={v > 0 ? `يوم ${d}: ${fmtMoney(v)}` : `يوم ${d}: لا إنفاق`}
              className="aspect-square rounded-md flex items-center justify-center text-[10px] font-medium border"
              style={{
                background: v > 0 ? `color-mix(in oklab, var(--primary) ${Math.round(intensity * 80) + 10}%, transparent)` : "transparent",
                color: intensity > 0.5 ? "var(--primary-foreground)" : "var(--muted-foreground)",
              }}
            >
              {d}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
