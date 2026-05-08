import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, Users } from "lucide-react";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { processDueRecurring } from "@/lib/recurring";
import { SearchBar } from "@/components/common/SearchBar";
import { FabButton } from "@/components/common/FabButton";
import { DebtsHeader } from "@/features/debts/DebtsHeader";
import { PersonRow } from "@/features/debts/PersonRow";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/")({ component: DebtsHome });

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Person { id: string; name: string; type: string; is_archived: boolean; avatar_color: string | null }
interface Tx { id: string; person_id: string; amount: number; direction: string; currency_id: string; transaction_date: string }

type Filter = "all" | "credit" | "debit";
type Sort = "active" | "name" | "recent";

function DebtsHome() {
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openAdd, setOpenAdd] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("active");

  const load = async () => {
    if (!user) return;
    setLoading(true);
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
  const pullDist = usePullToRefresh(load);

  const baseCurrency = currencies.find((c) => c.is_base) ?? currencies[0];

  const personBalances = useMemo(() => {
    const map = new Map<string, { net: number; count: number; lastDate: number }>();
    for (const t of txs) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      const rate = cur?.rate ?? 1;
      const sign = t.direction === "credit" ? 1 : -1;
      const dateMs = new Date(t.transaction_date).getTime();
      const prev = map.get(t.person_id) ?? { net: 0, count: 0, lastDate: 0 };
      map.set(t.person_id, {
        net: prev.net + Number(t.amount) * sign * rate,
        count: prev.count + 1,
        lastDate: Math.max(prev.lastDate, dateMs),
      });
    }
    return map;
  }, [txs, currencies]);

  const totals = useMemo(() => {
    let owe = 0, owed = 0;
    for (const [, v] of personBalances) {
      if (v.net > 0) owed += v.net; else owe += -v.net;
    }
    return { owe, owed };
  }, [personBalances]);

  const filtered = useMemo(() => {
    const list = people.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      const b = personBalances.get(p.id);
      if (filter === "credit") return (b?.net ?? 0) > 0.001;
      if (filter === "debit") return (b?.net ?? 0) < -0.001;
      return true;
    });
    return list.sort((a, b) => {
      const ba = personBalances.get(a.id);
      const bb = personBalances.get(b.id);
      if (sort === "name") return a.name.localeCompare(b.name, "ar");
      if (sort === "recent") return (bb?.lastDate ?? 0) - (ba?.lastDate ?? 0);
      // active: most-owed/owing first
      const aActive = Math.abs(ba?.net ?? 0);
      const bActive = Math.abs(bb?.net ?? 0);
      return bActive - aActive;
    });
  }, [people, q, filter, sort, personBalances]);

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {pullDist > 10 && (
        <div className="flex justify-center text-primary" style={{ height: Math.min(pullDist, 60) }}>
          <Loader2 className={`size-5 ${pullDist > 70 ? "animate-spin" : ""}`} style={{ transform: `rotate(${pullDist * 3}deg)` }} />
        </div>
      )}
      <DebtsHeader
        owed={totals.owed}
        owe={totals.owe}
        baseName={baseCurrency?.name ?? "محلي"}
        peopleCount={people.length}
        txCount={txs.length}
        filter={filter}
        onFilterChange={setFilter}
      />

      <div className="flex items-center gap-2">
        <div className="flex-1"><SearchBar value={q} onChange={setQ} placeholder="ابحث عن شخص..." /></div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="h-9 rounded-lg border bg-card px-2 text-[11px] font-semibold text-foreground"
          aria-label="فرز"
        >
          <option value="active">الأكثر نشاطاً</option>
          <option value="recent">الأحدث</option>
          <option value="name">أبجدي</option>
        </select>
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
          {filtered.map((p, i) => (
            <PersonRow key={p.id} person={p} balance={personBalances.get(p.id) ?? { net: 0, count: 0, lastDate: 0 }} index={i} />
          ))}
        </div>
      )}

      <FabButton onClick={() => setOpenAdd(true)} label="إضافة معاملة" />

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
