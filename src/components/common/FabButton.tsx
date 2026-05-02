import { Plus, LucideIcon } from "lucide-react";

interface Props {
  onClick: () => void;
  icon?: LucideIcon;
  label?: string;
}

/** Floating action button (bottom-left in RTL). */
export function FabButton({ onClick, icon: Icon = Plus, label = "إضافة" }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="fixed bottom-20 left-4 z-20 size-14 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
    >
      <Icon className="size-6" />
    </button>
  );
}
