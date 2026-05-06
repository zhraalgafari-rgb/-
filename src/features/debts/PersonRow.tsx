import { Link } from "@tanstack/react-router";
import { fmtMoney } from "@/lib/format";

interface Person {
  id: string;
  name: string;
}
interface Balance { net: number; count: number; lastDate: number }

interface Props {
  person: Person;
  balance: Balance;
  index?: number;
}

/** Row for a person on the debts list — compact micro-card. */
export function PersonRow({ person, balance, index = 0 }: Props) {
  const isCredit = balance.net >= 0;
  const settled = Math.abs(balance.net) < 0.001;
  return (
    <Link
      to="/app/person/$id"
      params={{ id: person.id }}
      className="block bg-card rounded-xl border shadow-card hover:shadow-elevated transition-all p-2.5 active:scale-[0.99] animate-in fade-in slide-in-from-bottom-1"
      style={{ animationDelay: `${Math.min(index * 25, 250)}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`size-9 rounded-lg flex items-center justify-center font-bold text-sm ring-1 ${
            settled
              ? "bg-secondary text-muted-foreground ring-border"
              : isCredit
              ? "bg-success-soft text-success ring-success/30"
              : "bg-danger-soft text-danger ring-danger/30"
          }`}
        >
          {person.name.trim().charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[13px] truncate leading-tight">{person.name}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{balance.count} معاملة</div>
        </div>
        <div className="text-left">
          {settled ? (
            <div className="text-[10px] text-muted-foreground font-semibold uppercase">مسوّى</div>
          ) : (
            <>
              <div className={`font-black text-sm tabular-nums leading-tight ${isCredit ? "text-success" : "text-danger"}`}>
                {isCredit ? "" : "-"}{fmtMoney(Math.abs(balance.net))}
              </div>
              <div className="text-[9px] text-muted-foreground font-semibold uppercase mt-0.5">{isCredit ? "له" : "عليه"}</div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
