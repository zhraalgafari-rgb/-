import { fmtMoney } from "@/lib/format";

interface Props {
  amount: number;
  /** "credit" = positive (success), "debit" = negative (danger). Auto by sign if omitted. */
  direction?: "credit" | "debit";
  currency?: string;
  size?: "sm" | "md" | "lg";
}

export function MoneyBadge({ amount, direction, currency, size = "md" }: Props) {
  const isCredit = direction ? direction === "credit" : amount >= 0;
  const settled = Math.abs(amount) < 0.001;
  const cls = settled
    ? "text-muted-foreground"
    : isCredit
      ? "text-success"
      : "text-danger";
  const sz = size === "lg" ? "text-2xl" : size === "sm" ? "text-xs" : "text-base";
  const sign = settled ? "" : isCredit ? "" : "-";
  return (
    <span className={`font-bold tabular-nums ${cls} ${sz}`}>
      {sign}{fmtMoney(Math.abs(amount))}
      {currency && <span className="text-[10px] text-muted-foreground font-normal ms-1">{currency}</span>}
    </span>
  );
}
