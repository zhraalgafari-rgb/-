import { ChevronRight, ChevronLeft } from "lucide-react";
import { fmtMonthAr } from "@/lib/format";

interface Props {
  month: Date;
  onChange: (d: Date) => void;
  label?: string;
}

export function MonthSwitcher({ month, onChange, label }: Props) {
  const prev = () => onChange(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const next = () => onChange(new Date(month.getFullYear(), month.getMonth() + 1, 1));
  return (
    <div className="flex items-center justify-between">
      <button onClick={prev} className="p-2 -m-2 rounded-lg hover:bg-white/10" aria-label="السابق">
        <ChevronRight className="size-5" />
      </button>
      <div className="text-center">
        {label && <div className="text-xs opacity-80">{label}</div>}
        <div className="font-semibold text-sm">{fmtMonthAr(month)}</div>
      </div>
      <button onClick={next} className="p-2 -m-2 rounded-lg hover:bg-white/10" aria-label="التالي">
        <ChevronLeft className="size-5" />
      </button>
    </div>
  );
}
