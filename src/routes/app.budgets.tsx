import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, Coins } from "lucide-react";
import { IconByName } from "@/components/IconByName";
import { fmtMoney, monthRange } from "@/lib/format";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrencies } from "@/hooks/useCurrencies";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";

export const Route = createFileRoute("/app/budgets")({ component: BudgetsPage });

interface Budget { id: string; category_id: string | null; amount: number; currency_id: string }

function BudgetsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [defaultCur, setDefaultCur] = useState<string>("");
  const initRef = useRef(false);

  const { data: curs = [], isLoading: loadingCurs } = useCurrencies();
  const { data: categories = [] } = useExpenseCategories();
  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ["budgets", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("budgets").select("*");
      return (data ?? []) as Budget[];
    },
    enabled: !!user,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["budgetExpenses", user?.id],
    queryFn: async () => {
      const { start, end } = monthRange();
      const { data } = await supabase.from("expenses").select("amount,category_id,currency_id").gte("expense_date", start.toISOString()).lt("expense_date", end.toISOString());
      return (data ?? []) as { amount: number; category_id: string | null; currency_id: string }[];
    },
    enabled: !!user,
  });

  const loading = loadingCurs || loadingBudgets;

  const baseCur = curs.find((c: any) => c.is_base) ?? curs[0];
  const toBase = (a: number, cid: string) => Number(a) * (curs.find((c: any) => c.id === cid)?.rate ?? 1);

  useEffect(() => {
    if (initRef.current) return;
    if (!curs.length && !budgets.length) return;
    initRef.current = true;
    const base = curs.find((c: any) => c.is_base) ?? curs[0];
    if (base && !defaultCur) setDefaultCur(base.id ?? "");
    const d: Record<string, string> = {};
    budgets.forEach((bd: any) => { d[bd.category_id ?? "_"] = String(bd.amount); });
    setDraft(d);
  }, [curs, budgets]);

  const spentByCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) m.set(e.category_id ?? "_", (m.get(e.category_id ?? "_") ?? 0) + toBase(e.amount, e.currency_id));
    return m;
  }, [expenses, curs]);

  const refetch = () => {
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  };

  const save = async (categoryId: string | null) => {
    if (!user || !defaultCur) return;
    const key = categoryId ?? "_";
    const val = parseFloat(draft[key] ?? "");
    if (isNaN(val) || val < 0) return toast.error("مبلغ غير صحيح");
    if (val === 0) {
      const ex = budgets.find((b) => (b.category_id ?? null) === categoryId);
      if (ex) await supabase.from("budgets").delete().eq("id", ex.id);
      toast.success("تم إلغاء الميزانية"); refetch(); return;
    }
    const ex = budgets.find((b) => (b.category_id ?? null) === categoryId);
    if (ex) {
      const { error } = await supabase.from("budgets").update({ amount: val }).eq("id", ex.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("budgets").insert({ user_id: user.id, category_id: categoryId, amount: val, currency_id: defaultCur, period: "monthly" });
      if (error) return toast.error(error.message);
    }
    toast.success("تم الحفظ"); refetch();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="size-10 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center shadow-glow">
          <Coins className="size-5" />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">الميزانية الشهرية</h1>
          <p className="text-xs text-muted-foreground">حدّد سقف لكل تصنيف بالـ {baseCur?.name ?? ""}</p>
        </div>
      </div>

      {loading ? (
        <Card className="p-4 space-y-2">{(Array.from({ length: 3 }).map((_, i) => (<div key={i} className="h-10 bg-secondary rounded animate-pulse" />)))}</Card>
      ) : (
        <Card className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 mb-1">
            <Select value={defaultCur} onValueChange={setDefaultCur}>
              <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{curs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground">العملة الافتراضية للحفظ</span>
          </div>

          {categories.map((c) => {
            const b = budgets.find((x) => (x.category_id ?? null) === c.id);
            const limit = b ? toBase(b.amount, b.currency_id) : 0;
            const spent = spentByCat.get(c.id ?? "_") ?? 0;
            const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
            const over = limit > 0 && spent > limit;
            return (
              <div key={c.id} className="p-3 rounded-xl border space-y-2">
                <div className="flex items-center gap-2">
                  <div className="size-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: c.color + "22", color: c.color }}>
                    <IconByName name={c.icon} className="size-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{c.name}</div>
                    {limit > 0 && <div className="text-[11px] text-muted-foreground">صُرف {fmtMoney(spent)} من {fmtMoney(limit)}</div>}
                  </div>
                </div>
                {limit > 0 && (
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input type="number" inputMode="decimal" dir="ltr" placeholder="0 = إلغاء"
                    value={draft[c.id] ?? ""} onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })} className="h-9" />
                  <Button size="sm" onClick={() => save(c.id)} className="bg-gradient-primary text-primary-foreground">حفظ</Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
