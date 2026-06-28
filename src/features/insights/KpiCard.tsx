import { Card } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface Props { icon: LucideIcon; label: string; value: string; sub?: string; accent?: string }

export function KpiCard({ icon: Icon, label, value, sub, accent }: Props) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
        <Icon className="size-3.5" style={accent ? { color: accent } : undefined} />
        {label}
      </div>
      <div className="font-bold text-sm truncate">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground tabular-nums">{sub}</div>}
    </Card>
  );
}
