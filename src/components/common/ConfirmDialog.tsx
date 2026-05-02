import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel = "تأكيد", cancelLabel = "إلغاء",
  destructive, onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-right">{title}</DialogTitle>
          {description && <DialogDescription className="text-right">{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">{cancelLabel}</Button>
          <Button
            onClick={async () => { await onConfirm(); onOpenChange(false); }}
            className={`flex-1 ${destructive ? "bg-danger text-danger-foreground hover:bg-danger/90" : "bg-gradient-primary text-primary-foreground"}`}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
