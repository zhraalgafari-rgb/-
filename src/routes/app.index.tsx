import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, TrendingUp, TrendingDown, UserPlus, Users, Sparkles } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { processDueRecurring } from "@/lib/recurring";

export const Route = createFileRoute("/app/")({ component: AppHome });

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Person { id: string; name: string; type: string; is_archived: boolean; avatar_color: string | null }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string }

function AppHome() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    // Auto-process due recurring rules first
    await processDueRecurring(user.id);
    const [{ data: p }, { data: t }, { data: c }] = await Promise.all([
      supabase.from("people").select("*").eq("is_archived", false).order("created_at", { ascending: false }),
      supabase.from("transactions").select("*"),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
    ]);
    setPeople((p ?? []) as Person[]);
    setTxs((t ?? []) as Tx[]);
    setCurrencies((c ?? []) as Currency[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const baseCurrency = currencies.find((c) => c.is_base) ?? currencies[0];

  const personBalances = useMemo(() => {
    const map = new Map<string, { net: number; count: number; lastDate: number }>();
    for (const t of txs) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      const rate = cur?.rate ?? 1;
      const sign = t.direction === "credit" ? 1 : -1;
      const cur_amt = Number(t.amount) * sign * rate;
      const prev = map.get(t.person_id) ?? { net: 0, count: 0, lastDate: 0 };
      const dateMs = new Date(t.transaction_date).getTime();
      map.set(t.person_id, {
        net: prev.net + cur_amt,
        count: prev.count + 1,
        lastDate: Math.max(prev.lastDate, dateMs),
      });
    }
    return map;
  }, [txs, currencies]);

  const totals = useMemo(() => {
    let owe = 0, owed = 0;
    for (const [, v] of personBalances) {
      if (v.net > 0) owed += v.net;
      else owe += -v.net;
    }
    return { owe, owed };
  }, [personBalances]);

  const filtered = people
    .filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      const b = personBalances.get(p.id);
      if (filter === "credit") return (b?.net ?? 0) > 0.001;
      if (filter === "debit") return (b?.net ?? 0) < -0.001;
      return true;
    })
    .sort((a, b) => {
      // Active balances first, then most recent activity
      const ba = personBalances.get(a.id);
      const bb = personBalances.get(b.id);
      const aActive = Math.abs(ba?.net ?? 0) > 0.001 ? 1 : 0;
      const bActive = Math.abs(bb?.net ?? 0) > 0.001 ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return (bb?.lastDate ?? 0) - (ba?.lastDate ?? 0);
    });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-4 shadow-elevated">
        <div className="flex items-center justify-between text-xs opacity-80 mb-2">
          <span>إجمالي الأرصدة ({baseCurrency?.name ?? "محلي"})</span>
          <Link to="/app/insights" className="flex items-center gap-1 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full hover:bg-white/25 transition-colors">
            <Sparkles className="size-3" /> ذكاء
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setFilter(filter === "credit" ? "all" : "credit")} className={`bg-white/10 backdrop-blur rounded-xl p-3 text-right hover:bg-white/15 transition-all active:scale-[0.98] ${filter === "credit" ? "ring-2 ring-white/40" : ""}`}>
            <div className="flex items-center gap-1 text-xs opacity-90 mb-1">
              <TrendingUp className="size-3.5" /> لك
            </div>
            <div className="font-black text-lg tabular-nums">{fmtMoney(totals.owed)}</div>
          </button>
          <button onClick={() => setFilter(filter === "debit" ? "all" : "debit")} className={`bg-white/10 backdrop-blur rounded-xl p-3 text-right hover:bg-white/15 transition-all active:scale-[0.98] ${filter === "debit" ? "ring-2 ring-white/40" : ""}`}>
            <div className="flex items-center gap-1 text-xs opacity-90 mb-1">
              <TrendingDown className="size-3.5" /> عليك
            </div>
            <div className="font-black text-lg tabular-nums">{fmtMoney(totals.owe)}</div>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="text-[11px] opacity-80 text-center">الصافي: <span className="tabular-nums font-semibold">{fmtMoney(totals.owed - totals.owe)}</span></div>
          <div className="text-[11px] opacity-80 text-center">{people.length} شخص · {txs.length} معاملة</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن شخص..." className="pr-10" />
      </div>

      {filter !== "all" && (
        <div className="flex items-center justify-between text-xs px-1 animate-in slide-in-from-top-2 duration-200">
          <span className="text-muted-foreground">تصفية: {filter === "credit" ? "له فقط" : "عليه فقط"}</span>
          <button onClick={() => setFilter("all")} className="text-primary font-semibold">إلغاء التصفية</button>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : filtered.length === 0 ? (
        people.length === 0 ? (
          <EmptyState
            icon={UserPlus}
            title="ابدأ بإضافة أول معاملة"
            description="سجّل ما لك وما عليك بسهولة، وسنحتفظ لك بكل التفاصيل."
            action={
              <Button onClick={() => setOpenAdd(true)} size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
                <Plus className="size-4" /> إضافة أول معاملة
              </Button>
            }
          />
        ) : (
          <EmptyState icon={Users} title="لا توجد نتائج" description="جرّب كلمة بحث أخرى أو ألغِ التصفية." variant="compact" />
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((p, i) => {
            const b = personBalances.get(p.id) ?? { net: 0, count: 0, lastDate: 0 };
            const isCredit = b.net >= 0;
            const settled = Math.abs(b.net) < 0.001;
            return (
              <Link
                key={p.id}
                to="/app/person/$id"
                params={{ id: p.id }}
                className="block bg-card rounded-2xl border shadow-card hover:shadow-elevated transition-all p-3.5 active:scale-[0.99] animate-in fade-in slide-in-from-bottom-1"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: "backwards" }}
              >
                <div className="flex items-center gap-3">
                  <div className={`size-11 rounded-xl flex items-center justify-center font-bold text-base ${settled ? "bg-secondary text-muted-foreground" : isCredit ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                    {p.name.trim().charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{b.count} معاملة</div>
                  </div>
                  <div className="text-left">
                    {settled ? (
                      <div className="text-xs text-muted-foreground font-medium">مسوّى</div>
                    ) : (
                      <>
                        <div className={`font-bold tabular-nums ${isCredit ? "text-success" : "text-danger"}`}>
                          {isCredit ? "" : "-"}{fmtMoney(Math.abs(b.net))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{isCredit ? "له" : "عليه"}</div>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpenAdd(true)}
        className="fixed bottom-20 left-4 z-20 size-14 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
        aria-label="إضافة معاملة"
      >
        <Plus className="size-6" />
      </button>

      <AddTransactionDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        people={people}
        currencies={currencies}
        onSuccess={load}
      />
    </div>
  );
}
