import { Link } from "@tanstack/react-router";
import { fmtMoney, fmtDate } from "@/lib/format";
import type { PersonBalance } from "./PersonRow";
import { RowActions } from "@/components/common/RowActions";

interface Person {
  id: string;
  name: string;
  phone?: string | null;
}

interface Props {
  rows: { person: Person; balance: PersonBalance }[];
  onEdit?: (p: Person) => void;
  onArchive?: (p: Person) => void;
  onDelete?: (p: Person) => void;
}

/** Professional, colorful, dense table view of customers. */
export function PersonTable({ rows, onEdit, onArchive, onDelete }: Props) {
  const hasActions = !!(onEdit || onArchive || onDelete);
  return (
    <div className="rounded-lg border bg-card shadow-card overflow-hidden animate-in fade-in duration-200">
      <div className="overflow-x-auto">
        <table className="w-full text-[10.5px] border-collapse">
          <thead className="bg-gradient-primary text-primary-foreground">
            <tr className="[&>th]:px-2 [&>th]:py-1.5 [&>th]:font-bold [&>th]:text-right [&>th]:whitespace-nowrap">
              <th className="w-7">#</th>
              <th>العميل</th>
              <th className="hidden sm:table-cell">الهاتف</th>
              <th className="text-center">معاملات</th>
              <th className="text-left">له</th>
              <th className="text-left">عليه</th>
              <th className="text-left">الصافي</th>
              <th className="text-center hidden xs:table-cell">آخر دفعة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ person, balance }, i) => {
              const isCredit = balance.net >= 0;
              const settled = Math.abs(balance.net) < 0.001;
              const zebra = i % 2 === 0 ? "bg-card" : "bg-secondary/40";
              const stateTint = settled
                ? ""
                : isCredit
                ? "border-r-2 border-r-success"
                : "border-r-2 border-r-danger";
              return (
                <tr
                  key={person.id}
                  className={`${zebra} ${stateTint} border-b border-border/60 hover:bg-primary/5 transition-colors`}
                >
                  <td className="px-2 py-1.5 text-muted-foreground tabular-nums">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <Link
                      to="/app/person/$id"
                      params={{ id: person.id }}
                      className="font-bold text-foreground hover:text-primary truncate block max-w-[110px]"
                    >
                      {person.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 hidden sm:table-cell text-muted-foreground tabular-nums" dir="ltr">
                    {person.phone || "—"}
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">{balance.count}</td>
                  <td className="px-2 py-1.5 text-left tabular-nums font-semibold text-success">
                    {(balance.totalCredit ?? 0) > 0 ? fmtMoney(balance.totalCredit ?? 0) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-left tabular-nums font-semibold text-danger">
                    {(balance.totalDebit ?? 0) > 0 ? fmtMoney(balance.totalDebit ?? 0) : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-left">
                    {settled ? (
                      <span className="inline-block px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-[9px] font-bold">
                        مسوّى
                      </span>
                    ) : (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-black tabular-nums ${
                          isCredit
                            ? "bg-success-soft text-success ring-1 ring-success/30"
                            : "bg-danger-soft text-danger ring-1 ring-danger/30"
                        }`}
                      >
                        {isCredit ? "" : "-"}
                        {fmtMoney(Math.abs(balance.net))}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center hidden xs:table-cell text-muted-foreground tabular-nums">
                    {balance.lastDate ? fmtDate(new Date(balance.lastDate).toISOString()) : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-4 text-muted-foreground text-[10px]">
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
