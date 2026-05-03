import { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  tone?: "primary" | "success" | "danger" | "warning" | "muted" | "accent";
  size?: "sm" | "md" | "lg";
}

const TONES = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  muted: "bg-secondary text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
};

export function IconTile({ icon: Icon, tone = "primary", size = "md" }: Props) {
  const sz = size === "lg" ? "size-12" : size === "sm" ? "size-8" : "size-10";
  const isz = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";
  return (
    <div className={`${sz} rounded-xl flex items-center justify-center ${TONES[tone]} shrink-0`}>
      <Icon className={isz} />
    </div>
  );
}
