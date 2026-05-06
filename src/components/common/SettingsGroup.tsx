import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface Props {
  title?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: Props) {
  return (
    <div className="space-y-1.5">
      {title && (
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2">
          {title}
        </h3>
      )}
      <Card className="p-1 divide-y divide-border/50">{children}</Card>
    </div>
  );
}
