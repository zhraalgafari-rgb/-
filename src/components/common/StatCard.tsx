import { LucideIcon } from "lucide-react";
import { fmtMoney } from "@/lib/format";

interface Props {
  icon: LucideIcon;
  label: string;
  value: number;
  tone?: "success" | "danger" | "primary" | "muted";
  onClick?: () => void;
  active?: boolean;
}

const TONES = {
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  primary: "bg-primary/10 text-primary",
  muted: "bg-secondary text-muted-foreground",
};

export function StatCard({ icon: Icon, label, value, tone = "primary", onClick, active }: Props) {
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-card rounded-2xl border shadow-card p-3 text-right transition-all ${onClick ? "hover:shadow-elevated active:scale-[0.98]" : ""} ${active ? "ring-2 ring-primary" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`size-8 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
          <Icon className="size-4" />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="font-black text-lg tabular-nums">{fmtMoney(value)}</div>
    </Tag>
  );
}
