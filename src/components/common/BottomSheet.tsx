import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
}

export function BottomSheet({ open, onOpenChange, title, description, children }: Props) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        {(title || description) && (
          <DrawerHeader className="text-right">
            {title && <DrawerTitle>{title}</DrawerTitle>}
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
        )}
        <div className="px-4 pb-6 max-h-[70vh] overflow-y-auto">{children}</div>
      </DrawerContent>
    </Drawer>
  );
}
