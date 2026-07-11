import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Wallet } from "lucide-react";
import { fmtMonthAr, monthRange } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExpenseDialog } from "@/components/ExpenseDialog";
import { ListSkeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { SearchBar } from "@/components/common/SearchBar";
import { FabButton } from "@/components/common/FabButton";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { MonthlyExpenseHeader } from "@/features/expenses/MonthlyExpenseHeader";
import { CategoryBreakdown } from "@/features/expenses/CategoryBreakdown";
import { ExpensesTable } from "@/features/expenses/ExpensesTable";
import { useCurrencies } from "@/hooks/useCurrencies";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/expenses")({ component: ExpensesPage });

interface Expense { id: string; amount: number; category_id: string | null; currency_id: string; note: string | null; expense_date: string; receipt_path: string | null }
interface Budget { id: string; category_id: string | null; amount: number; currency_id: string }
interface Account { id: string; name: string; is_default: boolean }

function ExpensesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(new Date());
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [delTarget, setDelTarget] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("");

  const { start, end } = monthRange(month);

  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ["expenses", user?.id, start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from("expenses").select("*").gte("expense_date", start.toISOString()).lt("expense_date", end.toISOString()).order("expense_date", { ascending: false });
      return (data ?? []) as Expense[];
    },
    enabled: !!user,
  });

  const { data: categories = [] } = useExpenseCategories();
  const { data: currencies = [] } = useCurrencies();

  const { data: budgets = [], isLoading: loadingBudgets } = useQuery({
    queryKey: ["budgets", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("budgets").select("*");
      return (data ?? []) as Budget[];
    },
    enabled: !!user,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("financial_accounts" as any).select("*").order("is_default", { ascending: false });
      return (data ?? []) as unknown as Account[];
    },
    enabled: !!user,
  });

  const loading = loadingExpenses || loadingBudgets;

  const base = currencies.find((c) => c.is_base) ?? currencies[0];

  const toBase = (amount: number, currencyId: string) => {
    const cur = currencies.find((c) => c.id === currencyId);
    return Number(amount) * (cur?.rate ?? 1);
  };

  const totalBase = useMemo(
    () => expenses.reduce((s, x) => s + toBase(x.amount, x.currency_id), 0),
    [expenses, currencies],
  );

  const totalBudget = useMemo(
    () => budgets.reduce((s, b) => s + toBase(b.amount, b.currency_id), 0),
    [budgets, currencies],
  );

  const byCat = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category_id ?? "_";
      m.set(k, (m.get(k) ?? 0) + toBase(e.amount, e.currency_id));
    }
    return Array.from(m.entries())
      .map(([id, v]) => {
        const cat = categories.find((c) => c.id === id);
        return { id, name: cat?.name ?? "غير مصنّف", color: cat?.color ?? "#94a3b8", value: v };
      })
      .sort((a, b) => b.value - a.value);
  }, [expenses, categories, currencies]);

  const filtered = useMemo(() => expenses.filter((e) => {
    if (filterCat && e.category_id !== filterCat) return false;
    if (!q) return true;
    const cat = categories.find((c) => c.id === e.category_id);
    return `${cat?.name ?? ""} ${e.note ?? ""}`.toLowerCase().includes(q.toLowerCase());
  }), [expenses, q, filterCat, categories]);

  const refetchAll = () => {
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
  };

  const del = async () => {
    if (!delTarget) return;
    const { error } = await supabase.from("expenses").delete().eq("id", delTarget);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    refetchAll();
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      <MonthlyExpenseHeader
        month={month}
        onMonthChange={setMonth}
        total={totalBase}
        budget={totalBudget}
        baseName={base?.name ?? ""}
      />

      <CategoryBreakdown data={byCat} total={totalBase} />

      <div className="flex items-center gap-2">
        <div className="flex-1"><SearchBar value={q} onChange={setQ} placeholder="ابحث في المصاريف..." /></div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(e.target.value)}
          className="h-9 rounded-lg border bg-card px-2 text-[11px] font-semibold max-w-[110px]"
          aria-label="تصفية بالتصنيف"
        >
          <option value="">كل التصنيفات</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={expenses.length === 0 ? `لا توجد مصاريف في ${fmtMonthAr(month)}` : "لا توجد نتائج"}
          description={expenses.length === 0 ? "ابدأ بتسجيل أول مصروف وراقب إنفاقك بسهولة." : "جرّب كلمة بحث أو تصنيف آخر."}
          variant="compact"
        />
      ) : (
        <ExpensesTable
          expenses={filtered}
          categories={categories}
          currencies={currencies}
          onEdit={(e) => { setEditing(e); setOpen(true); }}
          onDelete={(id) => setDelTarget(id)}
        />
      )}

      <FabButton onClick={() => { setEditing(null); setOpen(true); }} label="إضافة مصروف" />

      <ExpenseDialog
        open={open}
        onOpenChange={setOpen}
        currencies={currencies}
        categories={categories}
        accounts={accounts}
        editing={editing}
        onSuccess={refetchAll}
      />

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(v) => !v && setDelTarget(null)}
        title="حذف المصروف"
        description="لا يمكن التراجع عن هذا الإجراء."
        destructive
        confirmLabel="حذف"
        onConfirm={del}
      />
    </div>
  );
}
