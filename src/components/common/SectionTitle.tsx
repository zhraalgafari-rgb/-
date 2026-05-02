import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  action?: ReactNode;
}

export function SectionTitle({ children, action }: Props) {
  return (
    <div className="flex items-center justify-between px-1">
      <h3 className="text-sm font-bold text-muted-foreground">{children}</h3>
      {action}
    </div>
  );
}
