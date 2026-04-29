import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, TrendingUp, TrendingDown, Loader2, UserPlus } from "lucide-react";
import { fmtMoney } from "@/lib/format";
import { toast } from "sonner";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";

export const Route = createFileRoute("/app/")({ component: AppHome });

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Person { id: string; name: string; type: string }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string }

function AppHome() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: p }, { data: t }, { data: c }] = await Promise.all([
      supabase.from("people").select("*").order("created_at", { ascending: false }),
      supabase.from("transactions").select("*"),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
    ]);
    setPeople(p ?? []);
    setTxs(t ?? []);
    setCurrencies(c ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const baseCurrency = currencies.find((c) => c.is_base) ?? currencies[0];

  // balance per person in base currency (credit positive = "له", debit negative = "عليه")
  const personBalances = useMemo(() => {
    const map = new Map<string, { net: number; count: number }>();
    for (const t of txs) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      const rate = cur?.rate ?? 1;
      const sign = t.direction === "credit" ? 1 : -1;
      const cur_amt = Number(t.amount) * sign * rate;
      const prev = map.get(t.person_id) ?? { net: 0, count: 0 };
      map.set(t.person_id, { net: prev.net + cur_amt, count: prev.count + 1 });
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

  const filtered = people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  const onAdded = async () => { await load(); };

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-4 shadow-elevated">
        <div className="text-xs opacity-80 mb-2">إجمالي الأرصدة ({baseCurrency?.name ?? "محلي"})</div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 backdrop-blur rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs opacity-90 mb-1">
              <TrendingUp className="size-3.5" /> لك
            </div>
            <div className="font-black text-lg">{fmtMoney(totals.owed)}</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-3">
            <div className="flex items-center gap-1 text-xs opacity-90 mb-1">
              <TrendingDown className="size-3.5" /> عليك
            </div>
            <div className="font-black text-lg">{fmtMoney(totals.owe)}</div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن شخص..." className="pr-10" />
      </div>

      {/* People list */}
      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setOpenAdd(true)} hasPeople={people.length > 0} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const b = personBalances.get(p.id) ?? { net: 0, count: 0 };
            const isCredit = b.net >= 0;
            return (
              <Link key={p.id} to="/app/person/$id" params={{ id: p.id }}
                    className="block bg-card rounded-2xl border shadow-card hover:shadow-elevated transition-all p-3.5 active:scale-[0.99]">
                <div className="flex items-center gap-3">
                  <div className={`size-11 rounded-xl flex items-center justify-center font-bold text-base ${isCredit ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                    {p.name.trim().charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{b.count} معاملة</div>
                  </div>
                  <div className="text-left">
                    <div className={`font-bold ${isCredit ? "text-success" : "text-danger"}`}>
                      {isCredit ? "" : "-"}{fmtMoney(Math.abs(b.net))}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{isCredit ? "له" : "عليه"}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* FAB */}
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
        onSuccess={onAdded}
      />
    </div>
  );
}

function EmptyState({ onAdd, hasPeople }: { onAdd: () => void; hasPeople: boolean }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="size-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-4">
        <UserPlus className="size-8 text-primary" />
      </div>
      <h3 className="font-bold text-lg mb-1">{hasPeople ? "لا توجد نتائج" : "ابدأ بإضافة أول معاملة"}</h3>
      <p className="text-sm text-muted-foreground mb-5">سجّل ما لك وما عليك بسهولة</p>
      {!hasPeople && (
        <Button onClick={onAdd} className="bg-gradient-primary text-primary-foreground shadow-glow">
          <Plus className="size-4" /> إضافة معاملة
        </Button>
      )}
    </div>
  );
}
