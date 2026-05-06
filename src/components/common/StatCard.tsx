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
  success: "bg-success-soft text-success ring-success/25",
  danger: "bg-danger-soft text-danger ring-danger/25",
  primary: "bg-primary/15 text-primary ring-primary/25",
  muted: "bg-secondary text-muted-foreground ring-border",
};

const ACTIVE_BORDER = {
  success: "ring-2 ring-success/60",
  danger: "ring-2 ring-danger/60",
  primary: "ring-2 ring-primary/60",
  muted: "ring-2 ring-foreground/30",
};

export function StatCard({ icon: Icon, label, value, tone = "primary", onClick, active }: Props) {
  const Tag: any = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={`bg-card rounded-xl border shadow-card p-2.5 text-right transition-all ${onClick ? "hover:shadow-elevated active:scale-[0.98]" : ""} ${active ? ACTIVE_BORDER[tone] : ""}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <div className={`size-7 rounded-md flex items-center justify-center ring-1 ${TONES[tone]}`}>
          <Icon className="size-3.5" />
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className="font-black text-base tabular-nums leading-tight">{fmtMoney(value)}</div>
    </Tag>
  );
}
