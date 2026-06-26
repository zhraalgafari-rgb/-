import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Search, User, ArrowLeftRight, Receipt } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchBar } from "@/components/common/SearchBar";
import { fmtMoney, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/app/search")({ component: SearchPage });

interface Person { id: string; name: string; phone: string | null }
interface Tx { id: string; person_id: string; amount: number; direction: string; transaction_date: string; details: string | null }
interface Expense { id: string; amount: number; expense_date: string; note: string | null; category_id: string }
interface Cat { id: string; name: string }

function SearchPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: p }, { data: t }, { data: e }, { data: c }] = await Promise.all([
        supabase.from("people").select("id,name,phone").eq("user_id", user.id),
        supabase.from("transactions").select("id,person_id,amount,direction,transaction_date,details").eq("user_id", user.id).order("transaction_date", { ascending: false }).limit(500),
        supabase.from("expenses").select("id,amount,expense_date,note,category_id").eq("user_id", user.id).order("expense_date", { ascending: false }).limit(500),
        supabase.from("expense_categories").select("id,name").eq("user_id", user.id),
      ]);
      setPeople((p ?? []) as Person[]);
      setTxs((t ?? []) as Tx[]);
      setExpenses((e ?? []) as Expense[]);
      setCats((c ?? []) as Cat[]);
    })();
  }, [user]);

  const pMap = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const catMap = useMemo(() => new Map(cats.map((c) => [c.id, c])), [cats]);

  const term = q.trim().toLowerCase();
  const peopleHits = term ? people.filter((p) => p.name.toLowerCase().includes(term) || (p.phone ?? "").includes(term)).slice(0, 20) : [];
  const txHits = term ? txs.filter((t) => (t.details ?? "").toLowerCase().includes(term) || pMap.get(t.person_id)?.name.toLowerCase().includes(term) || String(t.amount).includes(term)).slice(0, 30) : [];
  const expHits = term ? expenses.filter((e) => (e.note ?? "").toLowerCase().includes(term) || catMap.get(e.category_id)?.name.toLowerCase().includes(term) || String(e.amount).includes(term)).slice(0, 30) : [];

  return (
    <div className="space-y-3">
      <PageHeader icon={Search} title="بحث شامل" subtitle="ابحث في الأشخاص والمعاملات والمصاريف" />
      <SearchBar value={q} onChange={setQ} placeholder="اكتب اسم، مبلغ، تفاصيل..." />

      {!term ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="size-10 mb-2 opacity-40" />
          <div className="text-[12px]">ابدأ بالكتابة للبحث</div>
        </div>
      ) : (
        <div className="space-y-3">
          {peopleHits.length > 0 && (
            <Section icon={User} title={`الأشخاص (${peopleHits.length})`}>
              {peopleHits.map((p) => (
                <Link key={p.id} to="/app/person/$id" params={{ id: p.id }} className="block bg-card border rounded-lg p-2 hover:shadow-card transition">
                  <div className="font-semibold text-[12px]">{p.name}</div>
                  {p.phone && <div className="text-[10px] text-muted-foreground" dir="ltr">{p.phone}</div>}
                </Link>
              ))}
            </Section>
          )}

          {txHits.length > 0 && (
            <Section icon={ArrowLeftRight} title={`المعاملات (${txHits.length})`}>
              {txHits.map((t) => {
                const credit = t.direction === "credit";
                return (
                  <Link key={t.id} to="/app/person/$id" params={{ id: t.person_id }} className="block bg-card border rounded-lg p-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate">{pMap.get(t.person_id)?.name ?? "—"}</div>
                        {t.details && <div className="text-[10px] text-muted-foreground truncate">{t.details}</div>}
                        <div className="text-[10px] text-muted-foreground">{fmtDate(t.transaction_date)}</div>
                      </div>
                      <div className={`font-bold text-[12px] tabular-nums ${credit ? "text-success" : "text-danger"}`}>
                        {credit ? "+" : "-"}{fmtMoney(Number(t.amount))}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </Section>
          )}

          {expHits.length > 0 && (
            <Section icon={Receipt} title={`المصاريف (${expHits.length})`}>
              {expHits.map((e) => (
                <div key={e.id} className="bg-card border rounded-lg p-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-[12px] font-semibold truncate">{catMap.get(e.category_id)?.name ?? "—"}</div>
                      {e.note && <div className="text-[10px] text-muted-foreground truncate">{e.note}</div>}
                      <div className="text-[10px] text-muted-foreground">{fmtDate(e.expense_date)}</div>
                    </div>
                    <div className="font-bold text-[12px] tabular-nums text-danger">-{fmtMoney(Number(e.amount))}</div>
                  </div>
                </div>
              ))}
            </Section>
          )}

          {peopleHits.length === 0 && txHits.length === 0 && expHits.length === 0 && (
            <div className="text-center py-10 text-muted-foreground text-[12px]">لا توجد نتائج لـ "{q}"</div>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground px-1">
        <Icon className="size-3.5" /> {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
