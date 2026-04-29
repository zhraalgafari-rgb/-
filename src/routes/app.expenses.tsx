import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Plus, Loader2, ChevronRight, ChevronLeft, Pencil, Trash2, Search, Wallet } from "lucide-react";
import { fmtMoney, fmtDate, fmtMonthAr, monthRange } from "@/lib/format";
import { IconByName } from "@/components/IconByName";
import { ExpenseDialog } from "@/components/ExpenseDialog";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export const Route = createFileRoute("/app/expenses")({ component: ExpensesPage });

interface Expense { id: string; amount: number; category_id: string | null; currency_id: string; note: string | null; expense_date: string }
interface Category { id: string; name: string; icon: string; color: string }
interface Currency { id: string; name: string; rate: number; is_base: boolean }
interface Budget { id: string; category_id: string | null; amount: number; currency_id: string }

function ExpensesPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { start, end } = monthRange(month);
    const [{ data: e }, { data: c }, { data: cu }, { data: b }] = await Promise.all([
      supabase.from("expenses").select("*").gte("expense_date", start.toISOString()).lt("expense_date", end.toISOString()).order("expense_date", { ascending: false }),
      supabase.from("expense_categories").select("*").order("sort_order"),
      supabase.from("currencies").select("*").order("is_base", { ascending: false }),
      supabase.from("budgets").select("*"),
    ]);
    setExpenses((e ?? []) as Expense[]);
    setCategories((c ?? []) as Category[]);
    setCurrencies((cu ?? []) as Currency[]);
    setBudgets((b ?? []) as Budget[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [user, month]);

  const base = currencies.find((c) => c.is_base) ?? currencies[0];

  const toBase = (amount: number, currencyId: string) => {
    const cur = currencies.find((c) => c.id === currencyId);
    return Number(amount) * (cur?.rate ?? 1);
  };

  const totalBase = useMemo(() => expenses.reduce((s, x) => s + toBase(x.amount, x.currency_id), 0), [expenses, currencies]);

  const totalBudget = useMemo(() => budgets.reduce((s, b) => s + toBase(b.amount, b.currency_id), 0), [budgets, currencies]);

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category_id ?? "_";
      m.set(k, (m.get(k) ?? 0) + toBase(e.amount, e.currency_id));
    }
    return Array.from(m.entries())
      .map(([id, v]) => {
        const cat = categories.find((c) => c.id === id);
        return { id, name: cat?.name ?? "غير مصنّف", color: cat?.color ?? "#94a3b8", icon: cat?.icon ?? "Tag", value: v };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories, currencies]);

  const filtered = expenses.filter((e) => {
    if (!q) return true;
    const cat = categories.find((c) => c.id === e.category_id);
    const hay = `${cat?.name ?? ""} ${e.note ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const del = async (id: string) => {
    if (!confirm("حذف هذا المصروف؟")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم الحذف"); load();
  };

  const prevMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
  const nextMonth = () => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));

  const budgetPct = totalBudget > 0 ? Math.min(100, (totalBase / totalBudget) * 100) : 0;
  const overBudget = totalBudget > 0 && totalBase > totalBudget;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-4 shadow-elevated">
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="p-2 -m-2 rounded-lg hover:bg-white/10"><ChevronRight className="size-5" /></button>
          <div className="text-center">
            <div className="text-xs opacity-80">إجمالي مصاريف</div>
            <div className="font-semibold text-sm">{fmtMonthAr(month)}</div>
          </div>
          <button onClick={nextMonth} className="p-2 -m-2 rounded-lg hover:bg-white/10"><ChevronLeft className="size-5" /></button>
        </div>
        <div className="text-center">
          <div className="font-black text-3xl">{fmtMoney(totalBase)}</div>
          <div className="text-xs opacity-80 mt-1">{base?.name ?? ""}</div>
        </div>
        {totalBudget > 0 && (
          <div className="mt-3 bg-white/10 rounded-xl p-2.5">
            <div className="flex justify-between text-xs mb-1.5">
              <span>الميزانية: {fmtMoney(totalBudget)}</span>
              <span className={overBudget ? "font-bold" : ""}>{Math.round(budgetPct)}%</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div className={`h-full ${overBudget ? "bg-red-300" : "bg-white"} transition-all`} style={{ width: `${budgetPct}%` }} />
            </div>
            {overBudget && <div className="text-[11px] mt-1.5 opacity-95">⚠️ تجاوزت الميزانية بـ {fmtMoney(totalBase - totalBudget)}</div>}
          </div>
        )}
      </div>

      {byCat.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold text-sm mb-3">حسب التصنيف</h3>
          <div className="grid grid-cols-[140px_1fr] gap-3 items-center">
            <div className="h-32">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {byCat.map((d) => <Cell key={d.id} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {byCat.slice(0, 5).map((d) => {
                const pct = totalBase > 0 ? (d.value / totalBase) * 100 : 0;
                return (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <div className="size-3 rounded-sm shrink-0" style={{ background: d.color }} />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="font-semibold">{Math.round(pct)}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث..." className="pr-10" />
      </div>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="size-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="size-16 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-3">
            <Wallet className="size-8 text-primary" />
          </div>
          <h3 className="font-bold mb-1">لا توجد مصاريف</h3>
          <p className="text-sm text-muted-foreground">ابدأ بتسجيل أول مصروف لك هذا الشهر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => {
            const cat = categories.find((c) => c.id === e.category_id);
            const cur = currencies.find((c) => c.id === e.currency_id);
            return (
              <div key={e.id} className="bg-card border rounded-2xl p-3 shadow-card flex items-center gap-3">
                <div className="size-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: (cat?.color ?? "#94a3b8") + "22", color: cat?.color ?? "#94a3b8" }}>
                  <IconByName name={cat?.icon ?? "Tag"} className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{cat?.name ?? "غير مصنّف"}</div>
                  {e.note && <div className="text-xs text-muted-foreground truncate">{e.note}</div>}
                  <div className="text-[10px] text-muted-foreground">{fmtDate(e.expense_date)}</div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-danger">-{fmtMoney(Number(e.amount))}</div>
                  <div className="text-[10px] text-muted-foreground">{cur?.name}</div>
                </div>
                <div className="flex flex-col">
                  <button onClick={() => { setEditing(e); setOpen(true); }} className="p-1 text-muted-foreground hover:text-primary"><Pencil className="size-3.5" /></button>
                  <button onClick={() => del(e.id)} className="p-1 text-muted-foreground hover:text-danger"><Trash2 className="size-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button onClick={() => { setEditing(null); setOpen(true); }}
        className="fixed bottom-20 left-4 z-20 size-14 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
        <Plus className="size-6" />
      </button>

      <ExpenseDialog open={open} onOpenChange={setOpen} currencies={currencies} categories={categories} editing={editing} onSuccess={load} />
    </div>
  );
}
