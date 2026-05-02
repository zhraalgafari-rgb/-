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

/** Row for a person on the debts list. */
export function PersonRow({ person, balance, index = 0 }: Props) {
  const isCredit = balance.net >= 0;
  const settled = Math.abs(balance.net) < 0.001;
  return (
    <Link
      to="/app/person/$id"
      params={{ id: person.id }}
      className="block bg-card rounded-2xl border shadow-card hover:shadow-elevated transition-all p-3.5 active:scale-[0.99] animate-in fade-in slide-in-from-bottom-1"
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-center gap-3">
        <div className={`size-11 rounded-xl flex items-center justify-center font-bold text-base ${settled ? "bg-secondary text-muted-foreground" : isCredit ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
          {person.name.trim().charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate">{person.name}</div>
          <div className="text-xs text-muted-foreground">{balance.count} معاملة</div>
        </div>
        <div className="text-left">
          {settled ? (
            <div className="text-xs text-muted-foreground font-medium">مسوّى</div>
          ) : (
            <>
              <div className={`font-bold tabular-nums ${isCredit ? "text-success" : "text-danger"}`}>
                {isCredit ? "" : "-"}{fmtMoney(Math.abs(balance.net))}
              </div>
              <div className="text-[10px] text-muted-foreground">{isCredit ? "له" : "عليه"}</div>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
