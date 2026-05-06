import { LucideIcon, ChevronLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";
import { IconTile } from "./IconTile";

interface BaseProps {
  icon: LucideIcon;
  label: string;
  desc?: string;
  tone?: "primary" | "success" | "danger" | "warning" | "muted" | "accent";
  badge?: ReactNode;
  trailing?: ReactNode;
}

interface LinkProps extends BaseProps { to: string; onClick?: never; danger?: never; }
interface ButtonProps extends BaseProps { onClick: () => void; to?: never; danger?: boolean; }

export function SettingsRow(props: LinkProps | ButtonProps) {
  const { icon, label, desc, tone, badge, trailing } = props;

  const inner = (
    <>
      <IconTile icon={icon} size="sm" tone={tone ?? ((props as ButtonProps).danger ? "danger" : "muted")} />
      <div className="flex-1 min-w-0 text-right">
        <div className="font-semibold text-[13px] flex items-center gap-2 leading-tight">
          <span className="truncate">{label}</span>
          {badge}
        </div>
        {desc && <div className="text-[11px] text-muted-foreground truncate mt-0.5">{desc}</div>}
      </div>
      {trailing ?? <ChevronLeft className="size-3.5 text-muted-foreground shrink-0" />}
    </>
  );

  const cls = `w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors active:scale-[0.99] ${(props as ButtonProps).danger ? "hover:bg-danger-soft text-danger" : "hover:bg-secondary"}`;

  if ("to" in props && props.to) {
    return <Link to={props.to} className={cls}>{inner}</Link>;
  }
  return <button type="button" onClick={(props as ButtonProps).onClick} className={cls}>{inner}</button>;
}
