import { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface Props {
  title?: string;
  children: ReactNode;
}

export function SettingsGroup({ title, children }: Props) {
  return (
    <div className="space-y-2">
      {title && <h3 className="text-xs font-bold text-muted-foreground px-2">{title}</h3>}
      <Card className="p-1.5">{children}</Card>
    </div>
  );
}
