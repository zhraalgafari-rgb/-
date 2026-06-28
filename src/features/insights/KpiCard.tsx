import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface Props { icon: LucideIcon; label: string; value: string; sub?: string; accent?: string }

export function KpiCard({ icon: Icon, label, value, sub, accent }: Props) {
  return (
    <Card className="p-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-0.5 truncate">
        <Icon className="size-3 shrink-0" style={accent ? { color: accent } : undefined} />
        <span className="truncate">{label}</span>
      </div>
      <div className="font-bold text-[12px] truncate leading-tight">{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground tabular-nums truncate">{sub}</div>}
    </Card>
  );
}
