import { Input } from "@/components/ui/input";
import { evalExpr } from "@/lib/calc";
import { Calculator } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}

/** Amount input with inline calculator preview (50+30 → 80). */
export function AmountInput({ value, onChange, placeholder = "0", className }: Props) {
  const raw = value.trim();
  const isExpr = /[+\-*/]/.test(raw.replace(/^-/, ""));
  const computed = isExpr ? evalExpr(raw) : NaN;
  const showPreview = isExpr && isFinite(computed);

  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
      {showPreview && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md font-bold">
          <Calculator className="size-3" />
          {computed.toLocaleString("en-US", { maximumFractionDigits: 2 })}
        </div>
      )}
    </div>
  );
}
