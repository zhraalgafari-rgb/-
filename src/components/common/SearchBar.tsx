import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder = "ابحث..." }: Props) {
  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pr-10 pl-9" />
      {value && (
        <button
          onClick={() => onChange("")}
          aria-label="مسح"
          className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
