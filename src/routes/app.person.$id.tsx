import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ArrowRight, Plus, Trash2, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMoney, fmtDate, fmtTime } from "@/lib/format";
import { toast } from "sonner";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";

export const Route = createFileRoute("/app/person/$id")({ component: PersonPage });

interface Currency { id: string; name: string; symbol: string; rate: number; is_base: boolean }
interface Tx { id: string; amount: number; direction: string; currency_id: string; transaction_date: string; details: string | null }

function PersonPage() {
  const { id } = useParams({ from: "/app/person/$id" });
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [txs, setTxs] = useState<Tx[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAdd, setOpenAdd] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: person }, { data: t }, { data: c }, { data: p }] = await Promise.all([
      supabase.from("people").select("name").eq("id", id).single(),
      supabase.from("transactions").select("*").eq("person_id", id).order("transaction_date", { ascending: false }),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
      supabase.from("people").select("id,name"),
    ]);
    setName(person?.name ?? "");
    setTxs(t ?? []);
    setCurrencies(c ?? []);
    setPeople(p ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, id]);

  const balance = useMemo(() => {
    let net = 0;
    for (const t of txs) {
      const cur = currencies.find((c) => c.id === t.currency_id);
      const rate = cur?.rate ?? 1;
      const sign = t.direction === "credit" ? 1 : -1;
      net += Number(t.amount) * sign * rate;
    }
    return net;
  }, [txs, currencies]);

  // running balance per row (oldest first)
  const ordered = [...txs].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
  const running: Record<string, number> = {};
  let acc = 0;
  for (const t of ordered) {
    const cur = currencies.find((c) => c.id === t.currency_id);
    const rate = cur?.rate ?? 1;
    acc += Number(t.amount) * (t.direction === "credit" ? 1 : -1) * rate;
    running[t.id] = acc;
  }

  const del = async (txId: string) => {
    if (!confirm("حذف هذه المعاملة؟")) return;
    const { error } = await supabase.from("transactions").delete().eq("id", txId);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    load();
  };

  const isCredit = balance >= 0;

  return (
    <div className="space-y-4">
      <Link to="/app" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="size-4" /> رجوع
      </Link>

      <div className={`rounded-2xl p-4 shadow-elevated text-white ${isCredit ? "bg-gradient-success" : "bg-gradient-danger"}`}>
        <div className="text-xs opacity-90 mb-1">{name}</div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-xs opacity-90">{isCredit ? "له عندك" : "عليه"}</div>
            <div className="text-3xl font-black mt-0.5">{fmtMoney(Math.abs(balance))}</div>
          </div>
          <div className="text-xs opacity-90">{txs.length} معاملة</div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : txs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">لا توجد معاملات بعد</div>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => {
            const cur = currencies.find((c) => c.id === t.currency_id);
            const credit = t.direction === "credit";
            return (
              <div key={t.id} className="bg-card border rounded-2xl p-3 shadow-card">
                <div className="flex items-start gap-3">
                  <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${credit ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                    {credit ? <TrendingUp className="size-4" /> : <TrendingDown className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`font-bold ${credit ? "text-success" : "text-danger"}`}>
                        {credit ? "+" : "-"}{fmtMoney(Number(t.amount))} <span className="text-xs text-muted-foreground font-normal">{cur?.name}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{fmtDate(t.transaction_date)} · {fmtTime(t.transaction_date)}</div>
                    </div>
                    {t.details && <div className="text-sm text-muted-foreground mt-0.5 truncate">{t.details}</div>}
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[11px] text-muted-foreground">الرصيد: {fmtMoney(Math.abs(running[t.id]))} {running[t.id] >= 0 ? "له" : "عليه"}</div>
                      <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-danger p-1">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => setOpenAdd(true)}
        className="fixed bottom-20 left-4 z-20 size-14 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
      >
        <Plus className="size-6" />
      </button>

      <AddTransactionDialog
        open={openAdd}
        onOpenChange={setOpenAdd}
        people={people}
        currencies={currencies}
        onSuccess={load}
        defaultPersonId={id}
      />
    </div>
  );
}
