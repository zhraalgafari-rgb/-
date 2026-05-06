import { LucideIcon, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ReactNode } from "react";

interface Props {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  back?: string;
  actions?: ReactNode;
}

/** Compact header used by inner pages (settings sub-pages, archive, etc.). */
export function PageHeader({ icon: Icon, title, subtitle, back, actions }: Props) {
  return (
    <div className="space-y-2">
      {back && (
        <Link to={back} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowRight className="size-3.5" /> رجوع
        </Link>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
            <Icon className="size-4" />
          </div>
          <div>
            <h1 className="font-black text-base leading-tight tracking-tight">{title}</h1>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </div>
  );
}
